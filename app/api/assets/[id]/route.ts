import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';
import { currentUser, unauthorized } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return unauthorized();
  const { id } = await ctx.params;
  const r = await q('select url from assets where id = $1', [id]);
  await q('delete from assets where id = $1', [id]);
  // Remove the underlying file too, so storage does not grow forever.
  try {
    if (r.rows[0]?.url && process.env.BLOB_READ_WRITE_TOKEN) {
      const { del } = await import('@vercel/blob');
      await del(r.rows[0].url);
    }
  } catch {
    /* the record is gone either way */
  }
  return NextResponse.json({ ok: true });
}
