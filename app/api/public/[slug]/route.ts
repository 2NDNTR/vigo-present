import { NextResponse } from 'next/server';
import { loadShared, unlock } from '@/lib/server/shared';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ slug: string }> };

/** Shared pages are never indexed and never cached anywhere but the viewer's own tab. */
const HEADERS = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'private, no-store' };

/**
 * The one route with no sign-in. What it returns is decided in
 * lib/server/shared.ts: the drawable deck when this viewer may see it, a
 * password prompt state, or "not available" — never the stored document.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const r = await loadShared(slug);
  if (r.state === 'ok') return NextResponse.json({ presentation: r.deck }, { headers: HEADERS });
  if (r.state === 'password') return NextResponse.json({ presentation: null, locked: 'password' }, { status: 401, headers: HEADERS });
  return NextResponse.json({ presentation: null }, { status: 404, headers: HEADERS });
}

/** `{ password }` — checked on the server; a right answer sets a cookie for this link. */
export async function POST(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const { password } = await req.json().catch(() => ({}));
  const ok = await unlock(slug, String(password || '').slice(0, 200));
  if (!ok) {
    // slow enough that guessing is pointless, quick enough for a typo
    await new Promise((r) => setTimeout(r, 700));
    return NextResponse.json({ error: 'That password is not right.' }, { status: 401, headers: HEADERS });
  }
  return NextResponse.json({ ok: true }, { headers: HEADERS });
}
