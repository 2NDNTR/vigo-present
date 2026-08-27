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
 *   POSTGRES_URL           set automatically by Vercel Postgres
 *   BLOB_READ_WRITE_TOKEN  set automatically by Vercel Blob
 *   AUTH_SECRET            any long random string — signs the session cookie
 *   ADMIN_EMAIL            the first account, created on first run
 */

export const CONN =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  '';

export const hasDatabase = () => Boolean(CONN);
export const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
export const hasSecret = () => Boolean(process.env.AUTH_SECRET);

let poolPromise: Promise<any> | null = null;
let migrated: Promise<void> | null = null;

async function pool(): Promise<any> {
  if (!poolPromise) {
    poolPromise = (async () => {
      const pg: any = await import('pg');
      const Pool = pg.Pool || pg.default?.Pool;
      return new Pool({
        connectionString: CONN,
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
      const admin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      if (admin) {
        await p.query(
          `insert into users (id, email, name, role, created_at)
           values ($1, $2, $3, 'admin', $4)
           on conflict (email) do update set role = 'admin'`,
          ['usr_admin', admin, 'Administrator', Date.now()]
        );
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
