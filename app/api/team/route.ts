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
  if (!me.platform_admin) return NextResponse.json({ error: 'Only an administrator can add people.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const { email, name } = body || {};
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
  // Brand access: what the admin chose, or editor on every brand (V1's behaviour).
  const role = ['brand_admin', 'editor', 'viewer'].includes(body?.role) ? body.role : 'editor';
  await q(
    `insert into memberships (user_id, brand_id, role, created_at)
     select u.id, b.id, $2, $3 from users u, brands b
     where u.email = $1 and ($4::text[] is null or b.id = any($4)) and not b.archived
     on conflict do nothing`,
    [addr, role, Date.now(), Array.isArray(body?.brands) ? body.brands : null]
  );
  return NextResponse.json({ ok: true });
}

/**
 * Reset a colleague's password — which means CLEAR it, never set it. Their
 * next sign-in chooses a new one, exactly as a new joiner's does.
 *
 * Administrators only. Letting any member clear any other member's password
 * would make every account as strong as the weakest one, and the first thing
 * anyone could do with an editor's account is take the owner's.
 */
export async function PATCH(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();
  if (!me.platform_admin) {
    return NextResponse.json({ error: 'Only an administrator can reset a password.' }, { status: 403 });
  }
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'Missing account' }, { status: 400 });
  const r = await q('update users set password_hash = null where id = $1 returning email', [id]);
  if (!r.rowCount) return NextResponse.json({ error: 'No such account.' }, { status: 404 });
  return NextResponse.json({ ok: true, email: r.rows[0].email });
}

export async function DELETE(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();
  if (!me.platform_admin) return NextResponse.json({ error: 'Only an administrator can remove people.' }, { status: 403 });
  const { id } = await req.json().catch(() => ({}));
  if (!id || id === me.id) {
    return NextResponse.json({ error: 'You cannot remove your own account.' }, { status: 400 });
  }
  await q('delete from users where id = $1', [id]);
  return NextResponse.json({ ok: true });
}
