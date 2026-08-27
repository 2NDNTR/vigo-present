import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';
import { currentUser, unauthorized } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

/** The shared library. Same shape the client registry already expects. */
export async function GET() {
  const r = await q(
    `select id, brand, category, name, url as path, kind, width, height
     from assets order by brand, category, name`
  );
  return NextResponse.json({ assets: r.rows });
}

/**
 * Registers a file that has already been uploaded to Blob storage.
 *
 * The id is derived from brand + category + filename, so re-uploading a file
 * under the same name REPLACES the record rather than adding a second one —
 * which is what makes "replace once, updates everywhere" true for the whole
 * company, not just one browser.
 */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();
  const a = await req.json().catch(() => null);
  if (!a?.id || !a?.url) {
    return NextResponse.json({ error: 'Missing asset' }, { status: 400 });
  }
  await q(
    `insert into assets (id, brand, category, name, file_name, url, kind, width, height, size, uploaded_by, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (id) do update set
       name = excluded.name, url = excluded.url, kind = excluded.kind,
       width = excluded.width, height = excluded.height, size = excluded.size,
       uploaded_by = excluded.uploaded_by, created_at = excluded.created_at`,
    [
      a.id,
      a.brand,
      a.category,
      a.name,
      a.fileName || a.name,
      a.url,
      a.kind || 'image',
      a.width || null,
      a.height || null,
      a.size || null,
      me.id,
      Date.now(),
    ]
  );
  return NextResponse.json({ ok: true });
}
