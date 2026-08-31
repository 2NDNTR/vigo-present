'use client';

/**
 * SPREADSHEET INGEST
 * ---------------------------------------------------------------------------
 * Reads .xlsx / .csv / .tsv in the BROWSER and hands back a clean rectangle of
 * data: one header row and the body beneath it.
 *
 * No library. An .xlsx is a ZIP of XML, and every browser this app supports can
 * already do both halves of that: DecompressionStream('deflate-raw') inflates
 * the entries, DOMParser reads the sheet. Adding SheetJS would have meant ~1 MB
 * of JavaScript, and a dependency, to do what the platform does natively.
 *
 * Parsing client-side is also the right call for the data itself. A rep's sales
 * export can carry margins, costs and account names; it never leaves their
 * machine, and the deck only ever stores the cells they chose to show.
 *
 * The hard part is not reading the file — it is finding the data inside it.
 * Real exports arrive with title banners, blank spacer rows, merged headings,
 * footnotes and a "TOTAL" line. `findTable` is the part that earns its keep.
 */

export type CellType = 'text' | 'number' | 'currency' | 'percent' | 'date';

export interface SheetTable {
  headers: string[];
  rows: string[][];
  /** per column, inferred from the body — drives alignment and formatting */
  types: CellType[];
  /** rows that read as totals/subtotals, kept separate so they can be styled */
  totalRow?: string[];
  meta: {
    sheetName?: string;
    /** how many rows above the header were discarded as banner/junk */
    skippedTop: number;
    droppedEmptyCols: number;
    sourceRows: number;
  };
}

/* ------------------------------------------------------------------ zip ---- */

const dv = (b: ArrayBuffer) => new DataView(b);

/**
 * Minimal ZIP reader: walks the central directory, returns the named entries.
 * Only the two compression methods a spreadsheet actually uses are handled —
 * 0 (stored) and 8 (deflate).
 */
async function unzip(buf: ArrayBuffer, wanted: (name: string) => boolean): Promise<Record<string, string>> {
  const v = dv(buf);
  const bytes = new Uint8Array(buf);

  // End of central directory: scan back for the signature.
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= 0 && i > buf.byteLength - 66000; i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('NOT_A_ZIP');

  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out: Record<string, string> = {};

  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const compSize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const localOff = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!wanted(name)) continue;

    // The local header repeats the name/extra lengths, and they can differ
    // from the central directory's — always read them from the local header.
    const lNameLen = v.getUint16(localOff + 26, true);
    const lExtraLen = v.getUint16(localOff + 28, true);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(start, start + compSize);

    if (method === 0) {
      out[name] = new TextDecoder().decode(raw);
    } else if (method === 8) {
      const ds = new DecompressionStream('deflate-raw');
      const stream = new Blob([raw]).stream().pipeThrough(ds);
      out[name] = await new Response(stream).text();
    } else {
      throw new Error('UNSUPPORTED_COMPRESSION');
    }
  }
  return out;
}

/* ---------------------------------------------------------------- xlsx ---- */

