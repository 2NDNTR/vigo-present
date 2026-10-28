import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';
import { audit, signedIn } from '@/lib/server/access';

export const dynamic = 'force-dynamic';

/**
 * MEDIA FOLDERS — added at will by the team.
 * A folder's name is the category its assets carry, so renaming a folder
 * re-files everything in it. The four core folders (Logos, Products,
 * Lifestyle, Video) can be renamed but not deleted; others can be deleted
 * once they are empty, so nothing is ever lost by tidying up.
 */
const CORE = ['logos', 'products', 'lifestyle', 'video'];

const canEdit = (a: Exclude<Awaited<ReturnType<typeof signedIn>>, Response>) =>
  a.platformAdmin || Object.values(a.brands).some((r) => r === 'editor' || r === 'brand_admin');

const clean = (s: unknown) =>
  String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);

export async function GET() {
  const a = await signedIn();
  if (a instanceof Response) return a;
  const r = await q('select id, name, sort from media_folders order by sort, lower(name)');
  return NextResponse.json({ folders: r.rows.map((f: any) => ({ ...f, core: CORE.includes(f.id) })) });
}

export async function POST(req: Request) {
  const a = await signedIn();
  if (a instanceof Response) return a;
  if (!canEdit(a)) return NextResponse.json({ error: 'You cannot add folders.' }, { status: 403 });
  const name = clean((await req.json().catch(() => ({}))).name);
  if (!name) return NextResponse.json({ error: 'Give the folder a name.' }, { status: 400 });
  const exists = await q('select id from media_folders where lower(name) = lower($1)', [name]);
  if (exists.rows.length) return NextResponse.json({ error: 'There is already a folder called that.' }, { status: 409 });
  const id = 'f_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  await q('insert into media_folders (id, name, sort, created_by, created_at) values ($1, $2, 100, $3, $4)', [id, name, a.user.id, Date.now()]);
  await audit(a.user.id, 'folder.create', id, { name });
  return NextResponse.json({ folder: { id, name, sort: 100, core: false } });
}

export async function PATCH(req: Request) {
  const a = await signedIn();
  if (a instanceof Response) return a;
  if (!canEdit(a)) return NextResponse.json({ error: 'You cannot rename folders.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = clean(body.name);
  const f = (await q('select id, name from media_folders where id = $1', [String(body.id || '')])).rows[0];
  if (!f) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!name) return NextResponse.json({ error: 'Give the folder a name.' }, { status: 400 });
  const clash = await q('select 1 from media_folders where lower(name) = lower($1) and id <> $2', [name, f.id]);
  if (clash.rows.length) return NextResponse.json({ error: 'There is already a folder called that.' }, { status: 409 });
  await q('update media_folders set name = $2 where id = $1', [f.id, name]);
  await q('update assets set category = $2 where category = $1', [f.name, name]);
  await audit(a.user.id, 'folder.rename', f.id, { from: f.name, to: name });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const a = await signedIn();
  if (a instanceof Response) return a;
  if (!canEdit(a)) return NextResponse.json({ error: 'You cannot delete folders.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id') || '';
  if (CORE.includes(id)) return NextResponse.json({ error: 'The core folders stay.' }, { status: 400 });
  const f = (await q('select name from media_folders where id = $1', [id])).rows[0];
  if (!f) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const n = (await q('select count(*)::int as n from assets where category = $1', [f.name])).rows[0].n;
  if (n > 0) return NextResponse.json({ error: `Move its ${n} ${n === 1 ? 'item' : 'items'} out first.` }, { status: 409 });
  await q('delete from media_folders where id = $1', [id]);
  await audit(a.user.id, 'folder.delete', id, { name: f.name });
  return NextResponse.json({ ok: true });
}
