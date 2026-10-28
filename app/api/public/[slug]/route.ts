import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { q } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

/**
 * The one route with no sign-in: a published deck, for whoever has the link.
 *
 * What it hands out is decided HERE, not in the browser:
 *   - public decks: the pages, and only what the page draws
 *   - password decks: nothing until the right password is POSTed
 *   - internal (team only) decks: nothing at all to someone with just the link
 *
 * Before this, the whole stored deck — speaker notes, share settings and the
 * password itself — went to anyone with the slug, and the browser was trusted
 * to hide it. This route never writes, so it is safe on a preview that reads
 * the live database.
 */

const HEADERS = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'private, no-store' };

async function find(slug: string) {
  if (!slug || slug.length > 120) return null;
  const r = await q(`select doc from presentations where slug = $1 and status = 'published'`, [slug]);
  return r.rows[0]?.doc || null;
}

/** Only what the presenter draws. Notes, author ids and share secrets stay on the server. */
function publicDoc(doc: any) {
  const pages = (Array.isArray(doc.pages) ? doc.pages : []).map((p: any) => {
    const { notes, ...rest } = p || {};
    void notes;
    return rest;
  });
  return {
    id: 'shared',
    orgId: '',
    title: doc.title,
    brand: doc.brand,
    retailer: doc.retailer,
    status: 'published',
    share: { slug: doc.share?.slug, access: 'public', mode: doc.share?.mode || 'scroll' },
    pages,
    createdBy: '',
    createdAt: 0,
    updatedAt: 0,
  };
}

function same(a: string, b: string) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const doc = await find(slug);
  // Team-only decks look exactly like a link that does not exist.
  if (!doc || doc.share?.access === 'internal') {
    return NextResponse.json({ presentation: null }, { status: 404, headers: HEADERS });
  }
  if (doc.share?.access === 'password') {
    // A password deck with no password set stays closed rather than open.
    return NextResponse.json({ presentation: null, locked: 'password' }, { status: 401, headers: HEADERS });
  }
  return NextResponse.json({ presentation: publicDoc(doc) }, { headers: HEADERS });
}

/** `{ password }` — checked here; the right answer returns the deck, nothing is stored. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const { password } = await req.json().catch(() => ({}));
  const doc = await find(slug);
  const expected = doc?.share?.access === 'password' ? String(doc.share.password || '') : '';
  if (!expected || !same(String(password || '').slice(0, 200), expected)) {
    await new Promise((r) => setTimeout(r, 700));
    return NextResponse.json({ error: 'That password is not right.' }, { status: 401, headers: HEADERS });
  }
  return NextResponse.json({ presentation: publicDoc(doc) }, { headers: HEADERS });
}
