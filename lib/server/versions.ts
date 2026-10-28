import 'server-only';
import { q } from './db';

/** Snapshots the deck as stored right now. Returns the new version number. */
export async function writeVersion(id: string, label: string, reason: string, author: string, now: number): Promise<number> {
  const r = await q(
    `insert into presentation_versions (id, presentation_id, n, label, reason, snapshot, author_id, created_at)
     select 'ver_' || $1 || '_' || (coalesce(max(v.n), 0) + 1), $1, coalesce(max(v.n), 0) + 1, $2, $3,
            (select doc from presentations where id = $1), $4, $5
     from presentation_versions v where v.presentation_id = $1
     returning n`,
    [id, label, reason, author, now]
  );
  return r.rows[0].n;
}
