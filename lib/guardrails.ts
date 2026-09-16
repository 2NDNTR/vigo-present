import type { Page } from '@/lib/model/types';
import type { PageTemplate } from '@/lib/templates/registry';
import type { BrandTheme } from '@/lib/brand/themes';
import { colorLabel, contrastRatio } from '@/lib/brand/themes';

export interface Guardrail {
  id: string;
  text: string;
  tone: 'warn' | 'info';
}

/**
 * The silent internal creative director.
 * These never block the user — they nudge, in plain language.
 */
/**
 * Overflow measured on the canvas, turned into the same kind of notice as the
 * rest. It is passed in rather than computed here because it cannot be known
 * from the data: whether a paragraph fits depends on the font that loaded and
 * the width it rendered at, which only the browser knows.
 */
export function fitGuardrails(overflowing: { label: string; by: number }[]): Guardrail[] {
  return overflowing.map((o) => ({
    id: 'fit-' + o.label,
    tone: 'warn' as const,
    /* Named in the language of the fix. "Overflows by 84px" is a developer's
     * sentence; the person reading this needs to know that a projector will
     * cut it off and that the cure is fewer words. */
    text: `${o.label} runs past the bottom of the slide — about ${Math.round(o.by)} points of it will be cut off when this is presented. Shorten the copy, or move some of it to a second page.`,
  }));
}

export function pageGuardrails(page: Page, template: PageTemplate, theme?: BrandTheme): Guardrail[] {
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
    /*
     * UNDER-FILLING IS THE MORE COMMON FAILURE, AND NOTHING USED TO SAY SO.
     * A six-card grid holding three cards does not look like an error; it
     * looks like a page with a lot of air, and it ships. Then somebody opens
     * it beside the approved deck and finds it bare. A grid layout is a
     * COMPOSITION — the count is part of the design, not a maximum the user
     * is free to ignore — so falling short earns the same nudge as spilling
     * over. Only for grids of three or more: a two-item slot that holds one
     * is usually deliberate.
     */
    /*
     * Only for slots that are GRIDS — cards, pictures, figures — where the
     * count is part of the composition. A flexible copy slot has a max that
     * is a capacity, not a design: the approved company statement holds three
     * blocks in a slot that accepts five, and scolding it for that is the
     * guardrail being wrong in front of someone who is right.
     */
    const isGrid = !slot.accepts.some((a) => a === 'text' || a === 'quote' || a === 'bullets' || a === 'checklist' || a === 'cta');
    if (isGrid && slot.max >= 3 && blocks.length > 0 && blocks.length < slot.max) {
      out.push({
        id: 'under-' + slot.key,
        tone: 'info',
        text: `${slot.label} is composed for ${slot.max}. You have ${blocks.length} — the page will read thin next to the rest of the deck.`,
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

  // Readability: a chosen colour has to survive the surface it sits on.
  if (theme) {
    const media = page.background?.kind === 'image' || page.background?.kind === 'video';
    const surface = media
      ? page.background?.overlay === 'light'
        ? theme.colors.white
        : theme.colors.black
      : page.background?.kind === 'color' && page.background.color
      ? theme.colors[page.background.color]
      : theme.colors[theme.surface.bg];

    const seen = new Set<string>();
    allBlocks.forEach((b) => {
      const role = b.style?.color;
      if (!role || role === 'auto' || seen.has(role)) return;
      const ratio = contrastRatio(theme.colors[role], surface);
      if (ratio < 2.6) {
        seen.add(role);
        out.push({
          id: 'contrast-' + role,
          tone: 'warn',
          text: `${colorLabel(theme, role)} is hard to read on this page. Try a darker colour, or set a dark background or overlay behind it.`,
        });
      }
    });
  }

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
