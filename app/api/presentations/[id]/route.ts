import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';
import { currentUser, unauthorized } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return unauthorized();
  const { id } = await ctx.params;
  const r = await q('select doc, version from presentations where id = $1', [id]);
  const row = r.rows[0];
  return NextResponse.json({
    presentation: row ? { ...row.doc, version: row.version } : null,
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return unauthorized();
  const { id } = await ctx.params;
  await q('delete from presentations where id = $1', [id]);
  return NextResponse.json({ ok: true });
}
