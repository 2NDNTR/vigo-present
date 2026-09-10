/**
 * PDF IMPORT — REGRESSION HARNESS
 * ---------------------------------------------------------------------------
 *   npx tsx scripts/pdf.check.ts fixtures/deck.pdf
 *
 * The interpreter's whole job is judgement, and judgement is exactly the kind
 * of code that drifts when someone tightens a threshold to fix one document and
 * quietly breaks five others. This runs the real extractor and interpreter over
 * a real PDF and asserts what each page should be READ as — not what it should
 * look like — so a change that improves one case and ruins another is visible
 * immediately.
 *
 * It runs in Node against PDF.js's legacy build. Image extraction needs a
 * canvas and is therefore skipped here; picture handling is exercised in the
 * browser, and the decisions worth protecting are the textual ones.
 */

import { readFileSync } from 'node:fs';
import { interpret } from '../lib/pdf/interpret';
import { compose } from '../lib/pdf/compose';
import type { ExtractedPage, TextRun } from '../lib/pdf/extract';

/* ------------------------------------------------------------ expectations */

interface Expect {
  page: number;
  template: string;
  /** substrings that must appear somewhere in the composed page's text */
  contains?: string[];
  /** text that must NOT survive — page furniture, mostly */
  absent?: string[];
  metrics?: number;
  bullets?: number;
}

const EXPECTED: Expect[] = [
  { page: 1, template: 'cover', contains: ['Sell the Box'], absent: ['Confidential'] },
  { page: 2, template: 'section-divider', contains: ['Performance'] },
  // The heading is asserted here because it was once lost: metric-three seeds
  // only an eyebrow in its heading slot, so the page's actual title had no
  // block to land in and vanished without a trace. A dropped heading is the
  // worst failure this tool can have — nothing in the output shows it happened.
  {
    page: 3,
    template: 'metric-three',
    metrics: 3,
    contains: ['6.2x', 'Order volume', 'The quarter in three numbers'],
  },
  { page: 4, template: 'key-takeaways', bullets: 4, contains: ['Gift boxes live by 15 October'] },
  { page: 5, template: 'quote', contains: ['understand the category'] },
  { page: 6, template: 'data-table', contains: ['Shopify', 'Channel'] },
  { page: 7, template: 'full-bleed' },

  /* -- the half that matters more: things that must NOT be read as something --
   * Every one of these is a shape that superficially resembles a richer layout.
   * A price inside a sentence looks like a metric; a closing slide looks like a
   * divider. Getting these wrong is how a deck ends up confidently wrong, which
   * is worse than plain.
   */
  { page: 8, template: 'image-copy', metrics: 0, contains: ['Why the box works', '$38'] },
  { page: 9, template: 'metric-context', metrics: 1, contains: ['6.2x', 'Order volume since April'] },
  { page: 10, template: 'thank-you', metrics: 0, contains: ['Thank you'] },
];

/* -------------------------------------------------------------- extraction */

async function extractInNode(path: string): Promise<ExtractedPage[]> {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(readFileSync(path));
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: false }).promise;

  const pages: ExtractedPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const view = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const runs: TextRun[] = [];

    for (const item of content.items as any[]) {
      const text: string = (item.str || '').replace(/\s+/g, ' ');
      if (!text.trim()) continue;
      const tr = item.transform as number[];
      const size = Math.abs(tr[3]) || Math.abs(tr[0]) || 0;
      const styles = (content as any).styles || {};
      const font: string = styles[item.fontName]?.fontFamily || item.fontName || '';
      runs.push({
        text,
        x: tr[4] / view.width,
        y: 1 - tr[5] / view.height,
        w: (item.width || 0) / view.width,
        size: size / view.height,
        bold: /bold|black|heavy|semibold|demi/i.test(font),
        italic: /italic|oblique/i.test(font),
      });
    }

    const typed = runs.reduce((n, r) => n + r.text.trim().length, 0);
    pages.push({
      index: i,
      aspect: view.width / view.height,
      runs,
      images: [],
      flattened: typed < 12,
    });
  }
  return pages;
}

/* ------------------------------------------------------------------- check */

function textOf(page: any): string {
  return Object.values(page.slots || {})
    .flat()
    .map((b: any) =>
      [b.text, b.value, b.label, b.support, ...(b.items || []), ...(b.table?.headers || []), ...((b.table?.rows || []).flat())]
        .filter(Boolean)
        .join(' ')
    )
    .join(' ');
}

async function main() {
  const path = process.argv[2] || 'fixtures/deck.pdf';
  const extracted = await extractInNode(path);
  const readings = interpret(extracted);
  const composed = compose(readings, { brand: 'alessi' });

  let failures = 0;
  const fail = (n: number, msg: string) => {
    failures++;
    console.log(`  \x1b[31m✗\x1b[0m page ${n}: ${msg}`);
  };

  console.log(`\n${path} — ${composed.length} pages\n`);

  for (const want of EXPECTED) {
    const got = composed[want.page - 1];
    if (!got) {
      fail(want.page, 'missing');
      continue;
    }
    const reading = readings[want.page - 1];
    const body = textOf(got.page);

    if (got.templateId !== want.template) {
      fail(want.page, `expected ${want.template}, got ${got.templateId} (${got.reason})`);
    }
    for (const s of want.contains || []) {
      if (!body.includes(s)) fail(want.page, `lost "${s}"`);
    }
    for (const s of want.absent || []) {
      if (body.includes(s)) fail(want.page, `kept page furniture "${s}"`);
    }
    if (want.metrics !== undefined && reading.metrics.length !== want.metrics) {
      fail(want.page, `expected ${want.metrics} metrics, read ${reading.metrics.length}`);
    }
    if (want.bullets !== undefined && reading.bullets.length !== want.bullets) {
      fail(want.page, `expected ${want.bullets} bullets, read ${reading.bullets.length}`);
    }

    if (!failures || true) {
      console.log(
        `  ${String(want.page).padStart(2)}  ${got.templateId.padEnd(16)} ${got.reason}`
      );
    }
  }

  console.log(
    failures ? `\n\x1b[31m${failures} failure${failures === 1 ? '' : 's'}\x1b[0m\n` : '\n\x1b[32mAll pages read as expected\x1b[0m\n'
  );
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
