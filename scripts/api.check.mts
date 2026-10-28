/**
 * API CHECK — the deck lifecycle, end to end, against a running server.
 *
 *   npm run db:dev            (in one terminal: a throwaway Postgres)
 *   POSTGRES_URL=postgres://postgres@127.0.0.1:5433/postgres?sslmode=disable \
 *   AUTH_SECRET=local-only-secret-local-only-secret ADMIN_EMAIL=admin@vigo.test npm run dev
 *   BASE=http://localhost:3000 ADMIN_EMAIL=admin@vigo.test npx tsx scripts/api.check.mts
 *
 * Every step asserts what a person would notice if it broke: a save that does
 * not stick, a conflict that overwrites, a password link that opens without
 * the password, a revoked link that still works.
 */
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://localhost:3000';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@vigo.test';
const PASS = process.env.CHECK_PASSWORD || 'local-check-password';

let cookie = '';
async function call(method: string, path: string, body?: unknown, jar = cookie) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(jar ? { cookie: jar } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: r.status, json, headers: r.headers };
}
const step = (s: string) => console.log('  ✓ ' + s);

// sign in (first sign-in sets the password)
const login = await fetch(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
});
assert.equal(login.status, 200, 'sign in');
cookie = (login.headers.get('set-cookie') || '').split(';')[0];
step('signed in');

const id = 'pres_check' + Math.random().toString(36).slice(2, 8);
const slug = 'check-' + id.slice(-6);
const deck = {
  id,
  orgId: 'vigo-importing',
  title: 'API check deck',
  brand: 'alessi',
  status: 'draft',
  share: { slug, access: 'public', mode: 'scroll' },
  pages: [
    {
      id: 'pg1',
      templateId: 'cover',
      background: { kind: 'theme' },
      slots: { main: [{ id: 'b1', type: 'text', text: 'Hello' }] },
      notes: 'speaker note that must never reach a recipient',
    },
  ],
  createdBy: 'check',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// create
let r = await call('POST', '/api/presentations', deck);
assert.equal(r.status, 200, 'create');
assert.equal(r.json.version, 1);
step('created at version 1');

// edit, title included
r = await call('POST', '/api/presentations', { ...deck, title: 'Renamed deck', version: 1 });
assert.equal(r.status, 200, 'edit saves: ' + JSON.stringify(r.json));
assert.equal(r.json.version, 2);
r = await call('GET', '/api/presentations/' + id);
assert.equal(r.json.presentation.title, 'Renamed deck', 'edit sticks');
step('edited, saved and read back');

// a stale save is refused with the newer deck, never applied
r = await call('POST', '/api/presentations', { ...deck, title: 'Stale write', version: 1 });
assert.equal(r.status, 409, 'stale save refused');
assert.equal(r.json.presentation.title, 'Renamed deck');
step('stale save refused with 409');

// versions: save one, restore it, and the restore is itself undoable
r = await call('POST', `/api/presentations/${id}/versions`, { label: 'Before big change' });
assert.equal(r.status, 200);
const saved = r.json.n;
r = await call('POST', '/api/presentations', { ...deck, title: 'After big change', version: 2 });
assert.equal(r.status, 200);
r = await call('POST', `/api/presentations/${id}/versions`, { restore: saved });
assert.equal(r.status, 200);
assert.equal(r.json.presentation.title, 'Renamed deck', 'restore brings the old content back');
r = await call('GET', `/api/presentations/${id}/versions`);
assert.ok(r.json.versions.some((v: any) => v.label.startsWith('Before restoring')), 'restore saved the current deck first');
step('version saved, restored, and the restore is recoverable');

// unpublished decks are not reachable by link
r = await call('GET', '/api/public/' + slug, undefined, '');
assert.equal(r.status, 404, 'draft link closed');
step('draft link is closed');

// publish → link opens, without notes, and a version is kept
const cur = (await call('GET', '/api/presentations/' + id)).json.presentation;
r = await call('POST', '/api/presentations', { ...cur, status: 'published' });
assert.equal(r.status, 200, 'publish');
r = await call('GET', '/api/public/' + slug, undefined, '');
assert.equal(r.status, 200, 'published link opens');
assert.ok(!JSON.stringify(r.json).includes('speaker note'), 'notes never sent');
assert.ok(!('createdBy' in r.json.presentation), 'author never sent');
assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');
r = await call('GET', `/api/presentations/${id}/versions`);
assert.ok(r.json.versions.some((v: any) => v.reason === 'publish'), 'publish kept a version');
step('published: link opens, carries no notes or author, version kept');

// password link
r = await call('PUT', `/api/presentations/${id}/share`, { access: 'password', password: 'olive-oil-2026' });
assert.equal(r.status, 200);
r = await call('GET', '/api/public/' + slug, undefined, '');
assert.equal(r.status, 401, 'password link closed without password');
assert.equal(r.json.presentation, null);
r = await call('POST', '/api/public/' + slug, { password: 'wrong' }, '');
assert.equal(r.status, 401, 'wrong password refused');
const unlock = await fetch(BASE + '/api/public/' + slug, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ password: 'olive-oil-2026' }),
});
assert.equal(unlock.status, 200, 'right password accepted');
const unlockCookie = (unlock.headers.get('set-cookie') || '').split(';')[0];
r = await call('GET', '/api/public/' + slug, undefined, unlockCookie);
assert.equal(r.status, 200, 'unlocked link opens');
step('password link: closed, wrong refused, right opens');

// revoke: old link dies, new one works
r = await call('DELETE', `/api/presentations/${id}/share`);
assert.equal(r.status, 200);
const fresh = r.json.slug;
r = await call('GET', '/api/public/' + slug, undefined, unlockCookie);
assert.equal(r.status, 404, 'revoked link dead');
await call('PUT', `/api/presentations/${id}/share`, { access: 'public' });
r = await call('GET', '/api/public/' + fresh, undefined, '');
assert.equal(r.status, 200, 'replacement link works');
step('revoked: old link dead, new link live');

// archive and restore
r = await call('DELETE', '/api/presentations/' + id);
assert.equal(r.json.archived, true);
r = await call('GET', '/api/presentations');
assert.ok(!r.json.presentations.some((p: any) => p.id === id), 'archived deck leaves the list');
r = await call('GET', '/api/public/' + fresh, undefined, '');
assert.equal(r.status, 404, 'archived deck link closed');
r = await call('PATCH', '/api/presentations/' + id, { restore: true });
assert.equal(r.status, 200);
r = await call('GET', '/api/public/' + fresh, undefined, '');
assert.equal(r.status, 200, 'restored deck link back');
step('archived (link closed) and restored (link back)');

// signed out: nothing private answers
r = await call('GET', '/api/presentations', undefined, '');
assert.equal(r.status, 401);
r = await call('GET', '/api/assets', undefined, '');
assert.equal(r.status, 401);
step('signed-out requests refused');

console.log('\napi check: all steps passed');
