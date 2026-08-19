import { NextResponse } from 'next/server';
import { hasDatabase, serverStore } from '@/lib/store/server-pg';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) return NextResponse.json({ error: 'no database' }, { status: 501 });
  const { id } = await ctx.params;
  const presentation = await serverStore.get(id);
  return NextResponse.json({ presentation });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) return NextResponse.json({ error: 'no database' }, { status: 501 });
  const { id } = await ctx.params;
  await serverStore.remove(id);
  return NextResponse.json({ ok: true });
}
