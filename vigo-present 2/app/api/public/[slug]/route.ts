import { NextResponse } from 'next/server';
import { hasDatabase, serverStore } from '@/lib/store/server-pg';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (!hasDatabase()) return NextResponse.json({ error: 'no database' }, { status: 501 });
  const { slug } = await ctx.params;
  const presentation = await serverStore.getBySlug(slug);
  if (!presentation || presentation.status !== 'published') {
    return NextResponse.json({ presentation: null }, { status: 404 });
  }
  return NextResponse.json({ presentation });
}
