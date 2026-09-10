'use client';

import type { ExtractedImage, ExtractedPage, TextRun } from './extract';

/**
 * WORKING OUT WHAT A PAGE IS
 * ---------------------------------------------------------------------------
 * A PDF knows where its ink sits and nothing else. It has no idea that one line
 * is a title and another is a footer. This module reconstructs that intent from
 * the only evidence available — size, position, repetition and wording — and
 * hands `compose.ts` a description of the page's MEANING, not its layout.
 *
 * The rules are deliberately conservative. Guessing wrong is worse than not
 * guessing: an unrecognised block becomes body copy, which is always safe,
 * whereas a mis-fired metric turns a sentence into a giant number. Anything the
 * module is unsure about is recorded in `notes` so the user is told rather than
 * quietly given something wrong.
 */

export interface Metric {
  value: string;
  label: string;
  support?: string;
}

export interface PageReading {
  index: number;
  eyebrow?: string;
  display?: string;
  headline?: string;
  body: string[];
  bullets: string[];
  metrics: Metric[];
  table?: { headers: string[]; rows: string[][] };
  quote?: { text: string; attribution?: string };
  images: ExtractedImage[];
  /** an image big enough to be the page, not an illustration on it */
  hero?: ExtractedImage;
  flattened: boolean;
  /** honest record of what could not be read */
  notes: string[];
}

interface Line {
  text: string;
  x: number;
  y: number;
  right: number;
  size: number;
  bold: boolean;
  italic: boolean;
  runs: TextRun[];
}

/* ------------------------------------------------------------------ lines */

/** Runs sharing a baseline are one line. Tolerance scales with type size. */
function toLines(runs: TextRun[]): Line[] {
  const sorted = runs.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];

  for (const r of sorted) {
    const tol = Math.max(r.size * 0.6, 0.004);
    const line = lines.find((l) => Math.abs(l.y - r.y) <= tol && Math.abs(l.size - r.size) < r.size * 0.5);
    if (line) {
      line.runs.push(r);
      line.x = Math.min(line.x, r.x);
      line.right = Math.max(line.right, r.x + r.w);
      line.size = Math.max(line.size, r.size);
    } else {
      lines.push({
        text: '',
        x: r.x,
        y: r.y,
        right: r.x + r.w,
        size: r.size,
        bold: r.bold,
        italic: r.italic,
        runs: [r],
      });
    }
  }

  for (const l of lines) {
    l.runs.sort((a, b) => a.x - b.x);
    l.text = joinRuns(l.runs);
    l.bold = l.runs.every((r) => r.bold);
    l.italic = l.runs.every((r) => r.italic);
  }

  return lines.filter((l) => l.text.trim().length > 0).sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * PDFs split words wherever kerning changes, so runs arrive as fragments. A gap
 * wider than a fraction of the type size is a real space; anything less is the
 * same word coming apart and must be rejoined without one.
 */
function joinRuns(runs: TextRun[]): string {
  let out = '';
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    if (i > 0) {
      const prev = runs[i - 1];
      const gap = r.x - (prev.x + prev.w);
      if (gap > r.size * 0.18 && !/\s$/.test(out) && !/^\s/.test(r.text)) out += ' ';
    }
    out += r.text;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/* -------------------------------------------------------------- furniture */

/**
 * Slide numbers, running footers and repeated confidentiality lines appear on
 * most pages. They belong to the document, not to any page, and carrying them
 * into a deck that has its own page furniture would duplicate it.
 */
function furniture(pages: ExtractedPage[]): Set<string> {
  const counts = new Map<string, number>();
  for (const p of pages) {
    const seen = new Set<string>();
    // Counted on RUNS, not lines, because that is the granularity the filter
    // works at. Count "Alessi Foods — Confidential 7" as a line and you learn
    // nothing about the run "Alessi Foods — Confidential", which is what
    // actually has to be dropped.
    for (const r of p.runs) {
      if (r.y < 0.08 || r.y > 0.9) {
        const k = normalise(r.text);
        if (k.length > 2 && !seen.has(k)) {
          seen.add(k);
          counts.set(k, (counts.get(k) || 0) + 1);
        }
      }
    }
  }
  const threshold = Math.max(3, Math.ceil(pages.length * 0.5));
  const out = new Set<string>();
  counts.forEach((n, k) => n >= threshold && out.add(k));
  return out;
}

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b\d{1,3}\b/g, '#') // so "Page 4" and "Page 5" count as the same line
    .replace(/[^a-z#]+/g, ' ')
    .trim();

/* --------------------------------------------------------------- patterns */

/** "42%", "$8.1M", "6x", "1,240", "+18 pts" — a number doing the talking. */
const METRIC_VALUE = /^[+\-–]?[$€£]?\s?\d[\d,.]*\s?(%|x|X|k|K|M|MM|B|bn|pts?|\+)?$/;
const BULLET_MARK = /^\s*([•·▪●◦‣∙*\-–—]|\d{1,2}[.)]|[a-z][.)])\s+/i;
const QUOTE_WRAP = /^\s*[“"„«]([\s\S]+)[”"»]\s*$/;
const ATTRIBUTION = /^\s*[—–\-]\s*\S/;

