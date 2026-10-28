import 'server-only';
import { del, put } from '@vercel/blob';
import { q } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/passwords';
import { CATEGORY_FOLDER, prettyName, slug } from '@/lib/assets/paths';
import type { AssetCategory, Presentation } from '@/lib/model/types';

/**
 * BRINGING THE LIVE SITE'S CONTENT INTO V2
 * ---------------------------------------------------------------------------
 * Media is read from the live site's public library list and copied file by
 * file into V2's own storage. Presentations arrive as JSON (read by someone
 * signed in to the live site) and are written into V2's database. V2 never
 * connects to V1's database, and nothing on the live site is changed.
 *
 * Everything is idempotent: ids are kept, so a second run skips what is here.
 */

export const V1 = 'https://vigopresents.com';
const V1_BLOB = 'iqaxvlc63ef0zefa.public.blob.vercel-storage.com';

export interface PlanItem {
  sourceId: string;
  url: string;
  name: string;
  brand: 'corporate' | 'vigo' | 'alessi';
  category: AssetCategory;
  fileName: string;
  width?: number;
  height?: number;
  kind: 'image' | 'video';
  id: string;
  exists: boolean;
}

interface V1Asset {
  id: string;
  brand: string;
  category: string;
  name: string;
  path: string;
  kind?: string;
  width?: number | null;
  height?: number | null;
}

