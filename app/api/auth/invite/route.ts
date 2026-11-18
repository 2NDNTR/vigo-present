import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';
import { hashPassword, setSession } from '@/lib/server/auth';
import { findInvite } from '@/lib/server/invites';

export const dynamic = 'force-dynamic';

/** Who an invite link is for, so the page can greet them. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') || '';
  const u = await findInvite(token);
  if (!u) return NextResponse.json({ error: 'This invite link has expired or was already used. Ask an administrator for a new one.' }, { status: 404 });
  return NextResponse.json({ email: u.email, name: u.name });
}

/** Accept the invite: set the password, use up the link, sign in. */
export async function POST(req: Request) {
  const { token, password, name } = await req.json().catch(() => ({}));
  const pass = String(password || '');
  if (pass.length < 8) return NextResponse.json({ error: 'Choose a password of at least 8 characters.' }, { status: 400 });
  const u = await findInvite(String(token || ''));
  if (!u) return NextResponse.json({ error: 'This invite link has expired or was already used. Ask an administrator for a new one.' }, { status: 404 });
  const nm = String(name || '').trim().slice(0, 80);
  await q(
    `update users set password_hash = $1, invite_hash = null, invite_expires = null, last_seen = $2,
       name = case when $3 <> '' then $3 else name end
     where id = $4`,
    [hashPassword(pass), Date.now(), nm, u.id]
  );
  await setSession(u.id);
  return NextResponse.json({ user: { id: u.id, email: u.email, name: nm || u.name, role: u.role } });
}
