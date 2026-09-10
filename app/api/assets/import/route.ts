import { NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import { q, hasBlob } from '@/lib/server/db';
import { currentUser, unauthorized } from '@/lib/server/auth';
import { CATEGORY_FOLDER, slug } from '@/lib/assets/uploads';
import { ASSET_CATEGORIES } from '@/lib/model/types';
import type { AssetCategory } from '@/lib/model/types';

export const dynamic = 'force-dynamic';
/** Downloading and re-uploading dozens of photographs takes longer than a page render. */
export const maxDuration = 300;

/**
 * Pulls product photography straight out of a Shopify storefront into the
 * shared asset library.
 *
 * The pictures are COPIED into Blob storage rather than linked. Linking to
 * cdn.shopify.com would look like it works and then quietly rot: the marketing
 * team re-crops a photo, the versioned URL changes, and a deck somebody sent to
 * a buyer last month loses its images. Owning the file is the whole point of
 * the library — replace it once here and every deck updates.
 *
 * Runs in batches so a large catalogue cannot hit the function timeout. Send the
 * returned `nextSkip` back to continue; `done` says when there is nothing left.
 */

interface ShopifyImage {
  src: string;
  width?: number;
  height?: number;
  position?: number;
}
interface ShopifyProduct {
  title: string;
  handle: string;
  images?: ShopifyImage[];
}

/**
 * Screenshots and other studio leftovers get published to storefronts all the
 * time. They are not product photography, and letting them into the panel makes
 * the panel worse — the point of a library is that everything in it is usable.
 */
const NOT_PRODUCT_PHOTOGRAPHY = /screenshot|screen[\s_-]?shot|^img[\s_-]?\d+|untitled|\bcopy\b/i;

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();

  if (!hasBlob()) {
    return NextResponse.json(
      { error: 'Blob storage is not configured. Add BLOB_READ_WRITE_TOKEN.' },
      { status: 501 }
    );
  }

  const body = await req.json().catch(() => null);
  const store: string = (body?.store || '').trim().replace(/\/+$/, '');
  const brand: string = body?.brand || 'alessi';
  const category: AssetCategory = body?.category || 'Product Photography';
  const skip: number = Number(body?.skip || 0);
  const limit: number = Math.min(Number(body?.limit || 25), 50);
  const dryRun: boolean = !!body?.dryRun;
  const includeAll: boolean = !!body?.includeAll;

  if (!/^https:\/\/[a-z0-9.-]+$/i.test(store)) {
    return NextResponse.json({ error: 'Give a storefront like https://www.alessifoods.com' }, { status: 400 });
  }
  if (!ASSET_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Unknown category ' + category }, { status: 400 });
  }

  let products: ShopifyProduct[];
  try {
    const feed = await fetch(`${store}/products.json?limit=250`, { cache: 'no-store' });
    if (!feed.ok) throw new Error(`storefront returned ${feed.status}`);
    products = (await feed.json())?.products || [];
  } catch (e: any) {
    return NextResponse.json(
      { error: `Could not read ${store}/products.json — ${e?.message || 'unreachable'}` },
      { status: 502 }
    );
  }

  // Flatten to one row per picture, so batching is even regardless of how many
  // photographs any single product happens to have.
  const folder = CATEGORY_FOLDER[category] || 'misc';
  const queue: { name: string; fileName: string; base: string; src: string; width?: number; height?: number }[] = [];
  const rejected: string[] = [];

  for (const p of products) {
    const images = (p.images || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
    let kept = 0;
    for (const img of images) {
      const file = (img.src.split('?')[0].split('/').pop() || '').trim();
      if (!includeAll && NOT_PRODUCT_PHOTOGRAPHY.test(file)) {
        rejected.push(`${p.title} — ${file}`);
        continue;
      }
      kept++;
      // The name is what the search box matches on, so it is the product's
      // name, not Shopify's filename. "Calabrian Chili Crisp Shaker" is
      // findable; "Alessi-Chili_Crisp-Shaker_80348_SKU" is not.
      const name = kept === 1 ? p.title : `${p.title} ${kept}`;
      const ext = (file.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase();
      const base = slug(kept === 1 ? p.handle : `${p.handle}-${kept}`);
      queue.push({ name, base, fileName: `${base}${ext}`, src: img.src, width: img.width, height: img.height });
    }
  }

  const batch = queue.slice(skip, skip + limit);
  const imported: string[] = [];
  const failed: { name: string; reason: string }[] = [];

  if (!dryRun) {
    for (const item of batch) {
      try {
        const res = await fetch(item.src, { cache: 'no-store' });
        if (!res.ok) throw new Error(`source returned ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (!buf.length) throw new Error('empty file');

        const pathname = `assets/${brand}/${folder}/${item.fileName}`;
        // The server SDK at this version has no allowOverwrite flag and its
        // behaviour on an existing pathname is not something to rely on, so the
        // replacement is made explicit: drop the old object, then write. This
        // is what keeps a re-run idempotent instead of erroring or duplicating.
        await del(pathname).catch(() => {});
        const blob = await put(pathname, buf, {
          access: 'public',
          addRandomSuffix: false,
          contentType: res.headers.get('content-type') || undefined,
        });

        // Same id derivation as a manual upload, so re-running this replaces
        // rather than duplicating, and a hand-uploaded file of the same name
        // still wins the way the team expects.
        await q(
          `insert into assets (id, brand, category, name, file_name, url, kind, width, height, size, uploaded_by, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           on conflict (id) do update set
             name = excluded.name, url = excluded.url, kind = excluded.kind,
             width = excluded.width, height = excluded.height, size = excluded.size,
             uploaded_by = excluded.uploaded_by, created_at = excluded.created_at`,
          [
            `${brand}-${folder}-${item.base}`,
            brand,
            category,
            item.name,
            item.fileName,
            blob.url,
            'image',
            item.width || null,
            item.height || null,
            buf.length,
            me.id,
            Date.now(),
          ]
        );
        imported.push(item.name);
      } catch (e: any) {
        failed.push({ name: item.name, reason: e?.message || 'failed' });
      }
    }
  }

  const nextSkip = skip + batch.length;
  return NextResponse.json({
    ok: true,
    store,
    brand,
    category,
    products: products.length,
    pictures: queue.length,
    skippedAsNotProduct: rejected.length,
    rejected: skip === 0 ? rejected : undefined,
    batch: batch.length,
    imported: dryRun ? [] : imported,
    failed,
    nextSkip,
    done: nextSkip >= queue.length,
    preview: dryRun ? batch.map((b) => ({ name: b.name, fileName: b.fileName })) : undefined,
  });
}