/* ---------------------------------------------------------------- reading */

export function interpret(pages: ExtractedPage[]): PageReading[] {
  const skip = furniture(pages);
  return pages.map((p) => readPage(p, skip));
}

function readPage(page: ExtractedPage, skip: Set<string>): PageReading {
  const notes: string[] = [];

  // Furniture goes first, at the run level, so a stripped footer cannot leave a
  // page looking like it has content when it has none.
  const content = page.runs.filter((r) => {
    const t = r.text.trim();
    if ((r.y < 0.08 || r.y > 0.9) && skip.has(normalise(t))) return false;
    if (r.y > 0.88 && /^\d{1,3}$/.test(t)) return false;
    return true;
  });

  const reading: PageReading = {
    index: page.index,
    body: [],
    bullets: [],
    metrics: [],
    images: page.images,
    flattened: page.flattened,
    notes,
  };

  const hero = page.images.find((i) => i.coverage > 0.45);
  if (hero) reading.hero = hero;

  // A page whose only text was the running footer has nothing to rebuild from,
  // which is the same situation as a slide flattened to a picture — and has to
  // be judged AFTER the footer is removed, or it never trips.
  // Three characters, not thirty: a divider slide reading "Q4" is content, and
  // calling it unreadable would throw away the one thing on the page.
  const typed = content.reduce((n, r) => n + r.text.trim().length, 0);
  if (page.flattened || typed < 3) {
    reading.flattened = true;
    notes.push('No readable text — this page was flattened to an image before export.');
    return reading;
  }

  // The size that most of the page's TEXT is set in, weighted by how much text
  // there is. A line-count median gets this badly wrong on a title slide, where
  // half the lines are the title; characters are what the eye actually sees.
  const bodySize = dominantSize(content);

  /* -- metrics, before anything else -------------------------------------- */
  // Metrics are read from runs rather than lines because three figures set
  // across a page share a baseline: as lines they look exactly like a table
  // row, and whichever test runs first wins. Pulling them out here means the
  // table detector never sees them.
  const consumed = new Set<TextRun>();
  for (const r of content) {
    if (consumed.has(r)) continue;
    const t = r.text.trim();
    if (!METRIC_VALUE.test(t)) continue;
    if (r.size < bodySize * 1.3) continue;

    const under = (a: TextRun, gap: number) =>
      content.find(
        (o) =>
          !consumed.has(o) &&
          o !== r &&
          o !== a &&
          o.y > a.y &&
          o.y - a.y < a.size * gap &&
          Math.abs(o.x - r.x) < 0.06 &&
          o.size < r.size
      );

    const label = under(r, 2.6);
    const support = label && under(label, 2.4);

    reading.metrics.push({
      value: t,
      label: (label?.text || '').trim(),
      support: support?.text.trim(),
    });
    consumed.add(r);
    if (label) consumed.add(label);
    if (support) consumed.add(support);
  }

  const lines = toLines(content.filter((r) => !consumed.has(r)));
  if (!lines.length && !reading.metrics.length) return reading;

  /* -- table: it consumes lines that would otherwise read as body --------- */
  const table = findTable(lines);
  if (table) {
    reading.table = table.table;
    for (const l of table.consumed) lines.splice(lines.indexOf(l), 1);
  }

  /* -- size ranking ------------------------------------------------------- */
  const sizes = Array.from(new Set(lines.map((l) => round(l.size)))).sort((a, b) => b - a);
  const biggest = sizes[0] || 0;

  /* -- quote -------------------------------------------------------------- */
  const quoted = lines.find((l) => QUOTE_WRAP.test(l.text) && l.text.length > 40);
  if (quoted) {
    const attrLine = lines.find((l) => l.y > quoted.y && ATTRIBUTION.test(l.text) && l.text.length < 90);
    reading.quote = {
      text: (QUOTE_WRAP.exec(quoted.text) || [, quoted.text])[1]!.trim(),
      attribution: attrLine?.text.replace(/^\s*[—–\-]\s*/, '').trim(),
    };
    lines.splice(lines.indexOf(quoted), 1);
    if (attrLine) lines.splice(lines.indexOf(attrLine), 1);
  }

  /* -- headings ----------------------------------------------------------- */
  // The largest type on the page is the page's title. An all-caps line that is
  // notably smaller and sits directly above it is an eyebrow, which is exactly
  // the convention these decks already use.
  // Either the biggest type is clearly bigger than the page's body copy, or it
  // is display-sized in absolute terms — which is the only signal available on
  // a divider slide, where the title is the ONLY text and has nothing to be
  // bigger than.
  const isTitleSized = biggest > bodySize * 1.25 || biggest >= 0.045;
  const titleLines = lines.filter((l) => round(l.size) === biggest && isTitleSized);
  if (titleLines.length) {
    const title = titleLines.map((l) => l.text).join(' ').trim();
    if (title.length <= 70) reading.display = title;
    else reading.headline = title;

    const top = titleLines[0];
    const eyebrow = lines.find(
      (l) =>
        l.y < top.y &&
        top.y - l.y < 0.14 &&
        l.size < top.size * 0.75 &&
        l.text.length < 60 &&
        (isUpper(l.text) || l.bold)
    );
    if (eyebrow) {
      reading.eyebrow = eyebrow.text.trim();
      lines.splice(lines.indexOf(eyebrow), 1);
    }
    for (const l of titleLines) lines.splice(lines.indexOf(l), 1);
  }

  /* -- bullets and body --------------------------------------------------- */
  for (const l of lines) {
    const t = l.text.trim();
    if (!t) continue;
    if (BULLET_MARK.test(t)) {
      reading.bullets.push(t.replace(BULLET_MARK, '').trim());
    } else if (reading.bullets.length && isIndented(l, lines) && t.length < 90) {
      // A hanging line under a bullet is a continuation, not a new thought.
      reading.bullets[reading.bullets.length - 1] += ' ' + t;
    } else {
      reading.body.push(t);
    }
  }

  // Short lines of similar length stacked together are a list someone drew
  // without bullet characters. Treating them as prose would run them into a
  // single paragraph, which reads as nonsense.
  if (!reading.bullets.length && reading.body.length >= 3 && reading.body.every((b) => b.length < 60)) {
    reading.bullets = reading.body;
    reading.body = [];
  }

  if (reading.metrics.some((m) => !m.label)) {
    notes.push('A figure on this page had no caption I could find — check its label.');
  }

  return reading;
}

