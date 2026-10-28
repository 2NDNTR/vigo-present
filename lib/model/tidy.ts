import type { Block, Page } from '@/lib/model/types';
import { getTemplate } from '@/lib/templates/registry';

/**
 * TIDY — put a page back on its layout's approved styling.
 * ---------------------------------------------------------------------------
 * Pages built in V1 (or by hand) collect one-off choices: a card title set
 * huge, another set small, pictures cropped three different ways. Tidying
 * removes those choices and lets the layout and the brand decide again:
 *
 *  - text takes the role the layout gives that position (in heading areas the
 *    roles are matched from the end, so a lone title stays the headline rather
 *    than becoming the eyebrow above one);
 *  - every other block drops its own styling, so repeated items match;
 *  - pictures lose individual crops and zooms (focal points are kept);
 *  - if any card in an area shows a picture, all of them do.
 *
 * Words, figures and pictures are untouched. Returns how many things changed.
 */
export function tidyPage(page: Page): number {
  const t = getTemplate(page.templateId);
  const seed = t.seed();
  let changed = 0;
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

  for (const slot of t.slots) {
    const blocks: Block[] = page.slots[slot.key] || [];
    const ref = seed[slot.key] || [];
    const refText = ref.filter((b) => b.type === 'text');
    const texts = blocks.filter((b) => b.type === 'text');
    const fromEnd = slot.key === 'head' || /head/i.test(slot.label);

    blocks.forEach((b) => {
      let want: Block['style'] | undefined;
      if (b.type === 'text') {
        const i = texts.indexOf(b);
        const j = fromEnd ? refText.length - texts.length + i : i;
        const r = refText[Math.max(0, Math.min(refText.length - 1, j))];
        want = r?.style ? { ...r.style } : undefined;
      } else {
        const r = ref.find((x) => x.type === b.type);
        want = r?.style ? { ...r.style } : undefined;
      }
      if (!same(b.style, want)) {
        if (want) b.style = want;
        else delete b.style;
        changed++;
      }
      if (b.media && (b.media.crop || (b.media.zoom && b.media.zoom !== 1))) {
        delete b.media.crop;
        b.media.zoom = 1;
        changed++;
      }
    });

    const cards = blocks.filter((b) => b.type === 'card');
    if (cards.some((c) => c.showImage && c.media?.url)) {
      cards.forEach((c) => {
        if (!c.showImage) {
          c.showImage = true;
          changed++;
        }
      });
    }
  }
  return changed;
}
