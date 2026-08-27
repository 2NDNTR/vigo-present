import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

/** The one route with no sign-in: a published deck, for whoever has the link. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const r = await q(
    `select doc from presentations where slug = $1 and status = 'published'`,
    [slug]
  );
  if (!r.rows[0]) return NextResponse.json({ presentation: null }, { status: 404 });
  return NextResponse.json({ presentation: r.rows[0].doc });
}
