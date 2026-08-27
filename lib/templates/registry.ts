import type { Block, BlockType, Page, PageBackground } from '@/lib/model/types';
import { uid } from '@/lib/model/types';
import { placeholderImage } from '@/lib/assets/placeholders';

/**
 * PAGE TEMPLATE ARCHITECTURE
 * ---------------------------------------------------------------------------
 * A template is data, not markup. It declares a grid and a set of typed slots.
 * The renderer turns that into a page; the editor turns it into drop zones.
 * Users never position anything freely — blocks snap into slots.
 */

export type TemplateCategory =
  | 'Intro'
  | 'Storytelling'
  | 'Cards & Grids'
  | 'Data'
  | 'Sales'
  | 'Social'
  | 'Products'
  | 'Closing';

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Intro',
  'Storytelling',
  'Cards & Grids',
  'Data',
  'Sales',
  'Social',
  'Products',
  'Closing',
];

export interface LayoutDef {
  columns: string;
  rows: string;
  areas: string[];
  /** page padding in design units (reference stage is 1600 x 900) */
  pad: number;
  gap: number;
}

export interface SlotDef {
  key: string;
  label: string;
  accepts: BlockType[];
  max: number;
  hint: string;
  dir?: 'v' | 'h';
  gap?: number;
  /** vertical placement of the stack inside its cell */
  justify?: 'start' | 'center' | 'end';
  /** horizontal alignment of the stack inside its cell */
  items?: 'start' | 'center' | 'stretch';
  /** slot fills its cell edge to edge (media) */
  bleed?: boolean;
  maxWidth?: number;
  /** slot-level padding in design units, for layouts whose grid padding is 0 */
  pad?: number;
}

export interface PageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  hint: string;
  layout: LayoutDef;
  slots: SlotDef[];
  background?: PageBackground;
  /** advisory copy shown by the guardrail system */
  guidance?: string;
  seed: () => Record<string, Block[]>;
}

/* ------------------------------------------------------------------ helpers */

const T = (
  text: string,
  role: Block['style']['role'],
  extra: Partial<Block> = {}
): Block => ({ id: uid('b'), type: 'text', text, style: { role, color: 'auto', align: 'left' }, ...extra });

const M = (value: string, label: string, support?: string, trend?: Block['trend']): Block => ({
  id: uid('b'),
  type: 'metric',
  value,
  label,
  support,
  trend: trend || 'none',
  style: { role: 'metricLarge', color: 'auto', align: 'left' },
});

const IMG = (url = ''): Block => ({
  id: uid('b'),
  type: 'image',
  media: { url, focalX: 0.5, focalY: 0.5, zoom: 1 },
});

const VID = (): Block => ({
  id: uid('b'),
  type: 'video',
  media: { url: '', autoplay: true, loop: true, muted: true, controls: false },
});

const LOGO = (): Block => ({ id: uid('b'), type: 'logo' });

const CARD = (
  text: string,
  support: string,
  opts: { image?: boolean; wholesale?: string; msrp?: string } = {}
): Block => ({
  id: uid('b'),
  type: 'card',
  text,
  support,
  showImage: opts.image !== false,
  wholesale: opts.wholesale,
  msrp: opts.msrp,
  media: { url: '', focalX: 0.5, focalY: 0.5, zoom: 1 },
  style: { role: 'subhead', color: 'auto', align: 'left' },
});

const CHECKS = (items: string[]): Block => ({
  id: uid('b'),
  type: 'checklist',
  items,
  style: { role: 'subhead', color: 'auto', align: 'left' },
});

const QUOTE = (text: string, label: string): Block => ({
  id: uid('b'),
  type: 'quote',
  text,
  label,
  style: { role: 'quote', color: 'auto', align: 'left' },
});

const TIMELINE = (items: string[]): Block => ({
  id: uid('b'),
  type: 'timeline',
  items,
  style: { role: 'body', color: 'auto', align: 'left' },
});

const LOGOGRID = (items: string[]): Block => ({
  id: uid('b'),
  type: 'logoGrid',
  items,
  style: { role: 'caption', color: 'auto', align: 'center' },
});

const TEXT_TYPES: BlockType[] = ['text', 'checklist', 'bullets', 'quote', 'cta', 'divider', 'timeline'];
const CARD_TYPES: BlockType[] = ['card', 'image', 'metric'];
const MEDIA_TYPES: BlockType[] = ['image', 'video'];
const ANY: BlockType[] = [...TEXT_TYPES, ...MEDIA_TYPES, 'metric', 'logo', 'logoGrid'];

const lay = (columns: string, rows: string, areas: string[], pad = 110, gap = 44): LayoutDef => ({
  columns,
  rows,
  areas,
  pad,
  gap,
});

/* --------------------------------------------------------------- templates */

