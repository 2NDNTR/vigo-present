import { NextResponse } from 'next/server';
import { signedIn } from '@/lib/server/access';
import { q } from '@/lib/server/db';
import { CATEGORY_FOLDER, slug } from '@/lib/assets/paths';
import type { AssetCategory } from '@/lib/model/types';

export const dynamic = 'force-dynamic';

/**
 * THE V1 LIBRARY, READY TO COPY
 * ---------------------------------------------------------------------------
 * Reads the live site's media list over the web — its public, read-only
 * /api/assets — and never its database, so V2 stays isolated from V1. Each
 * file is filed into the four groups the team works with:
 *
 *   Logos     brand logos, partner logos, the retailer marks the app ships with
 *   Products  product photography (and the private-label range)
 *   Lifestyle lifestyle photography (and the website mockup)
 *   Video     every video, whatever V1 called it
 *
 * Brand logos are moved to the brand they belong to. Nothing is copied here;
 * the Settings page sends the plan to /api/assets/import-urls in batches.
 */

const V1 = 'https://vigopresents.com';
const V1_BLOB = 'iqaxvlc63ef0zefa.public.blob.vercel-storage.com';

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
  /** the id it will have in V2, so a re-run can skip what is already there */
  id: string;
  exists: boolean;
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

export async function GET() {
  const a = await signedIn();
  if (a instanceof Response) return a;
  if (!a.platformAdmin) return NextResponse.json({ error: 'Only an administrator can import the V1 library.' }, { status: 403 });

  let list: V1Asset[] = [];
  try {
    const r = await fetch(V1 + '/api/assets', { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    list = (await r.json()).assets || [];
  } catch (e: any) {
    return NextResponse.json({ error: `The live site's library could not be read (${e?.message || 'network'}).` }, { status: 502 });
  }

  const items = list.map(file).filter(Boolean) as PlanItem[];
  // the retailer marks ship with the app rather than living in V1's library
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

  // one copy per V2 id: two V1 files that land on the same name keep the first
  const seen = new Set<string>();
  const plan = items.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  const have = await q('select id from assets where id = any($1)', [plan.map((x) => x.id)]);
  const there = new Set(have.rows.map((r: any) => r.id));
  plan.forEach((x) => (x.exists = there.has(x.id)));

  return NextResponse.json({ items: plan, source: V1 + '/api/assets', v1Count: list.length });
}
