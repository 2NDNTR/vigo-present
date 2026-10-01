import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { q } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

/**
 * LOCKED OUT
 * ---------------------------------------------------------------------------
 * There is no invitation email in this product and no password reset email
 * either, which was fine until the first person forgot theirs — and the first
 * person to forget theirs was always going to be whoever set it up, because
 * they typed it once, months ago, on a day when they were doing twenty other
 * things.
 *
 * The way back in uses the one thing only an administrator has: the ability to
 * set an environment variable on the server. Put a long random string in
 * ADMIN_RESET_KEY, and holding that string is proof of being the person who
 * runs this. It is not a password, it is not stored next to one, and it
 * unlocks nothing by itself.
 *
 * What this route does is the smallest possible thing: it CLEARS a password.
 * It never sets one, never receives one, and never returns a session. The
 * account goes back to the state a new colleague is in — the next password
 * typed at the sign-in page becomes the password — which means the recovery
 * path and the ordinary first-sign-in path are the same path, already tested
 * every time someone joins.
 *
 * Leave ADMIN_RESET_KEY unset and this route does nothing at all.
 */

function keyMatches(given: string): boolean {
  const expected = process.env.ADMIN_RESET_KEY || '';
  /* A short key is not a key. Refusing here beats discovering later that the
   * way into the whole company's decks was eight characters someone picked in
   * a hurry. */
  if (expected.length < 16) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  /* Compare at a fixed length so the comparison itself does not leak how much
   * of a guess was right. */
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function POST(req: Request) {
  const { email, key } = await req.json().catch(() => ({}));
  const addr = String(email || '').trim().toLowerCase();
  const given = String(key || '');

  if (!process.env.ADMIN_RESET_KEY) {
    return NextResponse.json(
      {
        error:
          'Account recovery is not set up. Add ADMIN_RESET_KEY — a long random string — to the project settings on the server, then try again.',
      },
      { status: 501 }
    );
  }

  if (!addr || !given) {
    return NextResponse.json({ error: 'Enter the email address and the recovery key.' }, { status: 400 });
  }

  if (!keyMatches(given)) {
    /* Slow enough that guessing at it is pointless, short enough that a person
     * who fat-fingered their own key is not left wondering. */
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: 'That recovery key is not right.' }, { status: 401 });
  }

  const r = await q('update users set password_hash = null where email = $1 returning id', [addr]);
  if (!r.rowCount) {
    /* Safe to say: whoever is reading this already holds the server key. */
    return NextResponse.json({ error: 'No account here uses that email address.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
