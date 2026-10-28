import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';
import { audit, can, forbidden, signedIn } from '@/lib/server/access';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE = ['description', 'voice', 'disclaimers', 'guidelines'] as const;

/** One brand's profile — what the AI is told about it, and what people read. */
export async function GET(_req: Request, ctx: Ctx) {
  const a = await signedIn();
  if (a instanceof Response) return a;
  const { id } = await ctx.params;
  if (!can(a, id, 'view')) return NextResponse.json({ brand: null }, { status: 404 });
  const r = await q(
    `select id, name, short_name, description, voice, disclaimers, guidelines, defaults, updated_at
     from brands where id = $1 and not archived`,
    [id]
  );
  if (!r.rows[0]) return NextResponse.json({ brand: null }, { status: 404 });
  return NextResponse.json({
    brand: r.rows[0],
    canEdit: can(a, id, 'edit'),
    canAdmin: can(a, id, 'admin'),
  });
}

/** Brand admins edit the written guidance. Colours and type stay in the theme. */
export async function PATCH(req: Request, ctx: Ctx) {
  const a = await signedIn();
  if (a instanceof Response) return a;
  const { id } = await ctx.params;
  if (!can(a, id, 'admin')) return forbidden('Only a brand admin can change brand guidance.');
  const body = await req.json().catch(() => ({}));
  const sets: string[] = [];
  const params: unknown[] = [id];
  for (const k of EDITABLE) {
    if (typeof body[k] === 'string') {
      params.push(body[k].slice(0, 8000));
      sets.push(`${k} = $${params.length}`);
    }
  }
  if (!sets.length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  params.push(Date.now());
  sets.push(`updated_at = $${params.length}`);
  await q(`update brands set ${sets.join(', ')} where id = $1`, params);
  await audit(a.user.id, 'brand.update', id, { fields: Object.keys(body).filter((k) => (EDITABLE as readonly string[]).includes(k)) });
  return NextResponse.json({ ok: true });
}
