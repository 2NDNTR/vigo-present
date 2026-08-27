import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';
import { currentUser, newId, unauthorized } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await currentUser();
  if (!me) return unauthorized();
  const r = await q(
    `select id, email, name, role, created_at,
            (password_hash is not null) as active, last_seen
     from users order by created_at asc`
  );
  return NextResponse.json({ users: r.rows });
}

/** Add a colleague by email. They set their own password on first sign-in. */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();
  const { email, name } = await req.json().catch(() => ({}));
  const addr = String(email || '').trim().toLowerCase();
  if (!addr || !addr.includes('@')) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  await q(
    `insert into users (id, email, name, role, created_at)
     values ($1, $2, $3, 'editor', $4)
     on conflict (email) do nothing`,
    [newId('usr'), addr, String(name || '').trim(), Date.now()]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();
  const { id } = await req.json().catch(() => ({}));
  if (!id || id === me.id) {
    return NextResponse.json({ error: 'You cannot remove your own account.' }, { status: 400 });
  }
  await q('delete from users where id = $1', [id]);
  return NextResponse.json({ ok: true });
}
