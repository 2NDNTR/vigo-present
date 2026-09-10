import type { Block, ChartData, Page } from '@/lib/model/types';
import { uid } from '@/lib/model/types';

/**
 * SCREENSHOT → PAGE
 * ---------------------------------------------------------------------------
 * A category review arrives as a PDF full of somebody else's charts. Retyping
 * one takes a salesperson ten minutes and introduces a typo; screenshotting it
 * takes ten seconds and introduces someone else's brand. This reads the
 * picture and gives back DATA, which the deck then draws in Vigo's own hand.
 *
 * The model is asked for a narrow, boring shape — no HTML, no styling, no
 * layout decisions. Design belongs to the templates; the model's only job is
 * to be right about the numbers. Everything it returns is treated as a
 * proposal: the shape is validated here, and a person corrects it in the panel
 * before it ever reaches a buyer.
 */

export interface ChartRead {
  eyebrow?: string;
  title?: string;
  kind: 'bar' | 'column' | 'donut';
  unit?: 'currency' | 'percent' | 'number';
  categories: string[];
  values: number[];
  deltas?: (number | null)[];
  highlight?: string;
  source?: string;
  /** the takeaways printed alongside the chart, kept verbatim */
  findings?: string[];
  /** set when the model could not read the image as a chart at all */
  error?: string;
}

export const CHART_SCHEMA = {
  type: 'object' as const,
  properties: {
    eyebrow: { type: 'string', description: 'Short section label, e.g. "Rice category". Omit if absent.' },
    title: { type: 'string', description: 'The chart or slide title, verbatim from the image.' },
    kind: {
      type: 'string',
      enum: ['bar', 'column', 'donut'],
      description:
        'bar for a ranked list of brands or items; column for a short series across periods; donut for shares of one total.',
    },
    unit: { type: 'string', enum: ['currency', 'percent', 'number'] },
    categories: { type: 'array', items: { type: 'string' }, description: 'Row or slice labels, in the order shown.' },
    values: { type: 'array', items: { type: 'number' }, description: 'Plain numbers. 12.2 million dollars is 12200000, not "$12.2M".' },
    deltas: {
      type: 'array',
      items: { type: ['number', 'null'] },
      description: 'Percent change per category where the image shows one, e.g. -5.2. null where it does not.',
    },
    highlight: { type: 'string', description: 'The category to draw in the accent — use the Vigo or Alessi row when one is present.' },
    source: { type: 'string', description: 'The source line, verbatim, e.g. "Nielsen, Publix, L13 WE 1/24/26".' },
    findings: {
      type: 'array',
      items: { type: 'string' },
      description: 'The bullet commentary printed beside the chart, verbatim, at most three.',
    },
    error: { type: 'string', description: 'Set ONLY if the image contains no chart or table you can read.' },
  },
  required: ['kind', 'categories', 'values'],
};

export const CHART_PROMPT = `You are reading one chart or data table from a retail category review and returning it as data.

Rules, in order of importance:
1. NEVER invent a number. If a value is not legible, leave that category out entirely rather than guessing. A wrong number in a buyer presentation is worse than a missing one.
2. Values are plain numbers with no formatting: $12.2M becomes 12200000, 56% becomes 56, -5.2% in a change column belongs in deltas as -5.2.
3. Keep the labels, the title and the source line exactly as printed, including their capitalisation. Do not tidy them.
4. Choose kind by what the data IS, not by how it was drawn: shares of a single total are a donut even if the image drew a bar; a ranked field of brands is a bar; a handful of time periods is a column.
5. If a Vigo or Alessi row is present, set highlight to that exact category label.
6. findings are the printed bullets beside the chart, verbatim, at most three. Do not write your own analysis.
7. If the image is not a chart or table, set error and return nothing else.`;

/** Everything the model returns is a proposal — this is where it becomes safe. */
export function validate(read: Partial<ChartRead>): ChartRead | { error: string } {
  if (read?.error) return { error: String(read.error) };
  const categories = (read.categories || []).map((c) => String(c).trim()).filter(Boolean);
  const values = (read.values || []).map((v) => Number(v));

  if (!categories.length) return { error: 'No categories could be read from that image.' };
  if (values.some((v) => !isFinite(v))) return { error: 'Some values could not be read as numbers.' };

  /* A category without a value is a row the model half-read. Trim to the
   * shorter of the two rather than padding with zeros, which would draw a bar
   * of length nothing and read as a real result. */
  const n = Math.min(categories.length, values.length);
  if (n === 0) return { error: 'No usable values could be read from that image.' };

  const deltas = read.deltas ? read.deltas.slice(0, n).map((d) => (d === null || d === undefined || !isFinite(Number(d)) ? null : Number(d))) : undefined;

  return {
    eyebrow: str(read.eyebrow),
    title: str(read.title),
    kind: read.kind === 'donut' || read.kind === 'column' ? read.kind : 'bar',
    unit: read.unit === 'percent' || read.unit === 'number' ? read.unit : 'currency',
    categories: categories.slice(0, n),
    values: values.slice(0, n),
    deltas,
    highlight: str(read.highlight),
    source: str(read.source),
    findings: (read.findings || []).map((f) => String(f).trim()).filter(Boolean).slice(0, 3),
  };
}

function str(v: unknown): string | undefined {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || undefined;
}

const T = (text: string, role: string): Block => ({
  id: uid('b'),
  type: 'text',
  text,
  style: { role: role as Block['style']['role'], color: 'auto', align: 'left' },
});

/**
 * Compose the page. The layout is chosen by what was read, not asked of the
 * model: commentary beside the chart when there is commentary, full width when
 * the chart is the whole story.
 */
export function toPage(read: ChartRead): Page {
  const chart: ChartData = {
    kind: read.kind,
    categories: read.categories,
    values: read.values,
    deltas: read.deltas,
    unit: read.unit,
    highlight: read.highlight,
    source: read.source,
  };

  const chartBlock: Block = { id: uid('b'), type: 'chart', chart };
  const head = [
    T(read.eyebrow || 'Category review', 'eyebrow'),
    T(read.title || 'What the numbers say', 'headline'),
  ];

  if (read.findings?.length) {
    return {
      id: uid('pg'),
      templateId: 'chart-story',
      background: { kind: 'theme' },
      slots: {
        head,
        main: [chartBlock],
        aside: read.findings.map((f, i) => T(f, i === 0 ? 'subhead' : 'body')),
      },
    };
  }

  return {
    id: uid('pg'),
    templateId: 'chart-full',
    background: { kind: 'theme' },
    slots: { head, main: [chartBlock] },
  };
}
