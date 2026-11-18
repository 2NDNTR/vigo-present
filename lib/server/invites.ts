import 'server-only';
import crypto from 'crypto';
import { q } from '@/lib/server/db';

/**
 * INVITE LINKS
 * An account with no password can only be set up through a link an
 * administrator handed over. The token is 32 random bytes; only its SHA-256 is
 * kept, it expires after seven days, and using it clears it.
 */
export const INVITE_DAYS = 7;

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export async function makeInvite(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await q('update users set invite_hash = $1, invite_expires = $2 where id = $3', [
    hash(token),
    Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000,
    userId,
  ]);
  return token;
}

export async function findInvite(token: string): Promise<{ id: string; email: string; name: string; role: string } | null> {
  if (!/^[A-Za-z0-9_-]{30,80}$/.test(token || '')) return null;
  const r = await q(
    'select id, email, name, role from users where invite_hash = $1 and invite_expires > $2',
    [hash(token), Date.now()]
  );
  return r.rows[0] || null;
}

/** The address an invite link is opened at, taken from the request. */
export function inviteUrl(req: Request, token: string): string {
  const u = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || u.host;
  const proto = req.headers.get('x-forwarded-proto') || u.protocol.replace(':', '');
  return `${proto}://${host}/invite/${token}`;
}

/** True until somebody has a password: the very first administrator may still claim their account. */
export async function stillBootstrapping(): Promise<boolean> {
  const r = await q('select count(*)::int as n from users where password_hash is not null');
  return (r.rows[0]?.n || 0) === 0;
}
