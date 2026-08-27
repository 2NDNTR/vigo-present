import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';
import { currentUser, unauthorized } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await currentUser();
  if (!me) return unauthorized();
  const r = await q(
    `select doc, version, updated_by, updated_at
     from presentations where org_id = $1 order by updated_at desc`,
    ['vigo-importing']
  );
  return NextResponse.json({
    presentations: r.rows.map((row: any) => ({ ...row.doc, version: row.version })),
  });
}

/**
 * Save. Everyone can edit everything, so the only real risk is two people
 * saving the same deck at once. Each save carries the version it was based on;
 * if the stored version has moved on, the save is refused rather than silently
 * overwriting somebody's work.
 */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: 'Missing presentation' }, { status: 400 });

  const now = Date.now();
  const base = Number(body.version || 0);
  const doc = { ...body };
  delete (doc as any).version;
  doc.updatedAt = now;

  const existing = await q('select version from presentations where id = $1', [body.id]);

  if (existing.rows.length === 0) {
    await q(
      `insert into presentations
         (id, org_id, title, brand, status, slug, locked, doc, version, created_by, updated_by, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$9,$10,$10)`,
      [
        doc.id,
        doc.orgId || 'vigo-importing',
        doc.title,
        doc.brand,
        doc.status,
        doc.share?.slug || null,
        !!doc.locked,
        JSON.stringify(doc),
        me.id,
        now,
      ]
    );
    return NextResponse.json({ ok: true, version: 1 });
  }

  const current = Number(existing.rows[0].version);
  if (base && base < current) {
    const latest = await q('select doc, version, updated_by from presentations where id = $1', [body.id]);
    const who = await q('select name, email from users where id = $1', [latest.rows[0].updated_by]);
    return NextResponse.json(
      {
        error: 'conflict',
        message: `This presentation was changed by ${who.rows[0]?.name || who.rows[0]?.email || 'someone else'} while you were editing.`,
        presentation: { ...latest.rows[0].doc, version: latest.rows[0].version },
      },
      { status: 409 }
    );
  }

  const next = current + 1;
  await q(
    `update presentations set
       title=$2, brand=$3, status=$4, slug=$5, locked=$6, doc=$7,
       version=$8, updated_by=$9, updated_at=$10
     where id=$1`,
    [
      doc.id,
      doc.title,
      doc.brand,
      doc.status,
      doc.share?.slug || null,
      !!doc.locked,
      JSON.stringify(doc),
      next,
      me.id,
      now,
    ]
  );
  return NextResponse.json({ ok: true, version: next });
}
