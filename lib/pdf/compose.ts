'use client';

import type { Block, Page } from '@/lib/model/types';
import { uid } from '@/lib/model/types';
import { createPage, getTemplate } from '@/lib/templates/registry';
import type { BrandId, TypeRole } from '@/lib/brand/themes';
import type { PageReading } from './interpret';
import type { ExtractedImage } from './extract';

/**
 * TURNING A READING INTO A PAGE
 * ---------------------------------------------------------------------------
 * This is the part that decides what the deck looks like, and it works the only
 * way that keeps the deck on brand: it never invents a layout. It picks one of
 * the existing templates and pours the content into that template's own blocks,
 * so every page that comes out of a PDF is indistinguishable from a page a
 * person built — same slots, same typography roles, same spacing, and it
 * re-themes automatically when the brand tokens change.
 *
 * `createPage` already returns a designed page with the right blocks in the
 * right slots. Composing is therefore a matter of replacing that page's content
 * and DELETING whatever we had nothing to put in — a leftover seeded line is
 * far more damaging than a slightly emptier page, because it looks like real
 * copy and ships to a buyer that way.
 */

export interface ComposeOptions {
  brand: BrandId;
  /**
   * Resolves an extracted picture to a stored asset. Returns null when the
   * picture was not uploaded, in which case the template keeps its placeholder.
   */
  resolve?: (img: ExtractedImage) => { url: string; width?: number; height?: number } | null;
}

export interface ComposedPage {
  page: Page;
  /** what the page was judged to be, in plain words, for the review list */
  reason: string;
  templateId: string;
  /** true when the source page could not be read and the page is a stub */
  unreadable: boolean;
  notes: string[];
}

/* ------------------------------------------------------------ the decision */

/**
 * Chooses the template. Order matters: the tests run from most specific
 * evidence to least, so a page with three figures becomes a metric layout
 * rather than falling through to a generic text page.
 */
function chooseTemplate(r: PageReading, first: boolean, last: boolean): { id: string; reason: string } {
  const words = r.body.join(' ').split(/\s+/).filter(Boolean).length;
  const heroImage = !!r.hero;
  const title = r.display || r.headline;

  if (r.flattened) return { id: 'full-bleed', reason: 'Flattened to an image — kept as a full-bleed picture' };

  if (first && title) {
    return { id: 'cover', reason: 'First page with a title — cover' };
  }

  if (r.quote) return { id: 'quote', reason: 'Quotation marks and an attribution — quote' };

  if (r.table) {
    return { id: 'data-table', reason: `A ${r.table.rows.length}-row table` };
  }

  if (r.metrics.length) {
    if (r.metrics.length === 1 && heroImage) return { id: 'metric-image', reason: 'One figure beside a picture' };
    // One sentence of surviving prose is context, and context wants the layout
    // built for it. `metric-single` is for a figure that stands alone; giving it
    // a paragraph squeezes real argument into a caption.
    if (r.metrics.length === 1 && words >= 12)
      return { id: 'metric-context', reason: 'One figure with an explanation' };
    const byCount: Record<number, string> = {
      1: 'metric-single',
      2: 'metric-two',
      3: 'metric-three',
    };
    const id = byCount[r.metrics.length] || 'metric-four';
    return { id, reason: `${r.metrics.length} figure${r.metrics.length === 1 ? '' : 's'}` };
  }

  if (r.bullets.length) {
    if (r.bullets.length <= 6) return { id: 'key-takeaways', reason: `${r.bullets.length} bullets` };
    return { id: 'key-takeaways', reason: `${r.bullets.length} bullets — more than the layout wants` };
  }

  // A title on its own, set large, with nothing else: that is a divider, and it
  // is one of the few things a deck exported to PDF gets right consistently.
  if (title && !words && !r.bullets.length) {
    if (heroImage) return { id: 'full-bleed', reason: 'Title over a full-page image' };
    return { id: 'section-divider', reason: 'A title and nothing else — section divider' };
  }

  if (heroImage && title && words) return { id: 'image-copy', reason: 'Picture, title and copy' };
  if (heroImage && title) return { id: 'image-headline', reason: 'Picture with a title over it' };
  if (r.images.length >= 4) return { id: 'gallery-six', reason: `${r.images.length} pictures — gallery` };
  if (r.images.length >= 2 && title) return { id: 'cards-three', reason: 'Several pictures with a title' };

  if (last && title && words < 20) return { id: 'thank-you', reason: 'Last page — closing' };

  if (words > 90) return { id: 'brand-statement', reason: 'A page of prose' };
  if (title) return { id: 'image-copy', reason: 'Title and copy' };

  return { id: 'brand-statement', reason: 'Text only' };
}

/* ------------------------------------------------------------- composition */

export function compose(readings: PageReading[], opts: ComposeOptions): ComposedPage[] {
  return readings.map((r, i) => {
    const { id, reason } = chooseTemplate(r, i === 0, i === readings.length - 1);
    const page = createPage(id, undefined, opts.brand);
    fill(page, r, opts);
    return {
      page,
      reason,
      templateId: id,
      unreadable: r.flattened,
      notes: r.notes,
    };
  });
}

