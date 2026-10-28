import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { q } from '@/lib/server/db';
import { audit, can, deckBrand, forbidden, signedIn } from '@/lib/server/access';
import { hashPassword } from '@/lib/server/passwords';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** The deck's links — never their password hashes. */
export async function GET(_req: Request, ctx: Ctx) {
  const a = await signedIn();
  if (a instanceof Response) return a;
  const { id } = await ctx.params;
  const brand = await deckBrand(id);
  if (brand === undefined || !can(a, brand, 'view')) return NextResponse.json({ links: [] }, { status: 404 });
  const r = await q(
    `select id, slug, access, layout, revoked_at, created_at, (password_hash is not null) as has_password
     from share_links where presentation_id = $1 order by created_at`,
    [id]
  );
  return NextResponse.json({ links: r.rows });
}

/**
 * `{ access?, password?, layout? }` changes the deck's primary link.
 * A password is hashed here and goes nowhere else.
 */
export async function PUT(req: Request, ctx: Ctx) {
  const a = await signedIn();
  if (a instanceof Response) return a;
  const { id } = await ctx.params;
  const brand = await deckBrand(id);
  if (brand === undefined || !can(a, brand, 'edit')) return forbidden();
  const body = await req.json().catch(() => ({}));

  const link = await primaryLink(id, a.user.id);
  const sets: string[] = [];
  const params: unknown[] = [link.id];
  if (body.access !== undefined) {
    const access = body.access === 'internal' ? 'private' : body.access;
    if (!['public', 'password', 'private'].includes(access)) return NextResponse.json({ error: 'Unknown access.' }, { status: 400 });
    params.push(access);
    sets.push(`access = $${params.length}`);
  }
  if (body.layout !== undefined) {
    if (!['vertical', 'horizontal'].includes(body.layout)) return NextResponse.json({ error: 'Unknown layout.' }, { status: 400 });
    params.push(body.layout);
    sets.push(`layout = $${params.length}`);
  }
  if (body.password !== undefined) {
    const pw = String(body.password);
    if (pw && pw.length < 6) return NextResponse.json({ error: 'Use at least 6 characters.' }, { status: 400 });
    params.push(pw ? hashPassword(pw) : null);
    sets.push(`password_hash = $${params.length}`);
  }
  if (sets.length) await q(`update share_links set ${sets.join(', ')} where id = $1`, params);
  await audit(a.user.id, 'share.update', id, { access: body.access, layout: body.layout, password: body.password !== undefined });
  return NextResponse.json({ ok: true });
}

/**
 * Revoke: the current link stops working for everyone, immediately, and the
 * deck gets a fresh one. Sending the new link is the owner's choice.
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const a = await signedIn();
  if (a instanceof Response) return a;
  const { id } = await ctx.params;
  const brand = await deckBrand(id);
  if (brand === undefined || !can(a, brand, 'edit')) return forbidden();
  const old = await primaryLink(id, a.user.id);
  const now = Date.now();
  const fresh = old.slug.replace(/-[a-z0-9]{4}$/, '') + '-' + crypto.randomBytes(3).toString('hex').slice(0, 4);
  await q(`update share_links set revoked_at = $2, id = $3 where id = $1`, [old.id, now, old.id + '_r' + now]);
  await q(
    `insert into share_links (id, presentation_id, slug, access, password_hash, layout, created_by, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    ['shl_' + id, id, fresh, old.access, old.password_hash, old.layout, a.user.id, now]
  );
  // keep the deck's own copy of its slug in step, so the editor shows the new link
  await q(
    // the version bump makes any open editor reload rather than save the old slug back
    `update presentations set slug = $2, version = version + 1,
       doc = jsonb_set(doc, '{share,slug}', to_jsonb($2::text)) where id = $1`,
    [id, fresh]
  );
  await audit(a.user.id, 'share.revoke', id, { old: old.slug, new: fresh });
  return NextResponse.json({ ok: true, slug: fresh });
}

async function primaryLink(id: string, userId: string) {
  const r = await q('select * from share_links where id = $1', ['shl_' + id]);
  if (r.rows[0]) return r.rows[0];
  const p = await q(`select doc from presentations where id = $1`, [id]);
  const slug = p.rows[0]?.doc?.share?.slug || id;
  await q(
    `insert into share_links (id, presentation_id, slug, access, layout, created_by, created_at)
     values ($1, $2, $3, 'public', 'vertical', $4, $5) on conflict do nothing`,
    ['shl_' + id, id, slug, userId, Date.now()]
  );
  return (await q('select * from share_links where id = $1', ['shl_' + id])).rows[0];
}