/* ------------------------------------------------------------------ table */

/**
 * A table is rows of lines whose left edges repeat down the page. Three or more
 * rows agreeing on three or more column positions is not a coincidence; two of
 * either is, which is why the thresholds are where they are.
 */
function findTable(lines: Line[]): { table: { headers: string[]; rows: string[][] }; consumed: Line[] } | null {
  const rows = new Map<number, Line[]>();
  for (const l of lines) {
    if (l.runs.length < 2) continue;
    const key = Math.round(l.y * 200);
    const near = Array.from(rows.keys()).find((k) => Math.abs(k - key) <= 2);
    const bucket = near !== undefined ? rows.get(near)! : (rows.set(key, []), rows.get(key)!);
    bucket.push(l);
  }

  const candidates = Array.from(rows.values())
    .map((ls) => ls[0])
    .filter((l) => l.runs.length >= 3)
    .sort((a, b) => a.y - b.y);
  if (candidates.length < 3) return null;

  // Column positions, rounded, must agree across rows.
  const columnsOf = (l: Line) => l.runs.map((r) => Math.round(r.x * 40));
  const first = columnsOf(candidates[0]);
  const agreeing = candidates.filter((l) => {
    const c = columnsOf(l);
    const hits = first.filter((x) => c.some((y) => Math.abs(y - x) <= 1)).length;
    return hits >= Math.min(3, first.length);
  });
  if (agreeing.length < 3) return null;

  const cells = (l: Line) => {
    const groups: TextRun[][] = [];
    for (const r of l.runs) {
      const last = groups[groups.length - 1];
      if (last && r.x - (last[last.length - 1].x + last[last.length - 1].w) < 0.02) last.push(r);
      else groups.push([r]);
    }
    return groups.map(joinRuns);
  };

  const headers = cells(agreeing[0]);
  const body = agreeing.slice(1).map(cells);
  const width = Math.max(headers.length, ...body.map((r) => r.length));
  if (width < 2) return null;

  return {
    table: {
      headers: pad(headers, width),
      rows: body.map((r) => pad(r, width)),
    },
    consumed: agreeing,
  };
}

/* ----------------------------------------------------------------- helpers */

const round = (n: number) => Math.round(n * 400) / 400;
const isUpper = (s: string) => s === s.toUpperCase() && /[A-Z]/.test(s);
const pad = (a: string[], n: number) => (a.length >= n ? a.slice(0, n) : [...a, ...Array(n - a.length).fill('')]);
const overlaps = (a: Line, b: Line) => a.x < b.right + 0.06 && b.x < a.right + 0.06;

function isIndented(l: Line, all: Line[]): boolean {
  const left = Math.min(...all.map((o) => o.x));
  return l.x > left + 0.015;
}

/**
 * The type size half the page's CHARACTERS sit at or below. Weighting by text
 * volume rather than by line count is what stops a title slide — two lines, one
 * of them huge — from reporting its own title as the body size and then
 * concluding the page has no title at all.
 */
function dominantSize(runs: TextRun[]): number {
  const total = runs.reduce((n, r) => n + r.text.trim().length, 0);
  if (!total) return 0.02;
  const sorted = runs.slice().sort((a, b) => a.size - b.size);
  let seen = 0;
  for (const r of sorted) {
    seen += r.text.trim().length;
    if (seen >= total / 2) return r.size;
  }
  return sorted[sorted.length - 1].size;
}
