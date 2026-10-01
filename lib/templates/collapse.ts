import type { LayoutDef } from './registry';

/**
 * EMPTY COLUMNS CLOSE UP
 * ---------------------------------------------------------------------------
 * A layout like Product Family is three fixed columns with a slot in each.
 * Delete the third product and the grid still had three columns, so the page
 * showed two products and a hole — and the only way to get a proper two-up was
 * to change layout and move everything.
 *
 * That is backwards. The layout should follow the content: remove a product
 * and the remaining two should take the row. Nothing about the page's DATA
 * changes here — the slots still exist and still accept a drop the moment the
 * column comes back. This is purely how the grid is drawn for the content that
 * is currently in it.
 *
 * A column goes when everything in it is gone. An area that SPANS columns —
 * the heading across the top — does not hold a column open, because it
 * survives perfectly well in the columns that remain.
 */

/** Split a CSS track list on spaces, respecting minmax(0, 1fr) and friends. */
export function splitTracks(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of list.trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export interface Collapsed {
  columns: string;
  rows: string;
  areas: string[];
  /** slot keys that no longer appear anywhere in the grid */
  dropped: string[];
}

/**
 * @param isEmpty answers whether a slot key currently holds nothing at all.
 *                Judged on blocks present, not on whether they have content: a
 *                picture well waiting for a drop is a thing someone put there.
 */
export function collapseLayout(layout: LayoutDef, isEmpty: (key: string) => boolean): Collapsed {
  const rows = layout.areas.map((r) => r.trim().split(/\s+/));
  const cols = splitTracks(layout.columns);
  const width = rows[0]?.length || 0;

  /* A ragged areas list is a template bug, not something to half-render. */
  const rowTracks = splitTracks(layout.rows);
  if (
    !width ||
    cols.length !== width ||
    rowTracks.length !== rows.length ||
    rows.some((r) => r.length !== width)
  ) {
    return { columns: layout.columns, rows: layout.rows, areas: layout.areas, dropped: [] };
  }

  /* Where each area lives. An area in more than one column is spanning. */
  const span = new Map<string, Set<number>>();
  rows.forEach((r) =>
    r.forEach((name, c) => {
      if (name === '.') return;
      if (!span.has(name)) span.set(name, new Set());
      span.get(name)!.add(c);
    })
  );

  const removable: boolean[] = cols.map((_, c) =>
    rows.every((r) => {
      const name = r[c];
      if (name === '.') return true;
      if (isEmpty(name)) return true;
      /* Holds content, but reaches other columns — it will still be drawn. */
      return (span.get(name)?.size || 1) > 1;
    })
  );

  const keep = cols.map((_, c) => !removable[c]);
  /* Never collapse to nothing: an empty page is still a page, and a grid with
   * no columns cannot be dropped onto to stop being empty. */
  if (!keep.some(Boolean)) return { columns: layout.columns, rows: layout.rows, areas: layout.areas, dropped: [] };
  if (keep.every(Boolean)) return { columns: layout.columns, rows: layout.rows, areas: layout.areas, dropped: [] };

  const nextCols = cols.filter((_, c) => keep[c]);
  const nextRows = rows.map((r) => r.filter((_, c) => keep[c]));

  /* A row of nothing but dots is a row that only existed for the column that
   * went. Leaving it in would hold open a band of empty page — and its track
   * has to go with it, or the grid keeps the height anyway. */
  const liveIdx = nextRows.map((r, i) => (r.some((n) => n !== '.') ? i : -1)).filter((i) => i >= 0);
  const liveRows = liveIdx.map((i) => nextRows[i]);

  const stillThere = new Set<string>();
  liveRows.forEach((r) => r.forEach((n) => n !== '.' && stillThere.add(n)));

  return {
    columns: nextCols.join(' '),
    rows: liveIdx.map((i) => rowTracks[i]).join(' '),
    areas: liveRows.map((r) => r.join(' ')),
    dropped: [...span.keys()].filter((k) => !stillThere.has(k)),
  };
}
