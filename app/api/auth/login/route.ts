import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';
import { hashPassword, setSession, verifyPassword } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  const addr = String(email || '').trim().toLowerCase();
  const pass = String(password || '');

  if (!addr || pass.length < 8) {
    return NextResponse.json(
      { error: 'Enter your email and a password of at least 8 characters.' },
      { status: 400 }
    );
  }

  const r = await q('select id, email, name, role, password_hash from users where email = $1', [addr]);
  const user = r.rows[0];
  if (!user) {
    // Deliberately vague: never reveal which emails exist.
    return NextResponse.json({ error: 'That email and password did not match.' }, { status: 401 });
  }

  if (!user.password_hash) {
    // First sign-in: the password they choose here becomes their password.
    await q('update users set password_hash = $1, last_seen = $2 where id = $3', [
      hashPassword(pass),
      Date.now(),
      user.id,
    ]);
    await setSession(user.id);
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      firstTime: true,
    });
  }

  if (!verifyPassword(pass, user.password_hash)) {
    return NextResponse.json({ error: 'That email and password did not match.' }, { status: 401 });
  }

  await q('update users set last_seen = $1 where id = $2', [Date.now(), user.id]);
  await setSession(user.id);
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}
