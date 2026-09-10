import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';
import { currentUser, unauthorized } from '@/lib/server/auth';
import { uid } from '@/lib/model/types';

export const dynamic = 'force-dynamic';

/**
 * NOTES
 * ---------------------------------------------------------------------------
 * Feedback that lives beside the deck instead of in somebody's inbox. A note
 * is pinned to a page when there is one, so round three can be read next to
 * the slide round two was about.
 *
 * Mentions are stored as user IDS, not as the typed text. Someone who marries
 * and changes their name stays mentioned, and a note cannot be re-targeted by
 * editing the words around it.
 */

export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();

  const deck = new URL(req.url).searchParams.get('presentationId') || '';
  if (!deck) return NextResponse.json({ error: 'Missing presentation' }, { status: 400 });

  const r = await q(
    `select n.*, u.name, u.email
     from notes n left join users u on u.id = n.author_id
     where n.presentation_id = $1
     order by n.created_at asc`,
    [deck]
  );

  return NextResponse.json({
    notes: r.rows.map((row: any) => ({
      id: row.id,
      pageId: row.page_id,
      body: row.body,
      mentions: row.mentions || [],
      resolved: row.resolved,
      createdAt: Number(row.created_at),
      author: { id: row.author_id, name: row.name || row.email || 'Someone' },
      mine: row.author_id === me.id,
    })),
  });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();

  const body = await req.json().catch(() => null);
  const deck = String(body?.presentationId || '');
  const text = String(body?.body || '').trim();
  if (!deck || !text) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: 'That note is too long.' }, { status: 413 });

  const id = uid('note');
  await q(
    `insert into notes (id, presentation_id, page_id, author_id, body, mentions, created_at)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      deck,
      body?.pageId ? String(body.pageId) : null,
      me.id,
      text,
      JSON.stringify(Array.isArray(body?.mentions) ? body.mentions.slice(0, 20) : []),
      Date.now(),
    ]
  );

  return NextResponse.json({ ok: true, id });
}

/** Resolving is the only edit — a note nobody can rewrite is a note you can trust. */
export async function PATCH(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: 'Missing note' }, { status: 400 });
  await q('update notes set resolved = $2 where id = $1', [String(body.id), !!body.resolved]);
  return NextResponse.json({ ok: true });
}
