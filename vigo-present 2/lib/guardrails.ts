import type { Page } from '@/lib/model/types';
import type { PageTemplate } from '@/lib/templates/registry';

export interface Guardrail {
  id: string;
  text: string;
  tone: 'warn' | 'info';
}

/**
 * The silent internal creative director.
 * These never block the user — they nudge, in plain language.
 */
export function pageGuardrails(page: Page, template: PageTemplate): Guardrail[] {
  const out: Guardrail[] = [];
  const allBlocks = Object.values(page.slots || {}).flat();

  template.slots.forEach((slot) => {
    const blocks = page.slots[slot.key] || [];
    if (blocks.length > slot.max) {
      out.push({
        id: 'max-' + slot.key,
        tone: 'warn',
        text: `This layout works best with ${slot.max} ${slot.max === 1 ? 'item' : 'items'} in ${slot.label}. You have ${blocks.length}.`,
      });
    }
  });

  allBlocks.forEach((b) => {
    if (b.type === 'text') {
      const role = b.style?.role;
      const len = (b.text || '').length;
      if (role === 'display' && len > 60) {
        out.push({ id: 'long-' + b.id, tone: 'warn', text: 'That display line is long. Shortening it will read better than shrinking it.' });
      } else if (role === 'headline' && len > 110) {
        out.push({ id: 'long-' + b.id, tone: 'warn', text: 'This headline is running long — try cutting it to one clear idea.' });
      }
    }
    if ((b.type === 'image' || b.type === 'video') && b.media?.url && b.media.width && b.media.width < 900) {
      out.push({ id: 'res-' + b.id, tone: 'warn', text: 'This image may appear blurry in presentation mode. Try a larger file.' });
    }
  });

  const bg = page.background;
  if ((bg?.kind === 'image' || bg?.kind === 'video') && bg.media?.url) {
    const hasType = allBlocks.some((b) => ['text', 'metric', 'quote', 'checklist', 'bullets'].includes(b.type));
    if (hasType && (!bg.overlay || bg.overlay === 'none')) {
      out.push({
        id: 'overlay',
        tone: 'warn',
        text: 'Add an overlay so the typography stays readable over this image.',
      });
    }
    if (bg.media.width && bg.media.width < 1200) {
      out.push({ id: 'bgres', tone: 'warn', text: 'This background image is smaller than ideal for full-screen presentation.' });
    }
  }

  if (template.guidance && out.length === 0) {
    out.push({ id: 'guide', tone: 'info', text: template.guidance });
  }

  return out;
}
