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
/**
 * File storage is configured one of two ways. Stores connected before late
 * 2026 hand the project a read-write token; newer ones hand it only a store id
 * and the deployment signs in as itself (OIDC). @vercel/blob 2.x accepts
 * either, and so does everything here.
 */
export const blobMode = (): 'token' | 'oidc' | null =>
  process.env.BLOB_READ_WRITE_TOKEN ? 'token' : process.env.BLOB_STORE_ID ? 'oidc' : null;
export const hasBlob = () => blobMode() !== null;
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
        max: Number(process.env.PG_POOL_MAX || 3),
        idleTimeoutMillis: 10_000,
      });
    })();
  }
  return poolPromise;
}

/**
 * Applies every migration in `lib/server/migrations.ts` that this database has
 * not seen, once per cold start. An advisory lock serialises two instances
 * starting at the same moment; each step commits on its own, so a failure
 * leaves the database at the last good step and the next start retries.
 */
async function migrate(): Promise<void> {
  if (!migrated) {
    migrated = (async () => {
      const p = await pool();
      const { MIGRATIONS } = await import('./migrations');
      const client = await p.connect();
      try {
        await client.query('select pg_advisory_lock(727274)');
        await client.query(
          `create table if not exists schema_migrations (id text primary key, applied_at bigint not null)`
        );
        const done = new Set<string>(
          (await client.query('select id from schema_migrations')).rows.map((r: { id: string }) => r.id)
        );
        for (const m of MIGRATIONS) {
          if (done.has(m.id)) continue;
          await client.query('begin');
          try {
            if (m.sql) await client.query(m.sql);
            if (m.run) await m.run((text, params) => client.query(text, params as any[]));
            await client.query('insert into schema_migrations (id, applied_at) values ($1, $2)', [m.id, Date.now()]);
            await client.query('commit');
          } catch (e) {
            await client.query('rollback');
            throw new Error(`migration ${m.id} failed: ${(e as Error).message}`);
          }
        }
        await seedAdmin(client);
      } catch (e) {
        migrated = null; // let the next request try again rather than caching the failure
        throw e;
      } finally {
        await client.query('select pg_advisory_unlock(727274)').catch(() => {});
        client.release();
      }
    })();
  }
  return migrated;
}

/**
 * The first account, so somebody can get in and add everyone else. The id is
 * derived from the email (a changed ADMIN_EMAIL is a new row, not a primary
 * key collision), and a failure here is logged, never fatal.
 */
async function seedAdmin(client: any): Promise<void> {
  const admin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!admin) return;
  try {
    const { createHash } = await import('crypto');
    const adminId = 'usr_' + createHash('sha1').update(admin).digest('hex').slice(0, 16);
    await client.query(
      `insert into users (id, email, name, role, platform_admin, created_at)
       values ($1, $2, 'Administrator', 'admin', true, $3)
       on conflict (email) do update set role = 'admin', platform_admin = true`,
      [adminId, admin, Date.now()]
    );
  } catch (e) {
    console.error('admin seed failed (continuing):', e);
  }
}

export async function q(text: string, params: any[] = []): Promise<any> {
  const p = await pool();
  await migrate();
  return p.query(text, params);
}
