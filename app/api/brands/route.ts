import { NextResponse } from 'next/server';
import { q } from '@/lib/server/db';
import { signedIn, visibleBrands } from '@/lib/server/access';

export const dynamic = 'force-dynamic';

/** The brands this person can see, with what is in each and their role in it. */
export async function GET() {
  const a = await signedIn();
  if (a instanceof Response) return a;
  const vis = visibleBrands(a);
  const r = await q(
    `select b.id, b.name, b.short_name, b.description,
            (select count(*)::int from presentations p
              where coalesce(p.brand_id, p.brand) = b.id and p.archived_at is null) as decks,
            (select count(*)::int from presentations p
              where coalesce(p.brand_id, p.brand) = b.id and p.archived_at is null and p.status = 'published') as live,
            (select count(*)::int from assets s where s.brand = b.id) as assets,
            (select max(p.updated_at) from presentations p
              where coalesce(p.brand_id, p.brand) = b.id and p.archived_at is null) as last_activity
     from brands b
     where not b.archived and ($1::text[] is null or b.id = any($1))
     order by case b.id when 'corporate' then 0 when 'vigo' then 1 when 'alessi' then 2 else 3 end, b.name`,
    [vis === 'all' ? null : vis]
  );
  return NextResponse.json({
    brands: r.rows.map((b: any) => ({
      ...b,
      last_activity: b.last_activity ? Number(b.last_activity) : null,
      role: a.platformAdmin ? 'platform_admin' : a.brands[b.id],
    })),
  });
}
