import { NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import { q, hasBlob } from '@/lib/server/db';
import { currentUser, unauthorized } from '@/lib/server/auth';
// NOT from '@/lib/assets/uploads' — that module is 'use client' (it owns the
// IndexedDB store), so importing it here builds fine and then 500s at request
// time. The naming helpers live in ../paths precisely so both sides share them.
import { CATEGORY_FOLDER, prettyName, slug } from '@/lib/assets/paths';
import { ASSET_CATEGORIES } from '@/lib/model/types';
import type { AssetCategory } from '@/lib/model/types';

export const dynamic = 'force-dynamic';
/** Downloading and re-uploading dozens of photographs takes longer than a page render. */
export const maxDuration = 300;

/**
 * Copies pictures and video into the shared asset library from any set of URLs.
 *
 * The Shopify importer next door does the same job for a storefront, and the
 * browser uploader does it for a file on someone's desk. This is the third
 * case, and it is the one that kept coming up: photography that already lives
 * somewhere on the web — an existing marketing site, a deployed microsite, a
 * shared bucket — and needs to become a library asset rather than a link.
 *
 * COPIED, never linked, for the same reason as the Shopify route: a link looks
 * like it works and then rots when the far end re-crops or redeploys, and a
 * deck a buyer opens next month loses its pictures. Owning the file is the
 * whole point of the library.
 *
 * Body:
 *   {
 *     brand:    'corporate' | 'vigo' | 'alessi',
 *     category: an AssetCategory,            // default for every item
 *     items: [
 *       { url, name?, category?, fileName? } // name/category override per item
 *     ],
 *     dryRun?: boolean
 *   }
 *
 * Ids are derived exactly as a manual upload derives them — brand, folder and
 * filename — so a re-run replaces rather than duplicating, and a file someone
 * uploaded by hand still wins the way the team expects.
 */

interface Item {
  url: string;
  name?: string;
  category?: AssetCategory;
  fileName?: string;
}

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
  const brand: string = body?.brand || 'corporate';
  const fallbackCategory: AssetCategory = body?.category || 'Lifestyle';
  const items: Item[] = Array.isArray(body?.items) ? body.items : [];
  const dryRun: boolean = !!body?.dryRun;

  if (!items.length) {
    return NextResponse.json({ error: 'Give at least one item with a url.' }, { status: 400 });
  }
  if (items.length > 60) {
    return NextResponse.json(
      { error: 'Sixty at a time — send the rest in a second call so the function cannot time out.' },
      { status: 400 }
    );
  }
  if (!ASSET_CATEGORIES.includes(fallbackCategory)) {
    return NextResponse.json({ error: 'Unknown category ' + fallbackCategory }, { status: 400 });
  }

  const imported: { id: string; name: string; url: string }[] = [];
  const failed: { url: string; reason: string }[] = [];

  for (const item of items) {
    const category = item.category || fallbackCategory;
    try {
      if (!/^https:\/\//i.test(item.url || '')) throw new Error('url must be https');
      if (!ASSET_CATEGORIES.includes(category)) throw new Error('unknown category ' + category);

      const folder = CATEGORY_FOLDER[category] || 'misc';
      const sourceFile = (item.url.split('?')[0].split('/').pop() || 'asset').trim();
      const ext = (sourceFile.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase();
      const base = slug(item.fileName || sourceFile);
      const fileName = `${base}${ext}`;

      if (dryRun) {
        imported.push({ id: `${brand}-${folder}-${base}`, name: item.name || prettyName(sourceFile), url: item.url });
        continue;
      }

      const res = await fetch(item.url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`source returned ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new Error('empty file');

      const contentType = res.headers.get('content-type') || '';
      const kind = contentType.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(ext) ? 'video' : 'image';

      const pathname = `assets/${brand}/${folder}/${fileName}`;
      // The server SDK at this version has no allowOverwrite flag and its
      // behaviour on an existing pathname is not something to rely on, so the
      // replacement is made explicit: drop the old object, then write. This is
      // what keeps a re-run idempotent instead of erroring or duplicating.
      await del(pathname).catch(() => {});
      const blob = await put(pathname, buf, {
        access: 'public',
        addRandomSuffix: false,
        contentType: contentType || undefined,
      });

      const id = `${brand}-${folder}-${base}`;
      await q(
        `insert into assets (id, brand, category, name, file_name, url, kind, width, height, size, uploaded_by, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         on conflict (id) do update set
           name = excluded.name, url = excluded.url, kind = excluded.kind,
           width = excluded.width, height = excluded.height, size = excluded.size,
           uploaded_by = excluded.uploaded_by, created_at = excluded.created_at`,
        [
          id,
          brand,
          category,
          item.name || prettyName(sourceFile),
          fileName,
          blob.url,
          kind,
          null,
          null,
          buf.length,
          me.id,
          Date.now(),
        ]
      );

      imported.push({ id, name: item.name || prettyName(sourceFile), url: blob.url });
    } catch (e: any) {
      failed.push({ url: item.url, reason: e?.message || 'failed' });
    }
  }

  return NextResponse.json({
    ok: true,
    brand,
    requested: items.length,
    imported,
    failed,
    dryRun,
  });
}