/** "BC12" -> 54 (0-based column index) */
function colIndex(ref: string): number {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

/** Excel serial date -> ISO-ish display. Day 60 is Excel's phantom 1900 leap day. */
function serialToDate(n: number): string {
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return String(n);
  return d.toISOString().slice(0, 10);
}

/** Built-in numFmtIds that are dates or times, per the OOXML spec. */
const BUILTIN_DATE_FMT = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
/** Built-in percent and currency/accounting formats. */
const BUILTIN_PCT = new Set([9, 10]);
const BUILTIN_CUR = new Set([5, 6, 7, 8, 42, 44]);

interface NumFmt {
  kind: 'date' | 'percent' | 'currency' | 'number';
  decimals: number;
  symbol: string;
  grouped: boolean;
}

/**
 * What each style index MEANS, read from the workbook rather than guessed.
 *
 * This matters twice over. A date in xlsx is only a number wearing a date
 * format, and $29,400 sits squarely inside the plausible serial range — so
 * guessing from magnitude turned a revenue figure into 1980-06-28.
 *
 * And the reverse: Excel stores $29,400.00 as `29400` and 12.4% as `0.124`.
 * The dollar sign, the thousands separator and the percent all live in the
 * format string. Ignore it and a rep's deck shows "0.124" where the sheet on
 * their screen says "12.4%", which is worse than useless — it is wrong in a
 * way they have to catch by eye.
 */
function styleFormats(stylesXml: string | undefined): Map<number, NumFmt> {
  const out = new Map<number, NumFmt>();
  if (!stylesXml) return out;
  const doc = new DOMParser().parseFromString(stylesXml, 'application/xml');

  const custom = new Map<number, string>();
  doc.querySelectorAll('numFmts > numFmt').forEach((n) => {
    const id = parseInt(n.getAttribute('numFmtId') || '', 10);
    if (Number.isFinite(id)) custom.set(id, n.getAttribute('formatCode') || '');
  });

  const read = (id: number, code: string): NumFmt => {
    // Only the first section of a format applies to positive numbers, and
    // literals must not be scanned for format tokens.
    const first = code.split(';')[0];
    const bare = first.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
    const decimals = (bare.match(/\.(0+)/) || [, ''])[1].length;
    const grouped = /#,#|0,0/.test(bare);

    if (BUILTIN_DATE_FMT.has(id) || (/[ymd]/i.test(bare) && !/[%]/.test(bare))) {
      return { kind: 'date', decimals, symbol: '', grouped };
    }
    if (BUILTIN_PCT.has(id) || bare.includes('%')) {
      return { kind: 'percent', decimals, symbol: '', grouped };
    }
    const cur = first.match(/\[\$([^\-\]]*)[^\]]*\]/) || first.match(/([$€£¥])/);
    if (BUILTIN_CUR.has(id) || cur) {
      return { kind: 'currency', decimals, symbol: (cur && cur[1]) || '$', grouped: true };
    }
    return { kind: 'number', decimals, symbol: '', grouped };
  };

  doc.querySelectorAll('cellXfs > xf').forEach((xf, i) => {
    const id = parseInt(xf.getAttribute('numFmtId') || '0', 10);
    const code = custom.get(id) ?? '';
    if (id === 0 && !code) return; // General: leave the raw value alone
    out.set(i, read(id, code));
  });
  return out;
}

/** Applies a workbook number format to a raw cell value. */
function applyFormat(num: number, f: NumFmt | undefined): string {
  if (!f) return String(num);
  if (f.kind === 'date') return serialToDate(num);
  const group = (v: number, dp: number) =>
    v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp, useGrouping: f.grouped });
  if (f.kind === 'percent') return group(num * 100, f.decimals) + '%';
  if (f.kind === 'currency') {
    const neg = num < 0;
    return (neg ? '-' : '') + f.symbol + group(Math.abs(num), f.decimals === 0 ? 2 : f.decimals);
  }
  return group(num, f.decimals);
}

