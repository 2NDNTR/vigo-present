import type { Block, Page } from '@/lib/model/types';
import { getTemplate } from '@/lib/templates/registry';

/** Swapping a layout carries the content across instead of throwing it away. */
export function remapSlots(page: Page, newTemplateId: string): Record<string, Block[]> {
  const from = getTemplate(page.templateId);
  const to = getTemplate(newTemplateId);
  const next: Record<string, Block[]> = {};
  to.slots.forEach((s) => (next[s.key] = []));

  const pool: Block[] = [];
  from.slots.forEach((s) => {
    const blocks = page.slots[s.key] || [];
    const target = to.slots.find((x) => x.key === s.key);
    if (target) {
      const ok = blocks.filter((b) => target.accepts.includes(b.type));
      next[target.key] = ok.slice(0, target.max);
      pool.push(...blocks.filter((b) => !ok.includes(b)));
    } else {
      pool.push(...blocks);
    }
  });

  pool.forEach((b) => {
    const target = to.slots.find((s) => s.accepts.includes(b.type) && next[s.key].length < s.max);
    if (target) next[target.key].push(b);
  });

  // fill anything still empty with the template's own seed content
  const seed = to.seed();
  to.slots.forEach((s) => {
    if (next[s.key].length === 0 && seed[s.key]) next[s.key] = seed[s.key];
  });
  return next;
}

