import 'server-only';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { q } from './db';

/**
 * Sign-in for a small internal team.
 *
 * Passwords are hashed with scrypt from Node's own crypto — no dependency, and
 * no password is ever stored or logged in the clear. The session is a signed
 * httpOnly cookie rather than a database table, so it costs nothing to check on
 * a serverless request.
 *
 * A person is added by email with no password. The first time they sign in,
 * the password they type becomes their password. That avoids needing an email
 * service to send invitations.
 */

const COOKIE = 'vigo_session';
const DAYS = 30;

const secret = () => process.env.AUTH_SECRET || '';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/* ------------------------------------------------------------- passwords */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${key}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(key, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

/* --------------------------------------------------------------- cookie */

function sign(value: string): string {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function makeToken(userId: string): string {
  const expires = Date.now() + DAYS * 86_400_000;
  const body = `${userId}.${expires}`;
  return `${body}.${sign(body)}`;
}

function readToken(token: string | undefined): string | null {
  if (!token || !secret()) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expires, mac] = parts;
  const body = `${userId}.${expires}`;
  const expected = sign(body);
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  if (Number(expires) < Date.now()) return null;
  return userId;
}

export async function setSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, makeToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DAYS * 86_400,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/** The signed-in user, or null. Every protected route starts here. */
export async function currentUser(): Promise<SessionUser | null> {
  try {
    const jar = await cookies();
    const userId = readToken(jar.get(COOKIE)?.value);
    if (!userId) return null;
    const r = await q('select id, email, name, role from users where id = $1', [userId]);
    return r.rows[0] || null;
  } catch {
    return null;
  }
}

export function unauthorized() {
  return Response.json({ error: 'Not signed in' }, { status: 401 });
}

export const newId = (p: string) =>
  `${p}_${crypto.randomBytes(8).toString('hex')}`;
