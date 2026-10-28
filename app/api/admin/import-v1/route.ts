import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { q } from '@/lib/server/db';
import { currentUser } from '@/lib/server/auth';
import { buildPlan, importDecks, importMedia } from '@/lib/server/v1import';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Imports the live site's media and presentations.
 *
 * Who may call it: a signed-in platform administrator, or — for a one-off run
 * driven from a browser that is signed in to the live site but not to V2 — a
 * request carrying V1_IMPORT_TOKEN, a random value set in V2's environment for
 * the duration of the import and removed afterwards. Without that variable the
 * token path does not exist.
 *
 *   { action: 'plan' }                         → counts, and what is still to copy
 *   { action: 'media', offset, limit }         → copies that slice of the remaining files
 *   { action: 'decks', presentations: [...] }  → writes V1 presentations into V2
 */
async function caller(req: Request): Promise<{ id: string } | null> {
  const me = await currentUser();
  if (me?.platform_admin) return { id: me.id };
  const expected = process.env.V1_IMPORT_TOKEN || '';
  const given = req.headers.get('x-import-token') || '';
  if (expected.length >= 32 && given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    // act as the first platform administrator, so imported work has an owner
    const r = await q('select id from users where platform_admin order by created_at limit 1');
    return r.rows[0] ? { id: r.rows[0].id } : null;
  }
  return null;
}

export async function POST(req: Request) {
  const who = await caller(req);
  if (!who) return NextResponse.json({ error: 'Only an administrator can import.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  try {
    if (body.action === 'plan') {
      const { items, v1Count } = await buildPlan();
      const todo = items.filter((x) => !x.exists);
      const by = (k: string) => items.filter((x) => x.category === k).length;
      return NextResponse.json({
        v1Count,
        total: items.length,
        remaining: todo.length,
        groups: { Logos: by('Logos'), Products: by('Product Photography'), Lifestyle: by('Lifestyle'), Video: by('Video') },
      });
    }
    if (body.action === 'media') {
      const { items } = await buildPlan();
      const todo = items.filter((x) => !x.exists);
      const limit = Math.min(25, Math.max(1, Number(body.limit) || 10));
      // videos are copied one per call; they are the large ones
      const vid = todo.find((x) => x.kind === 'video');
      const slice = vid ? [vid] : todo.slice(0, limit);
      const res = await importMedia(slice, who.id);
      return NextResponse.json({ ...res, remaining: todo.length - res.copied });
    }
    if (body.action === 'decks') {
      const decks = Array.isArray(body.presentations) ? body.presentations.slice(0, 100) : [];
      return NextResponse.json({ decks: await importDecks(decks, who.id) });
    }
  } catch (e: any) {
    console.error('[import-v1]', e);
    return NextResponse.json({ error: e?.message || 'Import failed' }, { status: 500 });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