async function parseXlsx(buf: ArrayBuffer): Promise<{ grid: string[][]; sheetName?: string }> {
  const files = await unzip(
    buf,
    (n) =>
      n === 'xl/workbook.xml' ||
      n === 'xl/sharedStrings.xml' ||
      n === 'xl/styles.xml' ||
      /^xl\/worksheets\/sheet\d+\.xml$/.test(n)
  );

  const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

  // Shared strings: xlsx stores most text once and references it by index.
  const shared: string[] = [];
  if (files['xl/sharedStrings.xml']) {
    const doc = parse(files['xl/sharedStrings.xml']);
    doc.querySelectorAll('si').forEach((si) => {
      // Rich text splits a single string across several <t> runs.
      shared.push(Array.from(si.querySelectorAll('t')).map((t) => t.textContent || '').join(''));
    });
  }

  const fmts = styleFormats(files['xl/styles.xml']);

  const sheetNames = files['xl/workbook.xml']
    ? Array.from(parse(files['xl/workbook.xml']).querySelectorAll('sheet')).map((s) => s.getAttribute('name') || '')
    : [];

  const sheetKeys = Object.keys(files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => (parseInt(a.match(/\d+/)![0]) - parseInt(b.match(/\d+/)![0])));
  if (!sheetKeys.length) throw new Error('NO_SHEET');

  // First sheet only: reps export one table, and silently merging several
  // would be worse than asking them to split the file.
  const doc = parse(files[sheetKeys[0]]);
  const grid: string[][] = [];

  doc.querySelectorAll('row').forEach((row) => {
    const rIdx = parseInt(row.getAttribute('r') || '0', 10) - 1;
    const cells: string[] = [];
    row.querySelectorAll('c').forEach((c) => {
      const ref = c.getAttribute('r') || '';
      const ci = ref ? colIndex(ref) : cells.length;
      const t = c.getAttribute('t');
      let text = '';
      if (t === 'inlineStr') {
        text = Array.from(c.querySelectorAll('t')).map((x) => x.textContent || '').join('');
      } else {
        const v = c.querySelector('v');
        const raw = v ? v.textContent || '' : '';
        if (t === 's') text = shared[parseInt(raw, 10)] ?? '';
        else if (t === 'b') text = raw === '1' ? 'TRUE' : 'FALSE';
        else if (raw !== '') {
          const num = Number(raw);
          const styleIdx = parseInt(c.getAttribute('s') || '', 10);
          const f = Number.isFinite(styleIdx) ? fmts.get(styleIdx) : undefined;
          text = Number.isFinite(num) ? applyFormat(num, f) : raw;
        }
      }
      cells[ci] = text;
    });
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = '';
    grid[rIdx >= 0 ? rIdx : grid.length] = cells;
  });

  for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = [];
  return { grid, sheetName: sheetNames[0] };
}

/* ----------------------------------------------------------------- csv ---- */

/** RFC-4180-ish: honours quotes, escaped quotes and newlines inside fields. */
export function parseDelimited(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  // Pick the delimiter by counting candidates outside quotes on the first lines.
  const head = t.slice(0, 5000);
  const count = (ch: string) => (head.match(new RegExp('\\' + ch, 'g')) || []).length;
  const delim = count('\t') > count(',') ? '\t' : count(';') > count(',') ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ------------------------------------------------------- table detection --- */

const isBlank = (r: string[]) => !r || r.every((c) => (c ?? '').trim() === '');
const NUM_RE = /^-?[$€£]?\s?-?[\d,]*\.?\d+\s?%?$/;

function looksNumeric(s: string): boolean {
  const v = (s || '').trim();
  if (!v) return false;
  if (/^\(.*\)$/.test(v)) return NUM_RE.test(v.slice(1, -1)); // (1,234) = negative
  return NUM_RE.test(v);
}

function classify(values: string[]): CellType {
  const vals = values.filter((v) => (v || '').trim() !== '');
  if (!vals.length) return 'text';
  const numeric = vals.filter(looksNumeric).length / vals.length;
  if (numeric < 0.7) {
    const dated = vals.filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) || !isNaN(Date.parse(v))).length / vals.length;
    return dated > 0.8 && vals.every((v) => /[-/]/.test(v)) ? 'date' : 'text';
  }
  if (vals.filter((v) => v.includes('%')).length / vals.length > 0.5) return 'percent';
  if (vals.filter((v) => /[$€£]/.test(v)).length / vals.length > 0.5) return 'currency';
  return 'number';
}

const TOTAL_RE = /^\s*(grand\s+)?(total|subtotal|sum|all\s+\w+)\s*:?\s*$/i;

/**
 * Finds the actual table inside a raw grid.
 *
 * The header is not simply "row 0". Exports lead with report titles, dates and
 * blank spacers, and the real header is the first row that both looks like
 * labels (mostly non-numeric) and is followed by rows of the same width. That
 * test is what separates a header from a title banner sitting alone in A1.
 */
