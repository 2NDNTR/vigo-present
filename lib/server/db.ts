import 'server-only';

/**
 * SHARED BACKEND — Postgres
 * ---------------------------------------------------------------------------
 * One database for the whole company. Every presentation, every user and every
 * uploaded asset lives here, so an edit made by anyone is the edit everyone
 * sees. Nothing is stored per-browser any more.
 *
 * Configured entirely by environment variables, so there are no credentials in
 * the codebase:
 *   <a Postgres URL>       set automatically by whichever Postgres provider is
 *                          connected — see CONN_VARS below
 *   BLOB_READ_WRITE_TOKEN  set automatically by Vercel Blob
 *   AUTH_SECRET            any long random string — signs the session cookie
 *   ADMIN_EMAIL            the first account, created on first run
 *
 * PROVIDER-AGNOSTIC ON PURPOSE. Vercel no longer sells its own Postgres; the
 * database now comes from a marketplace provider (Neon, Supabase, Prisma,
 * Nile…) and each one names its connection string differently. Rather than
 * pinning the app to one vendor, every known spelling is accepted in order of
 * preference — pooled first, because serverless functions open and close
 * connections constantly and a direct connection runs out of slots.
 */

const CONN_VARS = [
  'POSTGRES_URL',            // Vercel Postgres, Supabase, Neon (compat)
  'DATABASE_URL',            // Neon native, Prisma Postgres, most others
  'POSTGRES_PRISMA_URL',     // Supabase/Neon, pooled + pgbouncer flags
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL_UNPOOLED',
  'NEON_DATABASE_URL',
  'DATABASE_POSTGRES_URL',
] as const;

/** Which env var the connection string came from — for /api/health only. */
export const CONN_VAR = CONN_VARS.find((k) => (process.env[k] || '').trim()) || '';
export const CONN = CONN_VAR ? String(process.env[CONN_VAR]).trim() : '';

export const hasDatabase = () => Boolean(CONN);
export const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
export const hasSecret = () => Boolean(process.env.AUTH_SECRET);

/**
 * Forces `sslmode=no-verify` — encrypted, but without the CA check that
 * managed Postgres providers cannot satisfy. Leaves `sslmode=disable` alone so
 * a local, unencrypted development database still works.
 */
function sslRelaxed(url: string): string {
  if (!url || url.includes('sslmode=disable')) return url;
  if (/[?&]sslmode=/.test(url)) return url.replace(/sslmode=[A-Za-z-]+/g, 'sslmode=no-verify');
  return url + (url.includes('?') ? '&' : '?') + 'sslmode=no-verify';
}

let poolPromise: Promise<any> | null = null;
let migrated: Promise<void> | null = null;

async function pool(): Promise<any> {
  if (!poolPromise) {
    poolPromise = (async () => {
      const pg: any = await import('pg');
      const Pool = pg.Pool || pg.default?.Pool;
      return new Pool({
        // `sslmode=require` is rewritten to `no-verify` on purpose.
        //
        // Supabase, Neon and friends terminate TLS with a certificate signed by
        // their own internal CA, which is not in Node's trust store. Up to
        // pg 8.13 `sslmode=require` meant "encrypt, don't verify" and this was
        // a non-issue. pg 8.14 changed it to verify the chain, so the same
        // connection string that used to work now dies with
        // "self-signed certificate in certificate chain".
        //
        // The `ssl` option below does NOT rescue it: a `sslmode` in the
        // connection string is parsed later and wins. So the mode is rewritten
        // in the string itself. The traffic is still encrypted — only the CA
        // check is skipped, which is what every managed provider expects.
        connectionString: sslRelaxed(CONN),
        ssl: CONN.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
        max: 3,
        idleTimeoutMillis: 10_000,
      });
    })();
  }
  return poolPromise;
}

async function migrate(): Promise<void> {
  if (!migrated) {
    migrated = (async () => {
      const p = await pool();
      await p.query(`
        create table if not exists users (
          id            text primary key,
          email         text unique not null,
          name          text not null default '',
          password_hash text,
          role          text not null default 'editor',
          created_at    bigint not null,
          last_seen     bigint
        );

        create table if not exists presentations (
          id          text primary key,
          org_id      text not null default 'vigo-importing',
          title       text not null,
          brand       text not null,
          status      text not null default 'draft',
          slug        text unique,
          locked      boolean not null default false,
          doc         jsonb not null,
          version     integer not null default 1,
          created_by  text,
          updated_by  text,
          created_at  bigint not null,
          updated_at  bigint not null
        );
        create index if not exists presentations_org_idx
          on presentations(org_id, updated_at desc);

        create table if not exists assets (
          id          text primary key,
          brand       text not null,
          category    text not null,
          name        text not null,
          file_name   text not null,
          url         text not null,
          kind        text not null default 'image',
          width       integer,
          height      integer,
          size        bigint,
          uploaded_by text,
          created_at  bigint not null
        );
        create index if not exists assets_brand_idx on assets(brand, category);
      `);

      // The first account, so somebody can get in and add everyone else.
      //
      // The id is DERIVED FROM THE EMAIL rather than a fixed 'usr_admin'.
      // With a fixed id, changing ADMIN_EMAIL made this insert collide on the
      // primary key — the old row still held that id under the old address —
      // and because the seed runs inside the migration, that single failure
      // took down every database call in the app. A per-email id cannot
      // collide: a new address is simply a new row.
      //
      // The whole seed is also non-fatal. Being unable to create the first
      // account is worth logging, but it must never stop the app from serving
      // people who already have one.
      const admin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      if (admin) {
        const { createHash } = await import('crypto');
        const adminId = 'usr_' + createHash('sha1').update(admin).digest('hex').slice(0, 16);
        try {
          await p.query(
            `insert into users (id, email, name, role, created_at)
             values ($1, $2, $3, 'admin', $4)
             on conflict (email) do update set role = 'admin'`,
            [adminId, admin, 'Administrator', Date.now()]
          );
        } catch (e) {
          console.error('admin seed failed (continuing):', e);
        }
      }
    })();
  }
  return migrated;
}

export async function q(text: string, params: any[] = []): Promise<any> {
  const p = await pool();
  await migrate();
  return p.query(text, params);
}
