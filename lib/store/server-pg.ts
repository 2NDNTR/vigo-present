import type { Presentation } from '@/lib/model/types';

/**
 * Server persistence.
 * ---------------------------------------------------------------------------
 * The moment a Postgres connection string is present in the environment
 * (DATABASE_URL or POSTGRES_URL) the app switches from browser-local storage
 * to a real shared backend: multi-user dashboards and live share URLs that
 * work for anyone with the link. Nothing else in the codebase changes.
 */

export const CONN =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';

export const hasDatabase = () => Boolean(CONN);

let poolPromise: Promise<any> | null = null;
let migrated = false;

async function getPool(): Promise<any> {
  if (!poolPromise) {
    poolPromise = (async () => {
      const pg: any = await import('pg');
      const Pool = pg.Pool || pg.default?.Pool;
      return new Pool({
        connectionString: CONN,
        ssl: CONN.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
        max: 3,
      });
    })();
  }
  return poolPromise;
}

async function q(text: string, params: any[] = []) {
  const pool = await getPool();
  await migrate();
  return pool.query(text, params);
}

async function migrate() {
  if (migrated) return;
  migrated = true;
  const pool = await getPool();
  await pool.query(`
    create table if not exists presentations (
      id text primary key,
      org_id text not null default 'vigo-importing',
      title text not null,
      brand text not null,
      status text not null default 'draft',
      slug text unique,
      doc jsonb not null,
      created_by text,
      created_at bigint not null,
      updated_at bigint not null
    );
    create index if not exists presentations_org_idx on presentations(org_id, updated_at desc);
    create table if not exists presentation_versions (
      id text primary key,
      presentation_id text not null references presentations(id) on delete cascade,
      label text,
      created_at bigint not null,
      snapshot jsonb not null
    );
  `);
}

const row2doc = (r: any): Presentation => r.doc as Presentation;

export const serverStore = {
  async list(orgId = 'vigo-importing'): Promise<Presentation[]> {
    const r = await q('select doc from presentations where org_id = $1 order by updated_at desc', [orgId]);
    return r.rows.map(row2doc);
  },
  async get(id: string): Promise<Presentation | null> {
    const r = await q('select doc from presentations where id = $1', [id]);
    return r.rows[0] ? row2doc(r.rows[0]) : null;
  },
  async getBySlug(slug: string): Promise<Presentation | null> {
    const r = await q('select doc from presentations where slug = $1', [slug]);
    return r.rows[0] ? row2doc(r.rows[0]) : null;
  },
  async save(p: Presentation): Promise<void> {
    const doc = { ...p, updatedAt: Date.now() };
    await q(
      `insert into presentations (id, org_id, title, brand, status, slug, doc, created_by, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (id) do update set
         title = excluded.title, brand = excluded.brand, status = excluded.status,
         slug = excluded.slug, doc = excluded.doc, updated_at = excluded.updated_at`,
      [
        doc.id,
        doc.orgId || 'vigo-importing',
        doc.title,
        doc.brand,
        doc.status,
        doc.share?.slug || null,
        JSON.stringify(doc),
        doc.createdBy || null,
        doc.createdAt,
        doc.updatedAt,
      ]
    );
  },
  async remove(id: string): Promise<void> {
    await q('delete from presentations where id = $1', [id]);
  },
};
