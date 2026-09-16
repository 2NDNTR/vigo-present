import type { Block, Page, Presentation } from '@/lib/model/types';
import { uid, slugify } from '@/lib/model/types';
import { TEMPLATES, getTemplate, createPage } from '@/lib/templates/registry';
import type { BrandId } from '@/lib/brand/themes';

/**
 * THE DECK ARCHITECT
 * ---------------------------------------------------------------------------
 * "Make me a deck" in every other tool means a model inventing slides: it
 * picks fonts, sizes, colours and positions, and the result looks like AI.
 * Here the model is given a catalogue of forty-five approved layouts and asked
 * to do the two things it is genuinely good at — choosing a SEQUENCE and
 * writing WORDS — and is structurally prevented from doing anything else.
 *
 * It never sees a colour, a typeface, a size or a coordinate, and it cannot
 * emit one: what comes back is a list of template ids and strings, and the
 * strings are poured into blocks the TEMPLATE seeded. Every style on every
 * page is the one the designer wrote. So the worst possible output is a deck
 * with the wrong words in the right design — which a salesperson fixes in ten
 * minutes — rather than the right words in a design nobody approved.
 *
 * That is the whole product in one endpoint: the machine does structure and
 * first-draft copy, the brand does everything else.
 */

export interface PlannedPage {
  templateId: string;
  /** starts a new section in the navigator */
  section?: string;
  /** slot key -> the lines that go in it, in order */
  content?: Record<string, string[]>;
}

export interface DeckPlan {
  title: string;
  pages: PlannedPage[];
  /** one line on the argument the deck makes, shown back to the person */
  approach?: string;
}

/** The catalogue the model is allowed to build from — and nothing else. */
export function catalogue(): string {
  return TEMPLATES.map((t) => {
    const slots = t.slots
      .map((s) => `${s.key} (${s.label}, up to ${s.max})`)
      .join('; ');
    return `- ${t.id} — ${t.name}. ${t.hint} Slots: ${slots}`;
  }).join('\n');
}

export const DECK_SYSTEM = `You plan presentations for a food manufacturer's sales team by choosing from a fixed library of approved layouts. You do not design anything.

What you return: a title, and an ordered list of pages. Each page names a layout id from the catalogue and supplies the words for its slots.

Rules:
1. ONLY layout ids from the catalogue. Inventing one produces a broken deck.
2. Respect each slot's item limit exactly. A layout is a composition: a six-card grid wants six cards, not four. If you cannot think of six, choose a layout that wants fewer.
3. Write real sentences about the subject, never "Lorem ipsum", never "[Insert X here]" and never a placeholder label like "Title here". A salesperson should be able to present the draft and only correct the facts.
4. Never invent a specific number, date, customer name or claim. Where a figure belongs, write the shape of it in words the user will replace — "Cases shipped last year" as a label with an empty value is right; "2.4M cases" is a lie with a decimal point.
5. Open with a cover, close with a contact or takeaways page, and start a new section wherever the argument turns.
6. Between twelve and twenty pages unless the brief says otherwise. A deck nobody finishes reading was not worth planning.
7. Keep headlines under about eighty characters and body copy under about three hundred. Long copy does not shrink to fit here; it runs off the slide.

You never choose fonts, colours, sizes or positions — those belong to the brand and are applied for you.`;

export const DECK_SCHEMA = {
  type: 'object' as const,
  properties: {
    title: { type: 'string', description: 'The deck title, as it would appear in a list of decks.' },
    approach: { type: 'string', description: 'One sentence on the argument this deck makes, for the person who asked.' },
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          templateId: { type: 'string', description: 'An id from the catalogue, exactly as written.' },
          section: { type: 'string', description: 'Set only on a page that begins a new section.' },
          content: {
            type: 'object',
            description: 'Slot key to an ordered list of lines for that slot. One string per block.',
            additionalProperties: { type: 'array', items: { type: 'string' } },
          },
        },
        required: ['templateId'],
      },
    },
  },
  required: ['title', 'pages'],
};

/**
 * Build the real presentation. The plan supplies words; the TEMPLATE supplies
 * every block, every style and every role — so an unknown layout, a slot that
 * does not exist, or eleven lines in a slot that holds six cannot produce
 * anything but a correct page.
 */
export function toPresentation(plan: DeckPlan, brand: BrandId, orgId: string, userId: string): Presentation {
  const pages: Page[] = [];

  (plan.pages || []).forEach((planned) => {
    if (!TEMPLATES.some((t) => t.id === planned.templateId)) return;
    const page = createPage(planned.templateId, undefined, brand);
    const template = getTemplate(planned.templateId);

    if (planned.section) page.sectionStart = String(planned.section).slice(0, 60);

    Object.entries(planned.content || {}).forEach(([slotKey, lines]) => {
      const slot = template.slots.find((s) => s.key === slotKey);
      if (!slot || !Array.isArray(lines)) return;
      const blocks = page.slots[slotKey] || [];

      lines.slice(0, slot.max).forEach((line, i) => {
        const text = String(line || '').trim().slice(0, 600);
        if (!text) return;
        const target: Block | undefined = blocks[i];
        if (!target) return;
        /* Poured into the seeded block, never replacing it: the block keeps
         * its type, its role and its colour, which is where the design is. */
        if (target.type === 'text' || target.type === 'quote') target.text = text;
        else if (target.type === 'card') {
          const [head, ...rest] = text.split(' — ');
          target.text = head.trim();
          if (rest.length) target.support = rest.join(' — ').trim();
        } else if (target.type === 'metric') {
          /* The model was told not to invent figures, so the line is the
           * label and the value is left empty for someone with the real
           * number in front of them. */
          target.label = text;
          target.value = '';
        } else if (target.type === 'checklist' || target.type === 'bullets') {
          target.items = text.split(/\s*\|\s*/).filter(Boolean).slice(0, 8);
        }
      });

      /* A slot given fewer lines than it holds keeps the seeded blocks for the
       * rest — an empty card in the right place is a prompt to fill it, and it
       * keeps the composition intact. */
    });

    pages.push(page);
  });

  const title = String(plan.title || 'Untitled presentation').slice(0, 120);
  const now = Date.now();

  return {
    id: uid('pres'),
    orgId,
    title,
    brand,
    status: 'draft',
    share: { slug: slugify(title) + '-' + Math.random().toString(36).slice(2, 6), access: 'internal', mode: 'scroll' },
    pages: pages.length ? pages : [createPage('cover', undefined, brand)],
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
}