export function findTable(grid: string[][]): SheetTable {
  const rows = grid.filter((r) => r !== undefined);

  // Widest run of rows decides the table's width; stray one-cell title rows
  // above it are noise.
  const widths = rows.map((r) => r.filter((c) => (c ?? '').trim() !== '').length);
  const bodyWidth = Math.max(1, ...widths);

  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (isBlank(r)) continue;
    const filled = r.filter((c) => (c ?? '').trim() !== '').length;
    if (filled < Math.max(2, bodyWidth - 1)) continue;      // too narrow: a banner
    const labels = r.filter((c) => (c ?? '').trim() !== '' && !looksNumeric(c)).length;
    if (labels / filled < 0.6) continue;                     // mostly numbers: data, not a header
    const next = rows[i + 1];
    if (!next || isBlank(next)) continue;                    // a header needs a body
    headerIdx = i;
    break;
  }
  if (headerIdx < 0) headerIdx = rows.findIndex((r) => !isBlank(r));
  if (headerIdx < 0) throw new Error('NO_DATA');

  const headerRow = rows[headerIdx];
  const width = Math.max(headerRow.length, ...rows.slice(headerIdx + 1).map((r) => r.length));

  const norm = (r: string[]) => Array.from({ length: width }, (_, i) => (r[i] ?? '').toString().trim());

  const body: string[][] = [];
  let totalRow: string[] | undefined;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = norm(rows[i]);
    if (isBlank(r)) continue;                                // spacer rows and the footnote gap
    if (TOTAL_RE.test(r[0] || '')) { totalRow = r; continue; } // pulled out so it can be styled
    // A trailing footnote is one stray cell under a much wider table.
    if (r.filter((c) => c !== '').length === 1 && body.length > 2 && width > 2) continue;
    body.push(r);
  }

  // Columns entirely empty across header and body are dropped, so a spacer
  // column in the source doesn't become a blank column in the deck.
  const headers = norm(headerRow);
  const keep: number[] = [];
  for (let c = 0; c < width; c++) {
    if (headers[c] !== '' || body.some((r) => r[c] !== '')) keep.push(c);
  }

  const finalHeaders = keep.map((c) => headers[c] || '');
  const finalBody = body.map((r) => keep.map((c) => r[c]));
  const types = keep.map((_, i) => classify(finalBody.map((r) => r[i])));

  return {
    headers: finalHeaders,
    rows: finalBody,
    types,
    totalRow: totalRow ? keep.map((c) => totalRow![c]) : undefined,
    meta: {
      skippedTop: headerIdx,
      droppedEmptyCols: width - keep.length,
      sourceRows: rows.length,
    },
  };
}

/* ---------------------------------------------------------------- entry ---- */

export async function readSpreadsheet(file: File): Promise<SheetTable> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    return findTable(parseDelimited(await file.text()));
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    const { grid, sheetName } = await parseXlsx(await file.arrayBuffer());
    const t = findTable(grid);
    t.meta.sheetName = sheetName;
    return t;
  }
  // .xls is a completely different binary format (BIFF), not a zip.
  if (name.endsWith('.xls')) throw new Error('LEGACY_XLS');
  throw new Error('UNSUPPORTED_FILE');
}

export function ingestError(e: any): string {
  switch (String(e?.message)) {
    case 'LEGACY_XLS':
      return 'That is an older .xls file. Open it in Excel and “Save As” .xlsx, then try again.';
    case 'UNSUPPORTED_FILE':
      return 'Use a .xlsx or .csv file.';
    case 'NOT_A_ZIP':
    case 'NO_SHEET':
      return 'That file could not be read as a spreadsheet.';
    case 'UNSUPPORTED_COMPRESSION':
      return 'That workbook uses an unusual compression setting. Re-save it from Excel and try again.';
    case 'NO_DATA':
      return 'No table was found in that file.';
    default:
      return 'That file could not be read.';
  }
}