const templates: PageTemplate[] = [
  /* ============================== INTRO ============================== */
  {
    id: 'cover',
    name: 'Cover',
    category: 'Intro',
    hint: 'Full-bleed image, title anchored low. The first thing anyone sees.',
    layout: lay('1fr', 'auto 1fr', ['top', 'main'], 110, 28),
    background: { kind: 'image', media: { url: '', focalX: 0.5, focalY: 0.5, zoom: 1 }, overlay: 'gradient' },
    slots: [
      { key: 'top', label: 'Brand mark', accepts: ['logo'], max: 1, hint: 'Logo', justify: 'start', items: 'start' },
      {
        key: 'main',
        label: 'Title',
        accepts: TEXT_TYPES,
        max: 3,
        hint: 'Enter your presentation title',
        justify: 'end',
        maxWidth: 1150,
      },
    ],
    seed: () => ({
      top: [LOGO()],
      main: [T('2027 Retail Sales Presentation', 'eyebrow'), T('Built for the season ahead', 'display')],
    }),
  },
  {
    id: 'section-divider',
    name: 'Section Divider',
    category: 'Intro',
    hint: 'A breath between chapters. Oversized number and section name.',
    layout: lay('1fr', '1fr', ['main'], 130, 24),
    background: { kind: 'color', color: 'brandPrimary', overlay: 'none' },
    slots: [
      { key: 'main', label: 'Section', accepts: TEXT_TYPES, max: 3, hint: 'Section name', justify: 'center', maxWidth: 1100 },
    ],
    seed: () => ({
      main: [T('02', 'eyebrow'), T('Sales Performance', 'display'), { id: uid('b'), type: 'divider' as const }],
    }),
  },
  {
    id: 'brand-statement',
    name: 'Brand Statement',
    category: 'Intro',
    hint: 'One sentence, centred, nothing else. Use sparingly.',
    layout: lay('1fr', '1fr', ['main'], 170, 30),
    slots: [
      {
        key: 'main',
        label: 'Statement',
        accepts: TEXT_TYPES,
        max: 2,
        hint: 'Write one sentence',
        justify: 'center',
        items: 'center',
        maxWidth: 1180,
      },
    ],
    guidance: 'A brand statement lands hardest at under 14 words.',
    seed: () => ({
      main: [T('Since 1946', 'eyebrow'), T('Real food, imported honestly, made for the American table.', 'headline')],
    }),
  },

  /* =========================== STORYTELLING ========================== */
  {
    id: 'full-bleed',
    name: 'Full Bleed Image',
    category: 'Storytelling',
    hint: 'Photography does the talking. Optional caption.',
    layout: lay('1fr', '1fr auto', ['top', 'main'], 96, 20),
    background: { kind: 'image', media: { url: '', focalX: 0.5, focalY: 0.5, zoom: 1 }, overlay: 'scrim' },
    slots: [
      { key: 'top', label: 'Top', accepts: TEXT_TYPES, max: 1, hint: 'Optional eyebrow', justify: 'start' },
      { key: 'main', label: 'Caption', accepts: TEXT_TYPES, max: 2, hint: 'Optional caption', justify: 'end', maxWidth: 900 },
    ],
    seed: () => ({ top: [], main: [T('Harvested in Puglia, bottled within 24 hours.', 'caption')] }),
  },
  {
    id: 'image-headline',
    name: 'Image + Headline',
    category: 'Storytelling',
    hint: 'Full-bleed photography with a single strong headline.',
    layout: lay('1fr', '1fr', ['main'], 120, 26),
    background: { kind: 'image', media: { url: '', focalX: 0.5, focalY: 0.5, zoom: 1 }, overlay: 'dark' },
    slots: [
      { key: 'main', label: 'Headline', accepts: TEXT_TYPES, max: 3, hint: 'Enter your headline', justify: 'center', maxWidth: 1080 },
    ],
    seed: () => ({ main: [T('Category leadership', 'eyebrow'), T('The fastest growing Italian import in the Southeast.', 'headline')] }),
  },
  {
    id: 'image-copy',
    name: 'Image + Copy',
    category: 'Storytelling',
    hint: 'Headline and paragraph over image, held to a readable measure.',
    layout: lay('1fr', '1fr', ['main'], 120, 26),
    background: { kind: 'image', media: { url: '', focalX: 0.5, focalY: 0.5, zoom: 1 }, overlay: 'dark' },
    slots: [
      { key: 'main', label: 'Copy', accepts: TEXT_TYPES, max: 4, hint: 'Headline and copy', justify: 'end', maxWidth: 860 },
    ],
    seed: () => ({
      main: [
        T('Our story', 'eyebrow'),
        T('Three generations of importers.', 'headline'),
        T(
          'What began as a single storefront is now one of the largest privately held importers of specialty foods in the country — still family run, still sourcing the same way.',
          'body'
        ),
      ],
    }),
  },
  {
    id: 'split-image-text',
    name: 'Split Image / Text',
    category: 'Storytelling',
    hint: 'Half photograph, half copy. The workhorse layout.',
    layout: lay('1fr 1fr', '1fr', ['media main'], 0, 0),
    slots: [
      { key: 'media', label: 'Image', accepts: MEDIA_TYPES, max: 1, hint: 'Drop an image here', bleed: true },
      { key: 'main', label: 'Copy', accepts: TEXT_TYPES, max: 5, hint: 'Headline and copy', justify: 'center', maxWidth: 620, pad: 110 },
    ],
    seed: () => ({
      media: [IMG()],
      main: [T('Sourcing', 'eyebrow'), T('We buy where the food is best.', 'headline'), T('Direct relationships with growers in Italy, Spain, Greece and Peru — no brokers between the field and the jar.', 'body')],
    }),
  },
  {
    id: 'quote',
    name: 'Quote',
    category: 'Storytelling',
    hint: 'One voice, given room.',
    layout: lay('1fr', '1fr', ['main'], 160, 30),
    background: { kind: 'color', color: 'cream', overlay: 'none' },
    slots: [{ key: 'main', label: 'Quote', accepts: ['quote', 'text'], max: 2, hint: 'Add a quote', justify: 'center', maxWidth: 1200 }],
    seed: () => ({ main: [QUOTE('They understand the category better than anyone we buy from.', 'Category Manager, National Grocer')] }),
  },
  {
    id: 'timeline',
    name: 'Timeline',
    category: 'Storytelling',
    hint: 'Milestones across one horizontal line. Four to six entries.',
    layout: lay('1fr', 'auto 1fr', ['head', 'main'], 120, 40),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1000 },
      { key: 'main', label: 'Milestones', accepts: ['timeline'], max: 1, hint: 'Add milestones', justify: 'center' },
    ],
    guidance: 'Timelines read best with four to six milestones.',
    seed: () => ({
      head: [T('Heritage', 'eyebrow'), T('Eighty years in the making', 'headline')],
      main: [TIMELINE(['1946 — Founded in Tampa', '1978 — First national listing', '1999 — Alessi acquired', '2019 — New Tampa facility', '2026 — 12,000 doors'])],
    }),
  },

  /* ================================ DATA ============================= */
  {
    id: 'metric-single',
    name: 'Single Metric',
    category: 'Data',
    hint: 'One number, centred, impossible to miss.',
    layout: lay('1fr', '1fr', ['main'], 140, 30),
    slots: [{ key: 'main', label: 'Metric', accepts: ['metric'], max: 1, hint: 'Add statistic', justify: 'center', items: 'center' }],
    seed: () => ({ main: [{ ...M('$24.8M', 'Annual Retail Sales'), style: { role: 'metricXl', color: 'auto', align: 'center' } }] }),
  },
  {
    id: 'metric-two',
    name: 'Two Metrics',
    category: 'Data',
    hint: 'Two statistics side by side.',
    layout: lay('1fr', 'auto 1fr', ['head', 'main'], 120, 40),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Optional heading', justify: 'start', maxWidth: 1000 },
      { key: 'main', label: 'Metrics', accepts: ['metric', 'image'], max: 2, hint: 'Add statistic', dir: 'h', justify: 'center', gap: 80 },
    ],
    guidance: 'This layout works best with 2 metrics.',
    seed: () => ({
      head: [T('Fiscal 2026', 'eyebrow')],
      main: [M('+38%', 'YoY Growth'), M('2,400+', 'Retail Doors')],
    }),
  },
  {
    id: 'metric-three',
    name: 'Three Metrics',
    category: 'Data',
    hint: 'Three statistics across one page. The most used data layout.',
    layout: lay('1fr', 'auto 1fr', ['head', 'main'], 120, 40),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Optional heading', justify: 'start', maxWidth: 1000 },
      { key: 'main', label: 'Metrics', accepts: ['metric', 'image'], max: 3, hint: 'Add statistic', dir: 'h', justify: 'center', gap: 64 },
    ],
    guidance: 'This layout works best with 3 metrics.',
    seed: () => ({
      head: [T('Performance at a glance', 'eyebrow')],
      main: [M('84M', 'Impressions'), M('+42%', 'Engagement'), M('1.2M', 'Video Views')],
    }),
  },
  {
    id: 'metric-four',
    name: 'Four Metrics',
    category: 'Data',
    hint: 'Four clean statistics. Numbers step down a size automatically.',
    layout: lay('1fr', 'auto 1fr', ['head', 'main'], 120, 40),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Optional heading', justify: 'start', maxWidth: 1000 },
      { key: 'main', label: 'Metrics', accepts: ['metric'], max: 4, hint: 'Add statistic', dir: 'h', justify: 'center', gap: 48 },
    ],
    guidance: 'This layout works best with 4 metrics.',
    seed: () => ({
      head: [T('Full year', 'eyebrow')],
      main: [M('$24.8M', 'Retail Sales'), M('+38%', 'YoY Growth'), M('2,400', 'Doors'), M('94%', 'Fill Rate')],
    }),
  },
  {
    id: 'metric-image',
    name: 'Metric + Image',
    category: 'Data',
    hint: 'Large statistic beside photography.',
    layout: lay('1fr 1fr', '1fr', ['main media'], 0, 0),
    slots: [
      { key: 'main', label: 'Metric', accepts: ['metric', 'text'], max: 3, hint: 'Add statistic', justify: 'center', maxWidth: 620, pad: 110 },
      { key: 'media', label: 'Image', accepts: MEDIA_TYPES, max: 1, hint: 'Drop an image here', bleed: true },
    ],
    seed: () => ({
      main: [{ ...M('+146%', 'Growth in the Southeast', 'Driven by expanded retail distribution across Florida and Georgia.'), style: { role: 'metricXl', color: 'auto', align: 'left' } }],
      media: [IMG()],
    }),
  },
  {
    id: 'metric-context',
    name: 'Metric + Context',
    category: 'Data',
    hint: 'Big number, headline, short paragraph.',
    layout: lay('1.1fr 1fr', '1fr', ['main side'], 120, 90),
    slots: [
      { key: 'main', label: 'Metric', accepts: ['metric'], max: 1, hint: 'Add statistic', justify: 'center' },
      { key: 'side', label: 'Context', accepts: TEXT_TYPES, max: 3, hint: 'Explain the number', justify: 'center', maxWidth: 620 },
    ],
    seed: () => ({
      main: [{ ...M('+42%', 'Year-over-year sales growth'), style: { role: 'metricXl', color: 'auto', align: 'left' } }],
      side: [T('What drove it', 'eyebrow'), T('Growth came from expanded retail distribution across the Southeast, supported by in-store demo programs in 340 locations.', 'body')],
    }),
  },
  {
    id: 'growth-stat',
    name: 'Growth Statistic',
    category: 'Data',
    hint: 'A single growth number with a clean directional indicator.',
    layout: lay('1fr', '1fr', ['main'], 140, 30),
    background: { kind: 'color', color: 'brandPrimary', overlay: 'none' },
    slots: [{ key: 'main', label: 'Growth', accepts: ['metric', 'text'], max: 2, hint: 'Add statistic', justify: 'center', items: 'center' }],
    seed: () => ({ main: [{ ...M('+146%', 'Category growth', 'Twelve months ending December 2026', 'up'), style: { role: 'metricXl', color: 'auto', align: 'center' } }] }),
  },
  {
    id: 'comparison',
    name: 'Comparison',
    category: 'Data',
    hint: 'Two figures set against each other.',
    layout: lay('1fr 1fr', 'auto 1fr', ['head head', 'left right'], 120, 60),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1000 },
      { key: 'left', label: 'Before', accepts: ['metric', 'text'], max: 2, hint: 'Add statistic', justify: 'center' },
      { key: 'right', label: 'After', accepts: ['metric', 'text'], max: 2, hint: 'Add statistic', justify: 'center' },
    ],
    seed: () => ({
      head: [T('2025 vs 2026', 'eyebrow'), T('Two years of distribution', 'headline')],
      left: [M('1,480', 'Doors in 2025')],
      right: [M('2,400', 'Doors in 2026')],
    }),
  },

  /* =============================== SALES ============================= */
  {
    id: 'retail-footprint',
    name: 'Retail Footprint',
    category: 'Sales',
    hint: 'Where the product sits today — metrics plus a supporting visual.',
    layout: lay('1fr 1.2fr', 'auto 1fr', ['head head', 'main media'], 110, 74),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1100 },
      { key: 'main', label: 'Metrics', accepts: ['metric', 'checklist'], max: 3, hint: 'Add statistic', justify: 'center', gap: 40 },
      { key: 'media', label: 'Visual', accepts: MEDIA_TYPES, max: 1, hint: 'Drop a map or store image', bleed: true },
    ],
    seed: () => ({
      head: [T('Retail footprint', 'eyebrow'), T('2,400 doors across 31 states', 'headline')],
      main: [M('2,400', 'Total Doors'), M('31', 'States'), M('+62%', 'Door Growth')],
      media: [IMG()],
    }),
  },
  {
    id: 'sales-growth',
    name: 'Sales Growth',
    category: 'Sales',
    hint: 'Headline growth figure with three supporting numbers.',
    layout: lay('1fr', 'auto auto 1fr', ['head', 'hero', 'main'], 110, 36),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1100 },
      { key: 'hero', label: 'Headline figure', accepts: ['metric'], max: 1, hint: 'Add statistic', justify: 'start' },
      { key: 'main', label: 'Supporting', accepts: ['metric'], max: 3, hint: 'Add statistic', dir: 'h', justify: 'center', gap: 56 },
    ],
    seed: () => ({
      head: [T('Sales performance', 'eyebrow')],
      hero: [{ ...M('+38%', 'Year-over-year retail sales', undefined, 'up'), style: { role: 'metricXl', color: 'auto', align: 'left' } }],
      main: [M('$24.8M', 'Total Sales'), M('$1.9M', 'Q4 Sales'), M('94%', 'Fill Rate')],
    }),
  },
  {
    id: 'product-performance',
    name: 'Product Performance',
    category: 'Sales',
    hint: 'Top performing items with the numbers behind them.',
    layout: lay('1fr 1fr', 'auto 1fr', ['head head', 'media main'], 110, 60),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1100 },
      { key: 'media', label: 'Product', accepts: MEDIA_TYPES, max: 1, hint: 'Drop a product image', bleed: true },
      { key: 'main', label: 'Results', accepts: ['metric', 'checklist', 'text'], max: 4, hint: 'Add results', justify: 'center', gap: 34 },
    ],
    seed: () => ({
      head: [T('Top performers', 'eyebrow'), T('Three items carrying the category', 'headline')],
      media: [IMG()],
      main: [M('+72%', 'Balsamic Reduction'), M('+41%', 'Risotto'), M('+28%', 'Soups')],
    }),
  },
  {
    id: 'retailer-highlight',
    name: 'Retailer Highlight',
    category: 'Sales',
    hint: 'One retailer, one story. Duplicate this page per account.',
    layout: lay('1fr', 'auto 1fr auto', ['top', 'main', 'foot'], 120, 34),
    background: { kind: 'image', media: { url: '', focalX: 0.5, focalY: 0.5, zoom: 1 }, overlay: 'dark' },
    slots: [
      { key: 'top', label: 'Retailer', accepts: TEXT_TYPES, max: 1, hint: 'Retailer name', justify: 'start' },
      { key: 'main', label: 'Story', accepts: TEXT_TYPES, max: 3, hint: 'Headline and copy', justify: 'center', maxWidth: 980 },
      { key: 'foot', label: 'Metrics', accepts: ['metric'], max: 3, hint: 'Add statistic', dir: 'h', justify: 'end', gap: 56 },
    ],
    seed: () => ({
      top: [T('Retailer highlight', 'eyebrow')],
      main: [T('340 stores, one year, category-leading velocity.', 'headline')],
      foot: [M('340', 'Stores'), M('+52%', 'Velocity'), M('#1', 'In Category')],
    }),
  },
  {
    id: 'regional-performance',
    name: 'Regional Performance',
    category: 'Sales',
    hint: 'Region-by-region numbers in a four-up grid.',
    layout: lay('1fr 1fr', 'auto 1fr 1fr', ['head head', 'a b', 'c d'], 110, 48),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1100 },
      { key: 'a', label: 'Region 1', accepts: ['metric'], max: 1, hint: 'Add statistic', justify: 'center' },
      { key: 'b', label: 'Region 2', accepts: ['metric'], max: 1, hint: 'Add statistic', justify: 'center' },
      { key: 'c', label: 'Region 3', accepts: ['metric'], max: 1, hint: 'Add statistic', justify: 'center' },
      { key: 'd', label: 'Region 4', accepts: ['metric'], max: 1, hint: 'Add statistic', justify: 'center' },
    ],
    seed: () => ({
      head: [T('By region', 'eyebrow'), T('Growth is national, but it started in the Southeast', 'headline')],
      a: [M('+62%', 'Southeast')],
      b: [M('+34%', 'Northeast')],
      c: [M('+21%', 'Midwest')],
      d: [M('+18%', 'West')],
    }),
  },
  {
    id: 'key-accounts',
    name: 'Key Accounts',
    category: 'Sales',
    hint: 'A tidy grid of retailer names or logos.',
    layout: lay('1fr', 'auto 1fr', ['head', 'main'], 120, 44),
    background: { kind: 'color', color: 'cream', overlay: 'none' },
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1100 },
      { key: 'main', label: 'Accounts', accepts: ['logoGrid'], max: 1, hint: 'List your accounts', justify: 'center' },
    ],
    seed: () => ({
      head: [T('Key accounts', 'eyebrow'), T('Where you can buy us', 'headline')],
      main: [LOGOGRID(['Publix', 'Kroger', 'Albertsons', 'Wegmans', 'H-E-B', 'Sprouts', 'Meijer', 'Ahold'])],
    }),
  },

  /* =============================== SOCIAL ============================ */
  {
    id: 'social-growth',
    name: 'Social Growth',
    category: 'Social',
    hint: 'Audience growth across platforms.',
    layout: lay('1fr', 'auto 1fr', ['head', 'main'], 120, 40),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1100 },
      { key: 'main', label: 'Metrics', accepts: ['metric'], max: 3, hint: 'Add statistic', dir: 'h', justify: 'center', gap: 64 },
    ],
    guidance: 'This layout works best with 3 metrics.',
    seed: () => ({
      head: [T('Social growth', 'eyebrow'), T('An audience that keeps compounding', 'headline')],
      main: [M('+118K', 'New Followers'), M('+42%', 'Audience Growth'), M('9.4%', 'Follower Velocity')],
    }),
  },
  {
    id: 'engagement',
    name: 'Engagement',
    category: 'Social',
    hint: 'Engagement rate as the hero, context beside it.',
    layout: lay('1.1fr 1fr', '1fr', ['main side'], 120, 90),
    slots: [
      { key: 'main', label: 'Metric', accepts: ['metric'], max: 1, hint: 'Add statistic', justify: 'center' },
      { key: 'side', label: 'Context', accepts: TEXT_TYPES, max: 3, hint: 'Explain the number', justify: 'center', maxWidth: 620 },
    ],
    seed: () => ({
      main: [{ ...M('7.8%', 'Average engagement rate', 'Category benchmark: 2.1%'), style: { role: 'metricXl', color: 'auto', align: 'left' } }],
      side: [T('Engagement', 'eyebrow'), T('Recipe-led content outperformed product content by nearly four to one across every platform.', 'body')],
    }),
  },
  {
    id: 'reach-impressions',
    name: 'Reach / Impressions',
    category: 'Social',
    hint: 'Reach numbers over a full-bleed image.',
    layout: lay('1fr', 'auto 1fr', ['head', 'main'], 120, 40),
    background: { kind: 'image', media: { url: '', focalX: 0.5, focalY: 0.5, zoom: 1 }, overlay: 'dark' },
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1100 },
      { key: 'main', label: 'Metrics', accepts: ['metric'], max: 3, hint: 'Add statistic', dir: 'h', justify: 'end', gap: 64 },
    ],
    seed: () => ({
      head: [T('Reach', 'eyebrow')],
      main: [M('84M', 'Impressions'), M('22M', 'Reach'), M('1.2M', 'Video Views')],
    }),
  },
  {
    id: 'social-screens',
    name: 'Social Screenshots',
    category: 'Social',
    hint: 'Three vertical posts side by side.',
    layout: lay('1fr 1fr 1fr', 'auto 1fr', ['head head head', 'a b c'], 110, 40),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1100 },
      { key: 'a', label: 'Post 1', accepts: MEDIA_TYPES, max: 1, hint: 'Drop a screenshot', bleed: true },
      { key: 'b', label: 'Post 2', accepts: MEDIA_TYPES, max: 1, hint: 'Drop a screenshot', bleed: true },
      { key: 'c', label: 'Post 3', accepts: MEDIA_TYPES, max: 1, hint: 'Drop a screenshot', bleed: true },
    ],
    seed: () => ({ head: [T('Top content', 'eyebrow')], a: [IMG()], b: [IMG()], c: [IMG()] }),
  },
  {
    id: 'campaign-performance',
    name: 'Campaign Performance',
    category: 'Social',
    hint: 'Campaign creative with the results next to it.',
    layout: lay('1fr 1fr', '1fr', ['media main'], 0, 0),
    slots: [
      { key: 'media', label: 'Creative', accepts: MEDIA_TYPES, max: 1, hint: 'Drop campaign creative', bleed: true },
      { key: 'main', label: 'Results', accepts: ['metric', 'text', 'checklist'], max: 4, hint: 'Add results', justify: 'center', maxWidth: 620, gap: 30, pad: 110 },
    ],
    seed: () => ({
      media: [IMG()],
      main: [T('Summer of Sauce', 'eyebrow'), T('Six weeks, four creators, one hero SKU.', 'headline'), M('+64%', 'Sales lift during flight')],
    }),
  },
  {
    id: 'influencer-results',
    name: 'Influencer Results',
    category: 'Social',
    hint: 'Creator partnership outcomes in a four-up grid.',
    layout: lay('1fr 1fr', 'auto 1fr 1fr', ['head head', 'a b', 'c d'], 110, 44),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1100 },
      { key: 'a', label: 'Result 1', accepts: ['metric'], max: 1, hint: 'Add statistic', justify: 'center' },
      { key: 'b', label: 'Result 2', accepts: ['metric'], max: 1, hint: 'Add statistic', justify: 'center' },
      { key: 'c', label: 'Result 3', accepts: ['metric'], max: 1, hint: 'Add statistic', justify: 'center' },
      { key: 'd', label: 'Result 4', accepts: ['metric'], max: 1, hint: 'Add statistic', justify: 'center' },
    ],
    seed: () => ({
      head: [T('Creator program', 'eyebrow'), T('Four partners, measurable lift', 'headline')],
      a: [M('42', 'Creators')],
      b: [M('18M', 'Impressions')],
      c: [M('6.1%', 'Engagement')],
      d: [M('$4.20', 'Earned Media Value / $1')],
    }),
  },

  /* ============================== PRODUCTS =========================== */
  {
    id: 'hero-product',
    name: 'Hero Product',
    category: 'Products',
    hint: 'One product, centre stage.',
    layout: lay('1fr 1fr', '1fr', ['main media'], 0, 0),
    background: { kind: 'color', color: 'cream', overlay: 'none' },
    slots: [
      { key: 'main', label: 'Copy', accepts: TEXT_TYPES, max: 4, hint: 'Product name and copy', justify: 'center', maxWidth: 620, pad: 110 },
      { key: 'media', label: 'Product', accepts: MEDIA_TYPES, max: 1, hint: 'Drop a product image', bleed: true },
    ],
    seed: () => ({
      main: [T('New for 2027', 'eyebrow'), T('Balsamic Reduction', 'headline'), T('Aged in Modena, reduced slowly, finished thick enough to hold a line on the plate.', 'body')],
      media: [IMG()],
    }),
  },
  {
    id: 'product-family',
    name: 'Product Family',
    category: 'Products',
    hint: 'Three or four products in a row.',
    layout: lay('1fr 1fr 1fr', 'auto 1fr auto', ['head head head', 'a b c', 'la lb lc'], 110, 32),
    background: { kind: 'color', color: 'cream', overlay: 'none' },
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1100 },
      { key: 'a', label: 'Product 1', accepts: MEDIA_TYPES, max: 1, hint: 'Drop a product image', bleed: true },
      { key: 'b', label: 'Product 2', accepts: MEDIA_TYPES, max: 1, hint: 'Drop a product image', bleed: true },
      { key: 'c', label: 'Product 3', accepts: MEDIA_TYPES, max: 1, hint: 'Drop a product image', bleed: true },
      { key: 'la', label: 'Label 1', accepts: ['text'], max: 1, hint: 'Name', justify: 'start', items: 'center' },
      { key: 'lb', label: 'Label 2', accepts: ['text'], max: 1, hint: 'Name', justify: 'start', items: 'center' },
      { key: 'lc', label: 'Label 3', accepts: ['text'], max: 1, hint: 'Name', justify: 'start', items: 'center' },
    ],
    seed: () => ({
      head: [T('The range', 'eyebrow'), T('Built to sit together on shelf', 'headline')],
      a: [IMG()],
      b: [IMG()],
      c: [IMG()],
      la: [{ ...T('Balsamic Reduction', 'caption'), style: { role: 'caption', color: 'auto', align: 'center' } }],
      lb: [{ ...T('Risotto Milanese', 'caption'), style: { role: 'caption', color: 'auto', align: 'center' } }],
      lc: [{ ...T('Tuscan White Bean', 'caption'), style: { role: 'caption', color: 'auto', align: 'center' } }],
    }),
  },
  {
    id: 'product-description',
    name: 'Product + Description',
    category: 'Products',
    hint: 'Product shot with specification-style detail.',
    layout: lay('1fr 1fr', '1fr', ['media main'], 0, 0),
    slots: [
      { key: 'media', label: 'Product', accepts: MEDIA_TYPES, max: 1, hint: 'Drop a product image', bleed: true },
      { key: 'main', label: 'Detail', accepts: TEXT_TYPES, max: 5, hint: 'Describe the product', justify: 'center', maxWidth: 620, pad: 110 },
    ],
    seed: () => ({
      media: [IMG()],
      main: [T('Item 4412', 'eyebrow'), T('Risotto Milanese', 'headline'), CHECKS(['8.8 oz shelf-stable', '12 per case', 'Ready in 18 minutes', 'No artificial colors'])],
    }),
  },
  {
    id: 'product-comparison',
    name: 'Product Comparison',
    category: 'Products',
    hint: 'Two products, honestly compared.',
    layout: lay('1fr 1fr', 'auto 1fr auto', ['head head', 'a b', 'la lb'], 110, 36),
    background: { kind: 'color', color: 'cream', overlay: 'none' },
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1100 },
      { key: 'a', label: 'Product A', accepts: MEDIA_TYPES, max: 1, hint: 'Drop a product image', bleed: true },
      { key: 'b', label: 'Product B', accepts: MEDIA_TYPES, max: 1, hint: 'Drop a product image', bleed: true },
      { key: 'la', label: 'Detail A', accepts: TEXT_TYPES, max: 2, hint: 'Detail', justify: 'start' },
      { key: 'lb', label: 'Detail B', accepts: TEXT_TYPES, max: 2, hint: 'Detail', justify: 'start' },
    ],
    seed: () => ({
      head: [T('Comparison', 'eyebrow'), T('Standard vs Reserve', 'headline')],
      a: [IMG()],
      b: [IMG()],
      la: [{ ...T('Standard — 8.8 oz', 'caption'), style: { role: 'caption', color: 'auto', align: 'left' } }],
      lb: [{ ...T('Reserve — 12 oz, aged 12 years', 'caption'), style: { role: 'caption', color: 'auto', align: 'left' } }],
    }),
  },
  {
    id: 'new-launch',
    name: 'New Product Launch',
    category: 'Products',
    hint: 'Announcement page. Full-bleed image, product name held large.',
    layout: lay('1fr', 'auto 1fr auto', ['top', 'main', 'foot'], 120, 30),
    background: { kind: 'image', media: { url: '', focalX: 0.5, focalY: 0.5, zoom: 1 }, overlay: 'gradient' },
    slots: [
      { key: 'top', label: 'Eyebrow', accepts: TEXT_TYPES, max: 1, hint: 'New for 2027', justify: 'start' },
      { key: 'main', label: 'Product', accepts: TEXT_TYPES, max: 2, hint: 'Product name', justify: 'end', maxWidth: 1100 },
      { key: 'foot', label: 'Detail', accepts: TEXT_TYPES, max: 2, hint: 'Ship date, case pack', justify: 'end', maxWidth: 900 },
    ],
    seed: () => ({
      top: [T('New for 2027', 'eyebrow')],
      main: [T('Fruit Cart Pineapple', 'display')],
      foot: [T('Shipping March 2027 · 12 per case · Item 6180', 'caption')],
    }),
  },


  /* =========================== CARDS & GRIDS ========================= */
  {
    id: 'cards-two',
    name: 'Two Cards',
    category: 'Cards & Grids',
    hint: 'Two cards with imagery, headline and supporting copy.',
    layout: lay('1fr', 'auto 1fr', ['head', 'main'], 110, 44),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1100 },
      { key: 'main', label: 'Cards', accepts: CARD_TYPES, max: 2, hint: 'Add a card', dir: 'h', justify: 'start', gap: 70 },
    ],
    guidance: 'Two cards give each one real presence. Keep the copy to a sentence.',
    seed: () => ({
      head: [T('In focus', 'eyebrow'), T('Two things worth your attention', 'headline')],
      main: [
        CARD('Balsamic Reduction', 'Aged in Modena, reduced slowly, thick enough to hold a line on the plate.'),
        CARD('Risotto Milanese', 'Carnaroli rice and real saffron. On the table in eighteen minutes.'),
      ],
    }),
  },
  {
    id: 'cards-three',
    name: 'Three Cards',
    category: 'Cards & Grids',
    hint: 'Three cards across. The everyday workhorse for ranges and reasons-to-believe.',
    layout: lay('1fr', 'auto 1fr', ['head', 'main'], 110, 44),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1100 },
      { key: 'main', label: 'Cards', accepts: CARD_TYPES, max: 3, hint: 'Add a card', dir: 'h', justify: 'start', gap: 54 },
    ],
    guidance: 'This layout works best with 3 cards.',
    seed: () => ({
      head: [T('The range', 'eyebrow'), T('Three ways in', 'headline')],
      main: [
        CARD('Balsamic Reduction', 'Aged in Modena, reduced slowly, finished thick.'),
        CARD('Risotto Milanese', 'Carnaroli rice and real saffron, ready in eighteen minutes.'),
        CARD('Tuscan White Bean', 'Slow simmered cannellini, rosemary and good olive oil.'),
      ],
    }),
  },
  {
    id: 'cards-four',
    name: 'Four Cards',
    category: 'Cards & Grids',
    hint: 'Four cards in a two-by-two grid. Type steps down automatically.',
    layout: lay('1fr 1fr', 'auto 1fr 1fr', ['head head', 'a b', 'c d'], 105, 44),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1100 },
      { key: 'a', label: 'Card 1', accepts: CARD_TYPES, max: 1, hint: 'Add a card', justify: 'start' },
      { key: 'b', label: 'Card 2', accepts: CARD_TYPES, max: 1, hint: 'Add a card', justify: 'start' },
      { key: 'c', label: 'Card 3', accepts: CARD_TYPES, max: 1, hint: 'Add a card', justify: 'start' },
      { key: 'd', label: 'Card 4', accepts: CARD_TYPES, max: 1, hint: 'Add a card', justify: 'start' },
    ],
    seed: () => ({
      head: [T('The line-up', 'eyebrow')],
      a: [CARD('Balsamic Reduction', 'Aged in Modena.', { image: false })],
      b: [CARD('Risotto Milanese', 'Carnaroli and saffron.', { image: false })],
      c: [CARD('Tuscan White Bean', 'Slow simmered cannellini.', { image: false })],
      d: [CARD('Roasted Peppers', 'Fire roasted, hand packed.', { image: false })],
    }),
  },
  {
    id: 'product-cards',
    name: 'Four Product Cards',
    category: 'Cards & Grids',
    hint: 'Four products with headline, blurb and optional wholesale / MSRP. Drag to reorder.',
    layout: lay('1fr 1fr 1fr 1fr', 'auto 1fr', ['head head head head', 'a b c d'], 100, 38),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1200 },
      { key: 'a', label: 'Product 1', accepts: CARD_TYPES, max: 1, hint: 'Add a product', justify: 'start' },
      { key: 'b', label: 'Product 2', accepts: CARD_TYPES, max: 1, hint: 'Add a product', justify: 'start' },
      { key: 'c', label: 'Product 3', accepts: CARD_TYPES, max: 1, hint: 'Add a product', justify: 'start' },
      { key: 'd', label: 'Product 4', accepts: CARD_TYPES, max: 1, hint: 'Add a product', justify: 'start' },
    ],
    guidance: 'Leave a price blank and it simply disappears — nothing looks broken.',
    seed: () => ({
      head: [T('New for 2027', 'eyebrow'), T('Four items, one shelf story', 'headline')],
      a: [CARD('Balsamic Reduction', 'Aged in Modena. 8.8 oz, 12 per case.', { wholesale: '$4.20', msrp: '$7.99' })],
      b: [CARD('Risotto Milanese', 'Carnaroli and saffron. 7.9 oz, 12 per case.', { wholesale: '$3.05', msrp: '$5.99' })],
      c: [CARD('Tuscan White Bean', 'Cannellini and rosemary. 15 oz, 12 per case.', { wholesale: '$2.40', msrp: '$4.49' })],
      d: [CARD('Fruit Cart Pineapple', 'Bold, crunchy, made to top. 12 oz.', { wholesale: '$3.60', msrp: '$6.49' })],
    }),
  },
  {
    id: 'split-text-image',
    name: 'Context + Image',
    category: 'Cards & Grids',
    hint: 'Context on the left, photography on the right. The mirror of Split Image / Text.',
    layout: lay('1fr 1fr', '1fr', ['main media'], 0, 0),
    slots: [
      { key: 'main', label: 'Context', accepts: TEXT_TYPES, max: 6, hint: 'Headline and copy', justify: 'center', maxWidth: 640, pad: 110 },
      { key: 'media', label: 'Image', accepts: MEDIA_TYPES, max: 1, hint: 'Drop an image here', bleed: true },
    ],
    seed: () => ({
      main: [
        T('Why it works', 'eyebrow'),
        T('Built for the way people actually cook.', 'headline'),
        T('Shelf stable, ready in under twenty minutes, and made from a short list of ingredients a shopper can pronounce.', 'body'),
        CHECKS(['No artificial colours', 'Imported directly', 'Twelve per case']),
      ],
      media: [IMG()],
    }),
  },
  {
    id: 'gallery-six',
    name: 'Gallery',
    category: 'Cards & Grids',
    hint: 'Six images in an even grid. Good for lookbooks and social recaps.',
    layout: lay('1fr 1fr 1fr', 'auto 1fr 1fr', ['head head head', 'a b c', 'd e f'], 100, 22),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1200 },
      { key: 'a', label: 'Image 1', accepts: MEDIA_TYPES, max: 1, hint: 'Drop an image', bleed: true },
      { key: 'b', label: 'Image 2', accepts: MEDIA_TYPES, max: 1, hint: 'Drop an image', bleed: true },
      { key: 'c', label: 'Image 3', accepts: MEDIA_TYPES, max: 1, hint: 'Drop an image', bleed: true },
      { key: 'd', label: 'Image 4', accepts: MEDIA_TYPES, max: 1, hint: 'Drop an image', bleed: true },
      { key: 'e', label: 'Image 5', accepts: MEDIA_TYPES, max: 1, hint: 'Drop an image', bleed: true },
      { key: 'f', label: 'Image 6', accepts: MEDIA_TYPES, max: 1, hint: 'Drop an image', bleed: true },
    ],
    seed: () => ({
      head: [T('Gallery', 'eyebrow')],
      a: [IMG()], b: [IMG()], c: [IMG()], d: [IMG()], e: [IMG()], f: [IMG()],
    }),
  },
  {
    id: 'gallery-feature',
    name: 'Feature Gallery',
    category: 'Cards & Grids',
    hint: 'One hero image with four supporting frames.',
    layout: lay('2fr 1fr 1fr', 'auto 1fr 1fr', ['head head head', 'a b c', 'a d e'], 100, 22),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1200 },
      { key: 'a', label: 'Hero image', accepts: MEDIA_TYPES, max: 1, hint: 'Drop the hero image', bleed: true },
      { key: 'b', label: 'Image 2', accepts: MEDIA_TYPES, max: 1, hint: 'Drop an image', bleed: true },
      { key: 'c', label: 'Image 3', accepts: MEDIA_TYPES, max: 1, hint: 'Drop an image', bleed: true },
      { key: 'd', label: 'Image 4', accepts: MEDIA_TYPES, max: 1, hint: 'Drop an image', bleed: true },
      { key: 'e', label: 'Image 5', accepts: MEDIA_TYPES, max: 1, hint: 'Drop an image', bleed: true },
    ],
    seed: () => ({
      head: [T('Campaign gallery', 'eyebrow')],
      a: [IMG()], b: [IMG()], c: [IMG()], d: [IMG()], e: [IMG()],
    }),
  },
  {
    id: 'partner-grid',
    name: 'Partner / Vendor Grid',
    category: 'Cards & Grids',
    hint: 'A full page of partner, vendor or retailer logos in an even grid.',
    layout: lay('1fr', 'auto 1fr', ['head', 'main'], 110, 44),
    background: { kind: 'color', color: 'cream', overlay: 'none' },
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1200 },
      { key: 'main', label: 'Logos', accepts: ['logoGrid'], max: 1, hint: 'List your partners', justify: 'center' },
    ],
    guidance: 'Set the number of columns in the panel — five reads well for fifteen or twenty logos.',
    seed: () => ({
      head: [T('Partners', 'eyebrow'), T('Who we work with', 'headline')],
      main: [
        {
          ...LOGOGRID([
            'Publix', 'Kroger', 'Albertsons', 'Wegmans', 'H-E-B',
            'Sprouts', 'Meijer', 'Ahold', 'Hy-Vee', 'Giant Eagle',
            'Wakefern', 'Save Mart', 'Raley\u2019s', 'Winn-Dixie', 'Fresh Market',
          ]),
          columns: 5,
        },
      ],
    }),
  },

  /* =============================== CLOSING =========================== */
  {
    id: 'key-takeaways',
    name: 'Key Takeaways',
    category: 'Closing',
    hint: 'Three to five checkmarked points. Nothing more.',
    layout: lay('1fr', 'auto 1fr auto', ['head', 'main', 'foot'], 130, 40),
    slots: [
      { key: 'head', label: 'Heading', accepts: TEXT_TYPES, max: 2, hint: 'Heading', justify: 'start', maxWidth: 1100 },
      { key: 'main', label: 'Takeaways', accepts: ['checklist', 'bullets'], max: 1, hint: 'Add takeaways', justify: 'center', maxWidth: 1200 },
      { key: 'foot', label: 'Brand mark', accepts: ['logo'], max: 1, hint: 'Logo', justify: 'end', items: 'start' },
    ],
    guidance: 'Takeaways land best at three to five points.',
    seed: () => ({
      head: [T('In summary', 'eyebrow'), T('Key takeaways', 'headline')],
      main: [CHECKS(['Retail sales up 38% year over year', 'Distribution expanded to 2,400 doors', 'Balsamic Reduction is the growth engine', 'Marketing support doubles in Q1'])],
      foot: [LOGO()],
    }),
  },
  {
    id: 'contact',
    name: 'Contact',
    category: 'Closing',
    hint: 'Who to call, and nothing else.',
    layout: lay('1fr 1fr', '1fr auto', ['main side', 'foot foot'], 130, 60),
    background: { kind: 'color', color: 'brandPrimary', overlay: 'none' },
    slots: [
      { key: 'main', label: 'Heading', accepts: TEXT_TYPES, max: 3, hint: 'Heading', justify: 'center', maxWidth: 620 },
      { key: 'side', label: 'Details', accepts: TEXT_TYPES, max: 4, hint: 'Name, email, phone', justify: 'center', maxWidth: 620 },
      { key: 'foot', label: 'Brand mark', accepts: ['logo'], max: 1, hint: 'Logo', justify: 'end', items: 'start' },
    ],
    seed: () => ({
      main: [T('Next steps', 'eyebrow'), T("Let's build the plan.", 'headline')],
      side: [T('Sales Team', 'caption'), T('sales@vigofoods.com', 'subhead'), T('813 555 0100', 'subhead')],
      foot: [LOGO()],
    }),
  },
  {
    id: 'thank-you',
    name: 'Thank You',
    category: 'Closing',
    hint: 'Closing frame with the brand mark.',
    layout: lay('1fr', '1fr auto', ['main', 'foot'], 130, 30),
    background: { kind: 'image', media: { url: '', focalX: 0.5, focalY: 0.5, zoom: 1 }, overlay: 'dark' },
    slots: [
      { key: 'main', label: 'Message', accepts: TEXT_TYPES, max: 2, hint: 'Thank you', justify: 'center', items: 'center', maxWidth: 1100 },
      { key: 'foot', label: 'Logo', accepts: ['logo'], max: 1, hint: 'Logo', justify: 'end', items: 'center' },
    ],
    seed: () => ({ main: [T('Thank you', 'display')], foot: [LOGO()] }),
  },
];

