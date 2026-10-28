import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';
import { currentUser, unauthorized } from '@/lib/server/auth';
import { accessFor, can, forbidden } from '@/lib/server/access';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return unauthorized();
  const { id } = await ctx.params;
  const r = await q('select url, brand from assets where id = $1', [id]);
  if (r.rows[0] && !can(await accessFor(me), r.rows[0].brand, 'edit')) return forbidden();
  await q('delete from assets where id = $1', [id]);
  // Remove the underlying file too, so storage does not grow forever.
  try {
    if (r.rows[0]?.url && process.env.BLOB_READ_WRITE_TOKEN) {
      const { del } = await import('@vercel/blob');
      await del(r.rows[0].url);
    }
  } catch {
    /* the record is gone either way */
  }
  return NextResponse.json({ ok: true });
}


/**
 * Re-files an item: { category } moves it to another group, { brand } to
 * another brand. Only the record changes — the file and its address stay put,
 * so every deck already using it keeps working.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const r = await q('select brand, category from assets where id = $1', [id]);
  const row = r.rows[0];
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const access = await accessFor(me);
  const brand = typeof body.brand === 'string' ? body.brand : row.brand;
  if (!can(access, row.brand, 'edit') || !can(access, brand, 'edit')) return forbidden();
  const category = typeof body.category === 'string' ? body.category : row.category;
  if (category !== row.category) {
    const f = await q('select 1 from media_folders where name = $1', [category]);
    if (!f.rows.length) return NextResponse.json({ error: 'No such folder' }, { status: 400 });
  }
  await q('update assets set brand = $2, category = $3 where id = $1', [id, brand, category]);
  return NextResponse.json({ ok: true, brand, category });
}
