import { NextResponse } from 'next/server';
import { hasBlob, hasDatabase, hasSecret } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

/**
 * Says exactly which pieces of the backend are configured, so a
 * misconfiguration is visible instead of mysterious.
 */
export async function GET() {
  const database = hasDatabase();
  const blob = hasBlob();
  const secret = hasSecret();
  return NextResponse.json({
    ok: true,
    backend: database && secret ? 'postgres' : 'none',
    database,
    blob,
    secret,
    missing: [
      !database && 'POSTGRES_URL',
      !secret && 'AUTH_SECRET',
      !blob && 'BLOB_READ_WRITE_TOKEN',
    ].filter(Boolean),
  });
}
