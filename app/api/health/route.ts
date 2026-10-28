import { NextResponse } from 'next/server';
import { blobMode, hasBlob, hasDatabase, hasSecret, q } from '@/lib/server/db';
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

  // Can this deployment actually reach its file storage? One tiny listing.
  let storage: 'ok' | 'unconfigured' | string = 'unconfigured';
  if (blob) {
    try {
      const { list } = await import('@vercel/blob');
      await list({ limit: 1 });
      storage = 'ok';
    } catch (e) {
      storage = 'error: ' + String((e as Error).message).slice(0, 160);
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
      blobMode: blobMode(),
      storage,
      schema,
      missing: [
        !database && 'POSTGRES_URL',
        !secret && 'AUTH_SECRET',
        !blob && 'BLOB_STORE_ID or BLOB_READ_WRITE_TOKEN',
        !ai && 'ANTHROPIC_API_KEY',
      ].filter(Boolean),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
