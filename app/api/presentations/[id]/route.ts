import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';
import { audit, can, deckBrand, forbidden, signedIn } from '@/lib/server/access';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const a = await signedIn();
  if (a instanceof Response) return a;
  const { id } = await ctx.params;
  const r = await q('select doc, version, coalesce(brand_id, brand) as brand, archived_at from presentations where id = $1', [id]);
  const row = r.rows[0];
  // Someone without access is told the same thing as someone asking for a deck
  // that does not exist, so ids cannot be probed.
  if (!row || !can(a, row.brand, 'view')) return NextResponse.json({ presentation: null }, { status: 404 });
  return NextResponse.json({
    presentation: { ...row.doc, version: row.version, archivedAt: row.archived_at || undefined },
    canEdit: can(a, row.brand, 'edit'),
  });
}

/**
 * Delete ARCHIVES. The deck leaves every list and its share links stop
 * working, but nothing is destroyed: `PATCH {restore:true}` brings it back,
 * links and all. Permanent removal is a platform-admin action (`?purge=1`).
 */
export async function DELETE(req: Request, ctx: Ctx) {
  const a = await signedIn();
  if (a instanceof Response) return a;
  const { id } = await ctx.params;
  const brand = await deckBrand(id);
  if (brand === undefined) return NextResponse.json({ ok: true });
  if (!can(a, brand, 'edit')) return forbidden();

  if (new URL(req.url).searchParams.get('purge') === '1') {
    if (!a.platformAdmin) return forbidden('Only a platform admin can permanently delete.');
    await q('delete from presentations where id = $1', [id]);
    await audit(a.user.id, 'presentation.purge', id);
    return NextResponse.json({ ok: true, purged: true });
  }
  await q('update presentations set archived_at = $2 where id = $1 and archived_at is null', [id, Date.now()]);
  await audit(a.user.id, 'presentation.archive', id);
  return NextResponse.json({ ok: true, archived: true });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const a = await signedIn();
  if (a instanceof Response) return a;
  const { id } = await ctx.params;
  const brand = await deckBrand(id);
  if (brand === undefined || !can(a, brand, 'edit')) return forbidden();
  const body = await req.json().catch(() => ({}));
  if (body?.restore) {
    await q('update presentations set archived_at = null where id = $1', [id]);
    await audit(a.user.id, 'presentation.restore', id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
}
