import { NextResponse } from 'next/server';
import { signedIn } from '@/lib/server/access';
import { buildPlan } from '@/lib/server/v1import';

export const dynamic = 'force-dynamic';

/** The live site's media library as V2 will file it, with what is already here marked. Admins only. */
export async function GET() {
  const a = await signedIn();
  if (a instanceof Response) return a;
  if (!a.platformAdmin) return NextResponse.json({ error: 'Only an administrator can import the V1 library.' }, { status: 403 });
  try {
    return NextResponse.json(await buildPlan());
  } catch (e: any) {
    return NextResponse.json({ error: `The live site's library could not be read (${e?.message || 'network'}).` }, { status: 502 });
  }
}
