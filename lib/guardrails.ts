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

  /* ---------------------------------------------------------------------
   * Copy that breaks a layout silently.
   *
   * The three checks below cover the block types whose overflow is not
   * visible while typing but is obvious on the finished page. Each budget
   * is measured against the rendered stage, not guessed:
   *
   *   metric label   — labels sit on a shared baseline, so a label that
   *                    wraps to two lines lifts its number out of line with
   *                    the rest of the row. The narrower the column, the
   *                    tighter the budget.
   *   checklist item — a tall list runs under the headline above it and the
   *                    logo below it.
   *   table cell     — a long cell is clipped with an ellipsis, which loses
   *                    the reader the end of the sentence.
   * ------------------------------------------------------------------- */

  template.slots.forEach((slot) => {
    const blocks = page.slots[slot.key] || [];

    // ---- metric labels, budgeted by how many share the row
    //
    // Character count is a proxy for rendered width, so the budget is set to
    // stay quiet on labels known to fit rather than to catch every last one:
    // "Target blended AOV" and "Conversion up 223%" are both 18 characters and
    // only the second one wraps. A guardrail that fires on a page which looks
    // fine is worse than one that misses a borderline case, because the team
    // stops reading them.
    const metrics = blocks.filter((b) => b.type === 'metric');
    if (metrics.length > 1) {
      const budget = metrics.length >= 4 ? 19 : metrics.length === 3 ? 22 : 28;
      const tooLong = metrics.filter((b) => (b.label || '').length > budget);
      tooLong.forEach((b) => {
        out.push({
          id: 'mlabel-' + b.id,
          tone: 'warn',
          text: `“${b.label}” is long for ${metrics.length} statistics across. Around ${budget} characters keeps every number on the same line — the rest of the sentence belongs in the page headline.`,
        });
      });
    }

    // ---- checklists and bullet lists
    blocks.forEach((b) => {
      if (b.type !== 'checklist' && b.type !== 'bullets') return;
      const items = b.items || [];
      if (items.length > 6) {
        out.push({
          id: 'items-' + b.id,
          tone: 'warn',
          text: `${items.length} points is more than this page holds. Five or six land better — the rest is usually a second page.`,
        });
      }
      const wordy = items.filter((s) => (s || '').length > 60);
      if (wordy.length) {
        out.push({
          id: 'itemlen-' + b.id,
          tone: 'warn',
          text: `${wordy.length === 1 ? 'One point runs' : wordy.length + ' points run'} long enough to wrap onto a third line and collide with the heading. Aim for six to eight words each.`,
        });
      }
    });

    // ---- table cells
    blocks.forEach((b) => {
      if (b.type !== 'table' || !b.table) return;
      const cols = b.table.headers.length || 1;
      const budget = cols <= 4 ? 32 : cols <= 6 ? 26 : 22;
      let worst = '';
      b.table.rows.forEach((r) =>
        r.forEach((cell) => {
          if ((cell || '').length > budget && (cell || '').length > worst.length) worst = cell;
        })
      );
      if (worst) {
        out.push({
          id: 'cell-' + b.id,
          tone: 'warn',
          text: `Cells wider than about ${budget} characters get cut off at ${cols} columns — “${worst.slice(0, 34)}…” will not show in full. Shorten the wording, or move the explanation into the page headline.`,
        });
      }
    });
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
