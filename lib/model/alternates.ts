import type { Block, Page } from '@/lib/model/types';
import { TEMPLATES, getTemplate } from '@/lib/templates/registry';
import { remapSlots } from '@/lib/model/remap';
import { isPlaceholder } from '@/lib/design/framework';

/**
 * ALTERNATE LAYOUTS FOR ONE SLIDE
 * Every approved layout is tried with this slide's own content poured in, and
 * ranked by how well it holds it: everything kept beats anything dropped,
 * fewer sample lines showing beats more, and a slide with a picture stays on
 * layouts that show one. The best few are offered as one-click swaps.
 */
export interface Alternate {
  templateId: string;
  name: string;
  page: Page;
  kept: number;
  lost: number;
  score: number;
}

const real = (b: Block): boolean => {
  if (b.media?.url && !/^data:|placeholder|plate/i.test(b.media.url)) return true;
  const words = [b.text, b.value, b.label, b.support, ...(b.items || [])].filter(Boolean) as string[];
  return words.some((w) => w.trim() && !isPlaceholder(w));
};

export function alternatesFor(page: Page, limit = 8): Alternate[] {
  const from = getTemplate(page.templateId);
  const original = Object.values(page.slots || {}).flat();
  const content = original.filter(real);
  const ids = new Set(content.map((b) => b.id));
  const hasPicture =
    original.some((b) => (b.type === 'image' || b.type === 'video' || (b.type === 'card' && b.showImage !== false)) && real(b)) ||
    (page.background?.kind === 'image' || page.background?.kind === 'video');

  const out: Alternate[] = [];
  for (const t of TEMPLATES) {
    if (t.id === page.templateId) continue;
    const slots = remapSlots(page, t.id);
    let background =
      page.background?.kind === 'theme' && t.background ? JSON.parse(JSON.stringify(t.background)) : page.background;
    let placed = Object.values(slots).flat();
    /* A layout with no picture area shows its photo full-bleed behind the
     * words, so a photo that found no slot becomes the background. */
    const lostPhoto = content.find(
      (b) => (b.type === 'image' || b.type === 'video') && b.media?.url && !placed.some((x) => x.id === b.id)
    );
    let viaBackground = false;
    const photoLayout = t.background?.kind === 'image' || t.background?.kind === 'video';
    if (lostPhoto && photoLayout && !t.slots.some((sl) => sl.accepts.includes('image'))) {
      background = {
        ...(JSON.parse(JSON.stringify(t.background)) as any),
        kind: lostPhoto.type === 'video' ? 'video' : 'image',
        media: { ...lostPhoto.media! },
      } as Page['background'];
      viaBackground = true;
    }
    const kept = placed.filter((b) => ids.has(b.id)).length + (viaBackground ? 1 : 0);
    const lost = content.length - kept;
    const seeded = placed.filter((b) => !original.some((o) => o.id === b.id)).length;
    const showsPicture = t.slots.some((s) => s.accepts.includes('image')) || !!t.slots.find((s) => s.bleed) || viaBackground;
    let score = kept * 4 - lost * 9 - seeded * 3;
    // each item landing where the layout was designed for that kind of item
    for (const [key, list] of Object.entries(slots)) {
      const primary = t.slots.find((sl) => sl.key === key)?.accepts[0];
      list.forEach((b) => {
        if (ids.has(b.id) && primary === b.type) score += 1.5;
      });
    }
    if (viaBackground) score += 1;
    if (t.category === from.category) score += 2;
    if (hasPicture && !showsPicture) score -= 6;
    if (!hasPicture && showsPicture) score -= 1;
    if (content.length && kept === 0) continue;
    out.push({
      templateId: t.id,
      name: t.name,
      kept,
      lost,
      score,
      page: {
        ...page,
        templateId: t.id,
        slots: stripNudges(slots),
        background,
      },
    });
  }
  out.sort((a, b) => b.score - a.score);
  // whole-content swaps first; ones that drop something only when there are not enough
  const whole = out.filter((a) => a.lost === 0);
  return (whole.length >= limit ? whole : [...whole, ...out.filter((a) => a.lost > 0)]).slice(0, limit);
}

function stripNudges(slots: Record<string, Block[]>): Record<string, Block[]> {
  const o: Record<string, Block[]> = {};
  for (const [k, list] of Object.entries(slots)) o[k] = list.map((b) => (b.nudge ? { ...b, nudge: undefined } : b));
  return o;
}
