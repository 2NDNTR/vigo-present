import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';
import { audit, can, forbidden, signedIn, visibleBrands } from '@/lib/server/access';

export const dynamic = 'force-dynamic';

/**
 * Every deck the person can see, newest first. Archived decks are left out
 * unless asked for (`?archived=1`), which is what makes delete recoverable.
 */
export async function GET(req: Request) {
  const a = await signedIn();
  if (a instanceof Response) return a;
  const archived = new URL(req.url).searchParams.get('archived') === '1';
  const brands = visibleBrands(a);
  const r = await q(
    `select doc, version, updated_by, updated_at, archived_at
     from presentations
     where org_id = $1
       and (archived_at is not null) = $2
       and ($3::text[] is null or coalesce(brand_id, brand) = any($3))
     order by updated_at desc`,
    ['vigo-importing', archived, brands === 'all' ? null : brands]
  );
  return NextResponse.json({
    presentations: r.rows.map((row: any) => ({ ...row.doc, version: row.version, archivedAt: row.archived_at || undefined })),
  });
}

/**
 * Save. Each save carries the version it was based on; if the stored version
 * has moved on, the save is refused with the newer document rather than
 * silently overwriting somebody's work.
 *
 * The person needs edit rights on the brand the deck is in now AND on the
 * brand it is being moved to, so a deck cannot be carried out of a brand by
 * someone who only edits the destination.
 */
export async function POST(req: Request) {
  const a = await signedIn();
  if (a instanceof Response) return a;
  const me = a.user;

  const body = await req.json().catch(() => null);
  if (!body?.id || typeof body.id !== 'string') return NextResponse.json({ error: 'Missing presentation' }, { status: 400 });
  if (!can(a, body.brand, 'edit')) return forbidden('You cannot edit presentations in this brand.');

  const now = Date.now();
  const base = Number(body.version || 0);
  const doc = { ...body };
  delete doc.version;
  delete doc.archivedAt;
  // Share passwords live hashed in share_links. A plain one never reaches the database.
  if (doc.share && typeof doc.share === 'object') {
    doc.share = { ...doc.share };
    delete doc.share.password;
  }
  doc.updatedAt = now;

  const existing = await q(
    'select version, coalesce(brand_id, brand) as brand, archived_at from presentations where id = $1',
    [body.id]
  );

  if (existing.rows.length === 0) {
    await q(
      `insert into presentations
         (id, org_id, title, brand, brand_id, status, slug, locked, doc, version, created_by, updated_by, created_at, updated_at)
       values ($1,$2,$3,$4,$4,$5,$6,$7,$8,1,$9,$9,$10,$10)`,
      [doc.id, 'vigo-importing', doc.title, doc.brand, doc.status, doc.share?.slug || null, !!doc.locked, JSON.stringify(doc), me.id, now]
    );
    await q(
      `insert into presentation_versions (id, presentation_id, n, label, reason, snapshot, author_id, created_at)
       values ($1, $2, 1, 'Created', 'checkpoint', $3, $4, $5) on conflict do nothing`,
      ['ver_' + doc.id + '_1', doc.id, JSON.stringify(doc), me.id, now]
    );
    await syncPrimaryLink(doc, me.id, now);
    await audit(me.id, 'presentation.create', doc.id, { brand: doc.brand });
    return NextResponse.json({ ok: true, version: 1 });
  }

  const row = existing.rows[0];
  if (!can(a, row.brand, 'edit')) return forbidden('You cannot edit presentations in this brand.');
  if (row.archived_at) return NextResponse.json({ error: 'This presentation is archived. Restore it first.' }, { status: 409 });

  const current = Number(row.version);
  if (base && base < current) return conflict(body.id);

  // Compare-and-set: the version in the WHERE clause closes the gap between
  // reading it above and writing here, so two simultaneous saves cannot both win.
  const next = current + 1;
  const upd = await q(
    `update presentations set
       title=$2, brand=$3, brand_id=$3, status=$4, slug=$5, locked=$6, doc=$7,
       version=$8, updated_by=$9, updated_at=$10
     where id=$1 and version=$11`,
    [doc.id, doc.brand, doc.status, doc.share?.slug || null, !!doc.locked, JSON.stringify(doc), next, me.id, now, current]
  );
  if (!upd.rowCount) return conflict(body.id);

  await syncPrimaryLink(doc, me.id, now);
  if (doc.brand !== row.brand) await audit(me.id, 'presentation.move', doc.id, { from: row.brand, to: doc.brand });
  return NextResponse.json({ ok: true, version: next });
}

async function conflict(id: string) {
  const latest = await q('select doc, version, updated_by from presentations where id = $1', [id]);
  const who = await q('select name, email from users where id = $1', [latest.rows[0]?.updated_by]);
  return NextResponse.json(
    {
      error: 'conflict',
      message: `This presentation was changed by ${who.rows[0]?.name || who.rows[0]?.email || 'someone else'} while you were editing.`,
      presentation: { ...latest.rows[0].doc, version: latest.rows[0].version },
    },
    { status: 409 }
  );
}

/**
 * Keeps the deck's first share link in step with the share panel's slug,
 * access and layout. A password set in the panel goes through
 * /api/presentations/:id/share, which hashes it; this never touches the hash.
 */
async function syncPrimaryLink(doc: any, userId: string, now: number) {
  if (!doc.share?.slug) return;
  const args = ['shl_' + doc.id, doc.id, doc.share.slug, accessOf(doc.share.access), layoutOf(doc.share.mode), userId, now];
  try {
    await q(
      `insert into share_links (id, presentation_id, slug, access, layout, created_by, created_at)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (id) do update set slug = excluded.slug, access = excluded.access, layout = excluded.layout`,
      args
    );
  } catch {
    // The slug is taken — most often by this deck's own revoked link, sent back
    // by an editor tab that has not seen the revoke yet. A revoked slug must
    // never come back to life, so keep the current one and update the rest.
    await q(`update share_links set access = $2, layout = $3 where id = $1`, [args[0], args[3], args[4]]);
  }
}

const accessOf = (v: unknown) =>
  v === 'password' ? 'password' : v === 'internal' || v === 'private' ? 'private' : 'public';
const layoutOf = (v: unknown) => (v === 'slide' || v === 'horizontal' ? 'horizontal' : 'vertical');
