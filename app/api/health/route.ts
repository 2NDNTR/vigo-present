import { NextResponse } from 'next/server';
import { hasBlob, hasDatabase, hasSecret, q } from '@/lib/server/db';
import { MIGRATIONS } from '@/lib/server/migrations';

export const dynamic = 'force-dynamic';

/**
 * Says exactly which pieces of the backend are configured, so a
 * misconfiguration is visible instead of mysterious.
 *
 * `schema` says whether the database is reachable and up to date: the number
 * of migrations applied against the number this build ships. Asking runs any
 * that are missing, so the first health check after a deploy is also the one
 * that brings the database up to date.
 */
export async function GET() {
  const database = hasDatabase();
  const blob = hasBlob();
  const secret = hasSecret();
  const ai = Boolean(process.env.ANTHROPIC_API_KEY);

  let schema: { applied: number; expected: number; error?: string } | null = null;
  if (database) {
    try {
      const r = await q('select count(*)::int as n from schema_migrations');
      schema = { applied: r.rows[0].n, expected: MIGRATIONS.length };
    } catch (e) {
      // the message names the failing step, never a credential
      schema = { applied: 0, expected: MIGRATIONS.length, error: String((e as Error).message).slice(0, 200) };
    }
  }

  return NextResponse.json(
    {
      ok: true,
      backend: database && secret ? 'postgres' : 'none',
      database,
      blob,
      secret,
      ai,
      // temporary: is the misspelled Blob variable present and non-empty?
      blobAlias: (process.env.BLOG_READ_WRITE_TOKEN || '').startsWith('vercel_blob_rw_') ? 'ok' : process.env.BLOG_READ_WRITE_TOKEN ? 'unexpected-format' : 'absent',
      schema,
      missing: [
        !database && 'POSTGRES_URL',
        !secret && 'AUTH_SECRET',
        !blob && 'BLOB_READ_WRITE_TOKEN',
        !ai && 'ANTHROPIC_API_KEY',
      ].filter(Boolean),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