function fill(page: Page, r: PageReading, opts: ComposeOptions) {
  const template = getTemplate(page.templateId);

  // Content queues. Each seeded block draws from the queue that matches what it
  // is, so a template with two text blocks gets the title and the copy in the
  // order the designer intended rather than in PDF reading order.
  const titles = [r.display, r.headline].filter(Boolean) as string[];
  const eyebrows = r.eyebrow ? [r.eyebrow] : [];
  const body = r.body.slice();
  const metrics = r.metrics.slice();
  const pictures = r.images.slice();

  for (const slot of template.slots) {
    const blocks = page.slots[slot.key] || [];
    const kept: Block[] = [];

    for (const b of blocks) {
      if (fillBlock(b, { titles, eyebrows, body, metrics, pictures, reading: r, opts })) kept.push(b);
    }

    // Bullets and metrics can exceed what the seed provided. Cloning the last
    // block of the right kind keeps every item on the page instead of silently
    // dropping the ones that did not fit.
    if (slot.accepts.includes('metric') && metrics.length) {
      const model = kept.find((b) => b.type === 'metric');
      while (metrics.length && model && kept.length < slot.max) {
        const m = metrics.shift()!;
        kept.push({ ...model, id: uid('b'), value: m.value, label: m.label, support: m.support });
      }
    }

    page.slots[slot.key] = kept;
  }

  // Whatever the template had no block for still has to appear. Several of the
  // data layouts seed only an eyebrow in their heading slot, so a page's actual
  // title lands here — and silently dropping the heading is the worst thing an
  // import can do, worse than any layout mistake, because the reader cannot
  // tell it happened.
  const leftovers: { text: string; role: TypeRole }[] = [
    ...titles.map((t) => ({ text: t, role: 'headline' as TypeRole })),
    ...(body.length ? [{ text: body.join(' '), role: 'body' as TypeRole }] : []),
  ];
  for (const item of leftovers) {
    const target = template.slots.find(
      (s) => s.accepts.includes('text') && (page.slots[s.key] || []).length < s.max
    );
    if (!target) break;
    const list = page.slots[target.key] || [];
    list.push({
      id: uid('b'),
      type: 'text',
      text: item.text,
      style: { role: item.role, color: 'auto', align: 'left' },
    });
    page.slots[target.key] = list;
  }

  /* -- the picture -------------------------------------------------------- */
  const hero = r.hero || r.images[0];
  if (hero && opts.resolve) {
    const asset = opts.resolve(hero);
    if (asset && (page.background.kind === 'image' || page.background.kind === 'video')) {
      page.background = {
        ...page.background,
        kind: 'image',
        media: { ...(page.background.media || {}), url: asset.url, width: asset.width, height: asset.height, focalX: 0.5, focalY: 0.5, zoom: 1 },
      };
    }
  }
}

interface Queues {
  titles: string[];
  eyebrows: string[];
  body: string[];
  metrics: PageReading['metrics'];
  pictures: ExtractedImage[];
  reading: PageReading;
  opts: ComposeOptions;
}

/** Returns false when the block had nothing to say and should be removed. */
function fillBlock(b: Block, q: Queues): boolean {
  switch (b.type) {
    case 'logo':
    case 'divider':
      return true;

    case 'text': {
      const role = b.style?.role;
      if (role === 'eyebrow') {
        const t = q.eyebrows.shift();
        if (!t) return false;
        b.text = t;
        return true;
      }
      if (role === 'display' || role === 'headline' || role === 'subhead') {
        const t = q.titles.shift() || q.body.shift();
        if (!t) return false;
        b.text = t;
        return true;
      }
      const t = q.body.shift() || q.titles.shift();
      if (!t) return false;
      b.text = t;
      return true;
    }

    case 'metric': {
      const m = q.metrics.shift();
      if (!m) return false;
      b.value = m.value;
      b.label = m.label;
      b.support = m.support;
      return true;
    }

    case 'bullets':
    case 'checklist': {
      if (!q.reading.bullets.length) return false;
      b.items = q.reading.bullets.slice();
      return true;
    }

    case 'timeline': {
      if (!q.reading.bullets.length) return false;
      b.items = q.reading.bullets.slice();
      return true;
    }

    case 'quote': {
      if (!q.reading.quote) return false;
      b.text = q.reading.quote.text;
      b.label = q.reading.quote.attribution;
      return true;
    }

    case 'table': {
      if (!q.reading.table) return false;
      b.table = { headers: q.reading.table.headers, rows: q.reading.table.rows };
      return true;
    }

    case 'image': {
      const img = q.pictures.shift();
      const asset = img && q.opts.resolve ? q.opts.resolve(img) : null;
      if (asset) {
        b.media = { ...(b.media || {}), url: asset.url, width: asset.width, height: asset.height, focalX: 0.5, focalY: 0.5, zoom: 1 };
      }
      // A placeholder plate is kept deliberately: the slot is part of the
      // design, and an empty frame invites the user to fill it. Dropping it
      // would quietly change the layout.
      return true;
    }

    case 'card': {
      const t = q.body.shift() || q.titles.shift();
      if (t) b.text = t;
      const img = q.pictures.shift();
      const asset = img && q.opts.resolve ? q.opts.resolve(img) : null;
      if (asset) b.media = { ...(b.media || {}), url: asset.url, width: asset.width, height: asset.height };
      return !!t || !!asset;
    }

    default:
      return true;
  }
}
