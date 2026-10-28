import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';
import { audit, can, deckBrand, forbidden, signedIn } from '@/lib/server/access';
import { writeVersion } from '@/lib/server/versions';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * VERSION HISTORY
 * ---------------------------------------------------------------------------
 * Autosave keeps the deck current; versions keep it RECOVERABLE. A version is
 * written at the moments a person would want to go back to: a deck generated,
 * an AI change accepted, a publish, a named checkpoint, and before every
 * restore. Restoring never deletes anything after it — it writes the old
 * content forward as the newest version, so a restore can itself be undone.
 */

export async function GET(_req: Request, ctx: Ctx) {
  const a = await signedIn();
  if (a instanceof Response) return a;
  const { id } = await ctx.params;
  const brand = await deckBrand(id);
  if (brand === undefined || !can(a, brand, 'view')) return NextResponse.json({ versions: [] }, { status: 404 });
  const r = await q(
    `select v.n, v.label, v.reason, v.created_at, u.name as author
     from presentation_versions v left join users u on u.id = v.author_id
     where v.presentation_id = $1 order by v.n desc limit 200`,
    [id]
  );
  return NextResponse.json({ versions: r.rows });
}

/**
 * `{ label }` saves the current deck as a named version.
 * `{ restore: n }` brings version n back as the current deck.
 */
export async function POST(req: Request, ctx: Ctx) {
  const a = await signedIn();
  if (a instanceof Response) return a;
  const { id } = await ctx.params;
  const brand = await deckBrand(id);
  if (brand === undefined || !can(a, brand, 'edit')) return forbidden();
  const body = await req.json().catch(() => ({}));
  const now = Date.now();

  if (body?.restore != null) {
    const n = Number(body.restore);
    const v = await q('select snapshot from presentation_versions where presentation_id = $1 and n = $2', [id, n]);
    if (!v.rows[0]) return NextResponse.json({ error: 'No such version.' }, { status: 404 });
    // the deck as it is now is kept first, so this restore can be undone
    await writeVersion(id, `Before restoring version ${n}`, 'restore', a.user.id, now);
    const cur = await q('select version from presentations where id = $1', [id]);
    const next = Number(cur.rows[0].version) + 1;
    const doc = { ...v.rows[0].snapshot, updatedAt: now };
    await q(
      `update presentations set doc = $2, title = $3, version = $4, updated_by = $5, updated_at = $6 where id = $1`,
      [id, JSON.stringify(doc), doc.title, next, a.user.id, now]
    );
    await writeVersion(id, `Restored version ${n}`, 'restore', a.user.id, now);
    await audit(a.user.id, 'presentation.restore_version', id, { n });
    return NextResponse.json({ ok: true, presentation: { ...doc, version: next } });
  }

  const label = String(body?.label || '').trim().slice(0, 120) || 'Checkpoint';
  const reason = ['generate', 'ai-accept', 'publish', 'checkpoint'].includes(body?.reason) ? body.reason : 'checkpoint';
  const n = await writeVersion(id, label, reason, a.user.id, now);
  return NextResponse.json({ ok: true, n });
}
