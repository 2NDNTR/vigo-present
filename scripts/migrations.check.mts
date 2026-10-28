/**
 * MIGRATION CHECK
 * Builds a database exactly as V1 leaves it — V1 schema, V1-shaped decks
 * including a plain-text password deck and an "internal" deck — then lets the
 * real runner in lib/server/db.ts bring it to V2, twice. Asserts that nothing
 * was lost, every V1 slug still resolves, and no plain-text password survives.
 *
 *   npx tsx --conditions=react-server scripts/migrations.check.ts
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import assert from 'node:assert/strict';

const port = 5491;
const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 5 });
await server.start();

process.env.POSTGRES_URL = `postgres://postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
process.env.PG_POOL_MAX = '2';
process.env.ADMIN_EMAIL = 'frank@example.com';

const { MIGRATIONS } = await import('../lib/server/migrations.ts');
const baseline = MIGRATIONS.find((m) => m.id === '0001_v1_baseline')!;

// ---- 1. the database as V1 leaves it (no schema_migrations table at all)
await db.exec(baseline.sql!);
const now = Date.now();
const deck = (id: string, brand: string, access: string, extra: Record<string, unknown> = {}) => ({
  id, orgId: 'vigo-importing', title: id, brand, status: 'published', createdBy: 'usr_ed', createdAt: now, updatedAt: now,
  share: { slug: id + '-slug', access, mode: 'scroll', ...extra },
  pages: [{ id: 'pg1', templateId: 'cover', background: { kind: 'theme' }, slots: {}, notes: 'internal speaker note' }],
});
await db.query(`insert into users (id,email,name,role,password_hash,created_at) values
  ('usr_admin','frank@example.com','Frank','admin','scrypt$x$y',$1),
  ('usr_ed','rep@example.com','Rep','editor',null,$1)`, [now]);
for (const [d, extra] of [
  [deck('caps', 'corporate', 'public'), {}],
  [deck('margins', 'alessi', 'password', { password: 'olive-oil-2026' }), {}],
  [deck('nopass', 'vigo', 'password'), {}],
  [deck('team-only', 'vigo', 'internal', { mode: 'slide' }), {}],
] as const) {
  void extra;
  await db.query(
    `insert into presentations (id,title,brand,status,slug,doc,created_by,updated_by,created_at,updated_at)
     values ($1,$1,$2,'published',$3,$4,'usr_ed','usr_ed',$5,$5)`,
    [d.id, d.brand, d.share.slug, JSON.stringify(d), now]
  );
}

// ---- 2. the real runner
const { q } = await import('../lib/server/db.ts');
await q('select 1');
const applied = (await db.query<{ id: string }>('select id from schema_migrations order by id')).rows.map((r) => r.id);
assert.deepEqual(applied, MIGRATIONS.map((m) => m.id), 'every migration recorded once');

// ---- 3. assertions
const count = async (sql: string) => Number(((await db.query<{ n: number }>(sql)).rows[0] as any).n);
assert.equal(await count('select count(*) n from presentations'), 4, 'no deck lost');
assert.equal(await count('select count(*) n from presentation_versions'), 4, 'every deck has a version 1');
assert.equal(await count('select count(*) n from brands'), 3);

const links = (await db.query<any>('select presentation_id, slug, access, layout, password_hash from share_links order by presentation_id')).rows;
const byId = Object.fromEntries(links.map((l) => [l.presentation_id, l]));
assert.equal(links.length, 4, 'every V1 slug kept');
assert.equal(byId.caps.access, 'public');
assert.equal(byId.margins.access, 'password');
assert.match(byId.margins.password_hash, /^scrypt\$/, 'deck password hashed');
assert.equal(byId.nopass.access, 'private', 'a password link with no password is closed, not opened');
assert.equal(byId['team-only'].access, 'private', 'internal becomes private');
assert.equal(byId['team-only'].layout, 'horizontal', 'slide mode becomes horizontal');

const { verifyPassword } = await import('../lib/server/passwords.ts');
assert.ok(verifyPassword('olive-oil-2026', byId.margins.password_hash), 'old password still opens the deck');
assert.equal(await count(`select count(*) n from presentations where doc->'share' ? 'password'`), 0, 'no plain-text password left');

const admin = (await db.query<any>(`select platform_admin from users where id='usr_admin'`)).rows[0];
assert.equal(admin.platform_admin, true, 'V1 admin becomes platform admin');
assert.equal(await count(`select count(*) n from memberships where user_id='usr_ed' and role='editor'`), 3, 'editors keep every brand');
assert.equal(await count(`select count(*) n from presentations where brand_id is null`), 0);

console.log(`migrations check: ${applied.length} migrations, all assertions passed`);
await server.stop();
process.exit(0);