function file(a: V1Asset): PlanItem | null {
  let host = '';
  try {
    host = new URL(a.path).host;
  } catch {
    return null;
  }
  if (host !== V1_BLOB && host !== 'vigopresents.com') return null;
  const kind: 'image' | 'video' = a.kind === 'video' || /\.(mp4|mov|webm)$/i.test(a.path) ? 'video' : 'image';
  const name = String(a.name || '').trim() || a.id;
  const lower = name.toLowerCase();
  let brand = (['corporate', 'vigo', 'alessi'].includes(a.brand) ? a.brand : 'corporate') as PlanItem['brand'];
  let category: AssetCategory;

  if (kind === 'video') category = 'Video';
  else if (a.category === 'Logos') {
    category = 'Logos';
    // a brand's own logo belongs to that brand; the group lockup and others stay corporate
    if (/^alessi/.test(lower)) brand = 'alessi';
    else if (/^(vintage )?vigo logo/.test(lower)) brand = 'vigo';
  } else if (a.category === 'Retail') {
    if (/website|mockup/.test(lower)) category = 'Lifestyle';
    else if (/range|private label/.test(lower)) category = 'Product Photography';
    else category = 'Logos'; // the partner restaurant tiles are their logos
  } else if (a.category === 'Product Photography' || a.category === 'Packaging') category = 'Product Photography';
  else category = 'Lifestyle';

  const sourceFile = a.path.split('?')[0].split('/').pop() || 'asset';
  const ext = (sourceFile.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase();
  const base = slug(sourceFile);
  return {
    sourceId: a.id,
    url: a.path,
    name,
    brand,
    category,
    fileName: base + ext,
    width: a.width || undefined,
    height: a.height || undefined,
    kind,
    id: `${brand}-${CATEGORY_FOLDER[category] || 'misc'}-${base}`,
    exists: false,
  };
}

const RETAILERS: [string, string][] = [
  ['publix', 'Publix'],
  ['target', 'Target'],
  ['walmart', 'Walmart'],
];

/** The live library, filed into Logos / Products / Lifestyle / Video, with what V2 already has marked. */
export async function buildPlan(): Promise<{ items: PlanItem[]; v1Count: number }> {
  const r = await fetch(V1 + '/api/assets', { cache: 'no-store' });
  if (!r.ok) throw new Error(`the live library answered ${r.status}`);
  const list: V1Asset[] = (await r.json()).assets || [];
  const items = list.map(file).filter(Boolean) as PlanItem[];
  RETAILERS.forEach(([f, name]) =>
    items.push({
      sourceId: 'repo-' + f,
      url: `${V1}/retailers/${f}.png`,
      name: name + ' logo',
      brand: 'corporate',
      category: 'Logos',
      fileName: `${f}.png`,
      kind: 'image',
      id: `corporate-logos-${f}`,
      exists: false,
    })
  );
  const seen = new Set<string>();
  const plan = items.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  const have = await q('select id from assets where id = any($1)', [plan.map((x) => x.id)]);
  const there = new Set(have.rows.map((row: any) => row.id));
  plan.forEach((x) => (x.exists = there.has(x.id)));
  return { items: plan, v1Count: list.length };
}

/** Copies one file into V2's storage and library. Shared with /api/assets/import-urls. */
export async function copyToLibrary(
  item: { url: string; name?: string; category: AssetCategory; fileName?: string; width?: number; height?: number },
  brand: string,
  userId: string
): Promise<{ id: string; name: string; url: string }> {
  if (!/^https:\/\//i.test(item.url || '')) throw new Error('url must be https');
  const folder = CATEGORY_FOLDER[item.category] || 'misc';
  const sourceFile = (item.url.split('?')[0].split('/').pop() || 'asset').trim();
  const ext = (sourceFile.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase();
  const base = slug(item.fileName || sourceFile);
  const fileName = `${base}${ext}`;

  const res = await fetch(item.url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`source returned ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('empty file');
  const contentType = res.headers.get('content-type') || '';
  const kind = contentType.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(ext) ? 'video' : 'image';

  const pathname = `assets/${brand}/${folder}/${fileName}`;
  await del(pathname).catch(() => {});
  const blob = await put(pathname, buf, {
    access: 'public',
    addRandomSuffix: false,
    contentType: contentType || undefined,
    multipart: buf.length > 20 * 1024 * 1024,
  });

  const id = `${brand}-${folder}-${base}`;
  const name = item.name || prettyName(sourceFile);
  await q(
    `insert into assets (id, brand, category, name, file_name, url, kind, width, height, size, uploaded_by, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (id) do update set
       name = excluded.name, url = excluded.url, kind = excluded.kind, category = excluded.category,
       width = excluded.width, height = excluded.height, size = excluded.size,
       uploaded_by = excluded.uploaded_by, created_at = excluded.created_at`,
    [id, brand, item.category, name, fileName, blob.url, kind, Number(item.width) || null, Number(item.height) || null, buf.length, userId, Date.now()]
  );
  return { id, name, url: blob.url };
}

/** Copies the given plan items; returns what failed. */
export async function importMedia(items: PlanItem[], userId: string) {
  const failed: { name: string; reason: string }[] = [];
  let copied = 0;
  for (const it of items) {
    try {
      await copyToLibrary(it, it.brand, userId);
      copied++;
    } catch (e: any) {
      failed.push({ name: it.name, reason: e?.message || 'failed' });
    }
  }
  return { copied, failed };
}

/**
 * Writes V1 presentations into V2. Each keeps its id, title, brand, pages and
 * share slug; pictures that were copied into V2's library are re-pointed to
 * V2's copies; a deck password is hashed into its share link and removed from
 * the document. Decks already in V2 are left alone.
 */
export async function importDecks(decks: Presentation[], userId: string) {
  const { items } = await buildPlan();
  const have = await q('select id, url from assets where id = any($1)', [items.map((x) => x.id)]);
  const v2url = new Map<string, string>(have.rows.map((row: any) => [String(row.id), String(row.url)]));
  const urlMap = new Map<string, { url: string; id: string }>();
  const idMap = new Map<string, string>();
  items.forEach((x) => {
    const u = v2url.get(x.id);
    if (!u) return;
    urlMap.set(x.url, { url: u, id: x.id });
    idMap.set(x.sourceId, x.id);
  });
  const remap = (v: any): any => {
    if (Array.isArray(v)) return v.map(remap);
    if (v && typeof v === 'object') {
      const o: any = {};
      for (const [k, val] of Object.entries(v)) o[k] = remap(val);
      if (typeof o.url === 'string' && urlMap.has(o.url)) {
        const m = urlMap.get(o.url)!;
        o.url = m.url;
        o.assetId = m.id;
      } else if (typeof o.assetId === 'string' && idMap.has(o.assetId)) o.assetId = idMap.get(o.assetId);
      return o;
    }
    if (typeof v === 'string' && urlMap.has(v)) return urlMap.get(v)!.url;
    return v;
  };

  const out: { title: string; result: 'imported' | 'already here' | 'skipped'; reason?: string }[] = [];
  for (const raw of decks) {
    const title = String(raw?.title || 'Untitled');
    try {
      if (!raw?.id || !Array.isArray(raw.pages)) {
        out.push({ title, result: 'skipped', reason: 'not a presentation' });
        continue;
      }
      const exists = await q('select 1 from presentations where id = $1', [raw.id]);
      if (exists.rows.length) {
        out.push({ title, result: 'already here' });
        continue;
      }
      const doc: any = remap(JSON.parse(JSON.stringify(raw)));
      delete doc.version;
      delete doc.archivedAt;
      const brand = ['corporate', 'vigo', 'alessi'].includes(doc.brand) ? doc.brand : 'corporate';
      doc.brand = brand;
      const password = doc.share?.password ? String(doc.share.password) : '';
      if (doc.share) delete doc.share.password;
      let slugValue: string | null = doc.share?.slug || null;
      if (slugValue) {
        const taken = await q('select 1 from share_links where slug = $1', [slugValue]);
        if (taken.rows.length) {
          slugValue = slugValue + '-v1';
          doc.share.slug = slugValue;
        }
      }
      const now = Date.now();
      const created = Number(doc.createdAt) || now;
      await q(
        `insert into presentations
           (id, org_id, title, brand, brand_id, status, slug, locked, doc, version, created_by, updated_by, created_at, updated_at)
         values ($1,$2,$3,$4,$4,$5,$6,$7,$8,1,$9,$9,$10,$11)`,
        [doc.id, 'vigo-importing', title, brand, doc.status || 'draft', slugValue, !!doc.locked, JSON.stringify(doc), userId, created, Number(doc.updatedAt) || now]
      );
      await q(
        `insert into presentation_versions (id, presentation_id, n, label, reason, snapshot, author_id, created_at)
         values ($1, $2, 1, 'Imported from the live site', 'checkpoint', $3, $4, $5) on conflict do nothing`,
        ['ver_' + doc.id + '_1', doc.id, JSON.stringify(doc), userId, now]
      );
      if (slugValue) {
        const access = password ? 'password' : doc.share?.access === 'internal' || doc.share?.access === 'private' ? 'private' : 'public';
        const layout = doc.share?.mode === 'slide' || doc.share?.mode === 'horizontal' ? 'horizontal' : 'vertical';
        await q(
          `insert into share_links (id, presentation_id, slug, access, password_hash, layout, created_by, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict do nothing`,
          ['shl_' + doc.id, doc.id, slugValue, access, password ? hashPassword(password) : null, layout, userId, now]
        );
      }
      out.push({ title, result: 'imported' });
    } catch (e: any) {
      out.push({ title, result: 'skipped', reason: e?.message || 'failed' });
    }
  }
  return out;
}
