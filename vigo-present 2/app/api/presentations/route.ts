import { NextResponse } from 'next/server';
import { hasDatabase, serverStore } from '@/lib/store/server-pg';

export const dynamic = 'force-dynamic';

function noDb() {
  return NextResponse.json(
    { error: 'No database configured. Set DATABASE_URL to enable the shared backend.' },
    { status: 501 }
  );
}

export async function GET() {
  if (!hasDatabase()) return noDb();
  const presentations = await serverStore.list();
  return NextResponse.json({ presentations });
}

export async function POST(req: Request) {
  if (!hasDatabase()) return noDb();
  const body = await req.json();
  await serverStore.save(body);
  return NextResponse.json({ ok: true });
}
