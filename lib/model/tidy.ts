import type { Block, Page } from '@/lib/model/types';
import { getTemplate } from '@/lib/templates/registry';
import { enforcePage } from '@/lib/design/framework';

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
 *  - if any card in an area shows a picture, all of them do;
 *  - a page coloured by hand goes back to the layout's own surface (photo and
 *    film backgrounds stay, minus one-off crops and zooms).
 *
 * Words, figures and pictures are untouched. Returns how many things changed.
 */
export function tidyPage(page: Page): number {
  const t = getTemplate(page.templateId);
  const seed = t.seed();
  let changed = 0;
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  // two stylings that draw the same are the same: absent colour is 'auto', absent alignment is 'left'
  const norm = (st?: Block['style']) => (st ? { role: st.role ?? null, color: st.color ?? 'auto', align: st.align ?? 'left' } : null);
  const sameStyle = (a?: Block['style'], b?: Block['style']) => {
    if (!a && !b) return true;
    if (!a || !b) return !(a?.role || b?.role) && same(norm(a)?.color, norm(b)?.color) && same(norm(a)?.align, norm(b)?.align);
    return same(norm(a), norm(b));
  };

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
        // beyond what the layout was designed to hold, extra lines are supporting copy, never another title
        const r = j >= 0 && j < refText.length ? refText[j] : undefined;
        want = r?.style ? { ...r.style } : { role: j < 0 && i === 0 ? 'eyebrow' : 'body', color: 'auto', align: refText[0]?.style?.align || 'left' } as Block['style'];
      } else {
        const r = ref.find((x) => x.type === b.type);
        want = r?.style ? { ...r.style } : undefined;
      }
      if (!sameStyle(b.style, want)) {
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
  // the page surface: the layout's own, unless the page is a photograph or film
  const bg = page.background;
  if (!bg || ((bg.kind === 'color' || bg.kind === 'theme') && !bg.chosen)) {
    const want = t.background ? JSON.parse(JSON.stringify(t.background)) : { kind: 'theme', overlay: 'none' };
    const plain = (x: any) => (x ? { kind: x.kind, color: x.kind === 'color' ? x.color ?? null : null } : null);
    if (!same(plain(bg), plain(want))) {
      page.background = want;
      changed++;
    }
  } else if (bg.media && (bg.media.crop || (bg.media.zoom && bg.media.zoom !== 1))) {
    delete bg.media.crop;
    bg.media.zoom = 1;
    changed++;
  }
  // and the framework's mechanical rules on top: one title, type that fits
  changed += enforcePage(page).length;
  return changed;
}
