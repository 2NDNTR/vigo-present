import { NextResponse } from 'next/server';
import { hasDatabase } from '@/lib/store/server-pg';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ ok: true, backend: hasDatabase() ? 'postgres' : 'none' });
}