export const TEMPLATES: PageTemplate[] = templates;

const byId: Record<string, PageTemplate> = {};
templates.forEach((t) => (byId[t.id] = t));

export function getTemplate(id: string): PageTemplate {
  return byId[id] || byId['brand-statement'];
}

export function templatesByCategory(): { category: TemplateCategory; items: PageTemplate[] }[] {
  return TEMPLATE_CATEGORIES.map((category) => ({
    category,
    items: templates.filter((t) => t.category === category),
  })).filter((g) => g.items.length > 0);
}

/**
 * Brings an existing page up to date with its template.
 *
 * When a template gains a slot — a brand mark on the closing pages, say — decks
 * created before that change have no record of it. This fills only slots the
 * page has never had; a slot the user deliberately emptied stays empty.
 */
export function hydratePage(page: Page): Page {
  const t = getTemplate(page.templateId);
  const missing = t.slots.filter((s) => page.slots?.[s.key] === undefined);
  if (missing.length === 0) return page;
  const seed = t.seed();
  const slots = { ...(page.slots || {}) };
  missing.forEach((s) => {
    slots[s.key] = seed[s.key] ? seed[s.key] : [];
  });
  return { ...page, slots };
}

/** Creates a fully-formed page from a template — never a blank page. */
export function createPage(templateId: string, sectionStart?: string): Page {
  const t = getTemplate(templateId);
  const slots = t.seed();
  t.slots.forEach((s) => {
    if (!slots[s.key]) slots[s.key] = [];
  });
  const pid = uid('pg');

  // Pages arrive designed, not empty: every image area starts with a
  // placeholder plate the user replaces with real photography.
  let n = 0;
  Object.keys(slots).forEach((k) => {
    slots[k].forEach((b) => {
      if ((b.type === 'image' || (b.type === 'card' && b.showImage !== false)) && (!b.media || !b.media.url)) {
        b.media = { url: placeholderImage(t.id + k + n++, ''), width: 1200, height: 800, focalX: 0.5, focalY: 0.5, zoom: 1 };
      }
    });
  });

  const background: PageBackground = t.background
    ? JSON.parse(JSON.stringify(t.background))
    : { kind: 'theme', overlay: 'none' };
  if ((background.kind === 'image' || background.kind === 'video') && !background.media?.url) {
    background.kind = 'image';
    background.media = { url: placeholderImage(t.id + 'bg', ''), width: 1200, height: 800, focalX: 0.5, focalY: 0.5, zoom: 1 };
  }

  return { id: pid, templateId: t.id, sectionStart, background, slots };
}
