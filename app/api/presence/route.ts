import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';
import { currentUser, unauthorized } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

/**
 * WHO IS IN THE FILE
 * ---------------------------------------------------------------------------
 * A heartbeat rather than a connection. Every open editor says "still here"
 * every few seconds and gets back everyone else who said so recently. No
 * websocket, no second service, and nothing to reconnect after a laptop lid
 * closes — a serverless function cannot hold a socket open anyway.
 *
 * WINDOW is deliberately a few beats long. Shorter and a slow save makes
 * someone flicker out of the room they are sitting in; longer and a ghost
 * lingers after they close the tab.
 */
const WINDOW = 45_000;

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();

  const body = await req.json().catch(() => null);
  const deck = String(body?.presentationId || '');
  if (!deck) return NextResponse.json({ error: 'Missing presentation' }, { status: 400 });

  const now = Date.now();
  await q(
    `insert into presence (presentation_id, user_id, page_id, seen_at)
     values ($1, $2, $3, $4)
     on conflict (presentation_id, user_id)
     do update set seen_at = $4, page_id = $3`,
    [deck, me.id, body?.pageId ? String(body.pageId) : null, now]
  );

  const r = await q(
    `select p.user_id, p.page_id, p.seen_at, u.name, u.email
     from presence p join users u on u.id = p.user_id
     where p.presentation_id = $1 and p.seen_at > $2
     order by u.name nulls last, u.email`,
    [deck, now - WINDOW]
  );

  return NextResponse.json({
    here: r.rows.map((row: any) => ({
      id: row.user_id,
      name: row.name || row.email,
      email: row.email,
      pageId: row.page_id,
      me: row.user_id === me.id,
    })),
  });
}
