import type { Block, Page } from '@/lib/model/types';
import type { PageTemplate } from '@/lib/templates/registry';

/**
 * THE WIZARD
 * ---------------------------------------------------------------------------
 * Help with the page in front of you: shorten a headline, write the copy, make
 * six cards sound like one voice. The same rule as everywhere else in this
 * product applies, and it is the reason this is a narrow endpoint rather than
 * a chat window with a paintbrush:
 *
 *   The wizard may change WORDS. It may suggest a different approved LAYOUT.
 *   It may not touch a style, a colour, a size, a position or a background.
 *
 * So what it returns is a list of block ids and strings. There is no field in
 * the reply for a hex code, and the applier ignores anything that is not text
 * for a block that already exists. A wizard that could restyle the page would
 * be the fastest way yet to end up with a deck nobody approved.
 *
 * It is also told, hard, not to invent facts. A salesperson asking it to
 * "write the copy" is asking for structure and tone, not for numbers — and a
 * number it made up would read exactly like one it was given.
 */

export interface AssistChange {
  blockId: string;
  text?: string;
  support?: string;
  label?: string;
  value?: string;
}

export interface AssistReply {
  changes?: AssistChange[];
  /** what it did, in one line, for the person who asked */
  note?: string;
  /** an approved layout it thinks fits better, by id */
  suggestLayout?: string;
  /** why, in one line — never applied automatically */
  layoutReason?: string;
}

export const ASSIST_SCHEMA = {
  type: 'object' as const,
  properties: {
    changes: {
      type: 'array',
      description: 'The blocks to rewrite. Leave out any block you are not changing.',
      items: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'id of an existing block on this page, exactly as given' },
          text: { type: 'string', description: 'new main text — a heading, a card title, a line of copy' },
          support: { type: 'string', description: 'new supporting line, for cards and metrics' },
          label: { type: 'string', description: 'new label, for metrics' },
          value: { type: 'string', description: 'new figure — only if the user supplied it in their request' },
        },
        required: ['blockId'],
      },
    },
    note: { type: 'string', description: 'One line saying what you changed and why.' },
    suggestLayout: { type: 'string', description: 'An approved layout id that would fit this content better. Optional.' },
    layoutReason: { type: 'string', description: 'One line on why that layout fits better.' },
  },
};

export const ASSIST_SYSTEM = `You help a salesperson with one page of a presentation. You rewrite words. You never design.

What you may do:
- Rewrite any text on the page: headings, card titles, supporting lines, metric labels.
- Suggest a different approved layout by id, with one line of reasoning. It is a suggestion; the person decides.

What you must never do:
- Invent a number, a date, a customer name, a claim or a statistic. If a figure belongs somewhere and the user has not given it to you, write the label and leave the value alone. A number you invented reads exactly like a number you were given, which is how a made-up figure reaches a buyer.
- Choose fonts, colours, sizes, positions or backgrounds. You have no way to express them and no business doing so.
- Fill every block for the sake of filling it. Leaving a card alone is a valid answer.

How to write, because this is a food manufacturer talking to retail buyers:
- Specific beats clever. "Seven of our ten top sellers are made on our own lines" beats "Excellence in manufacturing".
- One idea per block. If a card needs a semicolon it needs to be two cards or a shorter thought.
- Headlines under about eighty characters, supporting copy under about three hundred. Long copy does not shrink to fit; it runs off the slide.
- Plain words. No "leverage", no "solutions", no "best-in-class".`;

/** What the model is allowed to see: ids, types and words. No styling at all. */
export function pageForModel(page: Page, template: PageTemplate): string {
  const lines: string[] = [`Layout: ${template.id} — ${template.name}. ${template.hint}`];
  template.slots.forEach((slot) => {
    const blocks = page.slots[slot.key] || [];
    lines.push(`\nSlot "${slot.key}" (${slot.label}, holds up to ${slot.max}):`);
    blocks.forEach((b) => {
      const bits = [
        b.text ? `text: ${b.text}` : '',
        b.support ? `support: ${b.support}` : '',
        b.label ? `label: ${b.label}` : '',
        b.value ? `value: ${b.value}` : '',
        b.items?.length ? `items: ${b.items.join(' | ')}` : '',
      ].filter(Boolean);
      lines.push(`  - id ${b.id} (${b.type})${bits.length ? ': ' + bits.join('; ') : ' — empty'}`);
    });
    if (!blocks.length) lines.push('  (empty)');
  });
  return lines.join('\n');
}

/** Everything is a proposal until it survives this. */
export function applyChanges(page: Page, changes: AssistChange[]): number {
  const byId = new Map<string, Block>();
  Object.values(page.slots).forEach((blocks) => blocks.forEach((b) => byId.set(b.id, b)));

  let applied = 0;
  (changes || []).forEach((c) => {
    const b = byId.get(String(c.blockId));
    if (!b) return; // a block it invented, or one deleted while it was thinking
    const set = (k: 'text' | 'support' | 'label' | 'value', v: unknown) => {
      if (typeof v !== 'string') return;
      const s = v.trim().slice(0, 600);
      if (!s) return;
      b[k] = s;
      applied++;
    };
    set('text', c.text);
    set('support', c.support);
    set('label', c.label);
    /* A value is only accepted when the block already had one — otherwise the
     * wizard is filling in a figure nobody gave it, which is the one thing it
     * is most firmly told not to do. */
    if (b.value) set('value', c.value);
  });
  return applied;
}
