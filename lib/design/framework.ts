import type { Block, MediaRef, Page, Presentation } from '@/lib/model/types';
import type { TypeRole } from '@/lib/brand/themes';
import { getTemplate, TEMPLATES } from '@/lib/templates/registry';

/**
 * THE VIGO PRESENTS DESIGN FRAMEWORK
 * ---------------------------------------------------------------------------
 * One set of rules every page answers to, whoever made it — a person, the
 * assistant, or an import from V1. The layouts and brand themes define what a
 * page CAN look like; this defines what a good page IS. It works in two ways:
 *
 *   enforcePage()  fixes what is mechanical, silently and the same way every
 *                  time (one title per page, type that steps down when long);
 *   reviewDeck()   reports what needs judgement (placeholder copy, a logo
 *                  standing in for a photograph, two coloured pages in a row),
 *                  and the assistant acts on it.
 *
 * The same rules are written out in plain words (RULES_TEXT) for the
 * assistant's instructions, so what it is told and what is enforced can
 * never drift apart.
 */

/* ------------------------------------------------------------- type */

/** Highest to lowest. A page reads from the top of this ladder down. */
const LADDER: TypeRole[] = ['display', 'headline', 'subhead', 'body'];
const TITLE: TypeRole[] = ['display', 'headline'];

/** Most characters a role can carry before it stops reading as that role. */
export const BUDGET: Partial<Record<TypeRole, number>> = {
  display: 38,
  headline: 80,
  subhead: 140,
  body: 340,
  eyebrow: 42,
  caption: 80,
  quote: 200,
};

/* ------------------------------------------------------------ colour */

export type Surface = 'light' | 'dark' | 'colour' | 'photo';

/** What a page's surface reads as, for the deck's rhythm. */
export function surfaceOf(page: Page): Surface {
  const bg = page.background || getTemplate(page.templateId).background;
  if (bg?.kind === 'image' || bg?.kind === 'video') return 'photo';
  if (bg?.kind === 'color') {
    const c = bg.color || '';
    if (c === 'white' || c === 'cream' || c === 'paleCream') return 'light';
    if (c === 'black' || c === 'brandPrimary') return 'dark';
    return 'colour';
  }
  return 'light';
}

/* ----------------------------------------------------------- copy */

/** Every sample string the layouts ship with: if a page still says it, nobody wrote it. */
let SEED_TEXT: Set<string> | null = null;
function seedText(): Set<string> {
  if (SEED_TEXT) return SEED_TEXT;
  const s = new Set<string>();
  const add = (v?: string) => v && v.trim().length > 3 && s.add(v.trim().toLowerCase());
  TEMPLATES.forEach((t) =>
    Object.values(t.seed()).forEach((list) =>
      list.forEach((b) => {
        add(b.text);
        add(b.support);
        add(b.label);
        (b.items || []).forEach(add);
      })
    )
  );
  ['first point', 'second point', 'third point', 'fourth point', 'lorem ipsum', 'add a headline', 'your title here', 'subtitle'].forEach(add);
  SEED_TEXT = s;
  return s;
}
export function isPlaceholder(text?: string): boolean {
  const t = (text || '').trim().toLowerCase();
  return !!t && (seedText().has(t) || /^lorem ipsum/.test(t));
}

/* ---------------------------------------------------- enforcement */

/** A layout designed around a longer line (an approved statement in display type) earns that much room. */
const budgetCache = new Map<string, number>();
export function budgetFor(templateId: string, role: TypeRole): number {
  const key = templateId + ':' + role;
  if (budgetCache.has(key)) return budgetCache.get(key)!;
  const base = BUDGET[role] || 0;
  const longest = Object.values(getTemplate(templateId).seed())
    .flat()
    .filter((b) => b.type === 'text' && roleOf(b) === role)
    .reduce((m, b) => Math.max(m, (b.text || '').length), 0);
  const v = Math.max(base, Math.ceil(longest * 1.1));
  budgetCache.set(key, v);
  return v;
}

const roleOf = (b: Block): TypeRole | undefined => b.style?.role as TypeRole | undefined;

/** How many title-level lines a layout is designed to carry (most carry one). */
function titlesAllowed(templateId: string): number {
  const seed = getTemplate(templateId).seed();
  const n = Object.values(seed)
    .flat()
    .filter((b) => b.type === 'text' && TITLE.includes(roleOf(b) as TypeRole)).length;
  return Math.max(1, n);
}

/**
 * The mechanical rules, applied in place. Returns a line per fix.
 *  1. One title per page (or as many as the layout is designed for): later
 *     title-sized lines step down to subhead, or body if they are long.
 *  2. Type steps down when it is too long for its size: a display line over
 *     its budget becomes a headline; a headline far over becomes a subhead.
 *  3. One eyebrow per text area; further ones read as body.
 */
export function enforcePage(page: Page): string[] {
  const t = getTemplate(page.templateId);
  const fixes: string[] = [];
  const allowed = titlesAllowed(page.templateId);
  let titles = 0;

  for (const slot of t.slots) {
    let eyebrows = 0;
    for (const b of page.slots[slot.key] || []) {
      if (b.type !== 'text') continue;
      const role = roleOf(b);
      const len = (b.text || '').trim().length;
      const set = (r: TypeRole, why: string) => {
        b.style = { ...(b.style || {}), role: r } as Block['style'];
        fixes.push(why);
      };

      if (role && TITLE.includes(role)) {
        titles++;
        if (titles > allowed) {
          set(len > (BUDGET.subhead || 140) ? 'body' : 'subhead', `a second title, "${short(b.text)}", now reads as supporting copy`);
          continue;
        }
        if (role === 'display' && len > budgetFor(page.templateId, 'display')) set('headline', `"${short(b.text)}" was too long for display type and steps down to a headline`);
        else if (role === 'headline' && len > budgetFor(page.templateId, 'headline') * 1.5) set('subhead', `"${short(b.text)}" was too long for a headline and steps down`);
      } else if (role === 'eyebrow') {
        eyebrows++;
        if (eyebrows > 1 || len > (BUDGET.eyebrow || 42)) set('body', `"${short(b.text)}" reads as body copy rather than a small label`);
      }
    }
  }
  return fixes;
}

/* --------------------------------------------------------- review */

export interface Issue {
  pageId: string;
  rule: 'placeholder' | 'too-long' | 'duplicate-page' | 'logo-as-photo' | 'mixed-pictures' | 'colour-rhythm' | 'empty-picture';
  text: string;
}

/** What a picture is, if the caller knows (from the library). */
export type PictureKind = (m: MediaRef) => 'logo' | 'product' | 'lifestyle' | 'video' | 'other' | undefined;

function signature(p: Page): string {
  return JSON.stringify(
    Object.values(p.slots)
      .flat()
      .map((b) => [b.type, b.text, b.value, b.label, b.support, b.media?.url])
  );
}

/** The judgement calls, deck-wide. Each issue names the page and says what is wrong in plain words. */
export function reviewDeck(deck: Presentation, kind?: PictureKind): Issue[] {
  const out: Issue[] = [];
  const seen = new Map<string, number>();

  deck.pages.forEach((p, i) => {
    const n = i + 1;
    const t = getTemplate(p.templateId);
    const sig = signature(p);
    if (seen.has(sig)) out.push({ pageId: p.id, rule: 'duplicate-page', text: `Page ${n} repeats page ${seen.get(sig)}.` });
    else seen.set(sig, n);

    for (const slot of t.slots) {
      const blocks = p.slots[slot.key] || [];
      blocks.forEach((b) => {
        [b.text, b.support, b.label, ...(b.items || [])].forEach((s) => {
          if (isPlaceholder(s)) out.push({ pageId: p.id, rule: 'placeholder', text: `Page ${n} still has the layout's sample words "${short(s)}".` });
        });
        const role = roleOf(b);
        const budget = role && budgetFor(p.templateId, role);
        if (b.type === 'text' && budget && (b.text || '').length > budget * 1.15)
          out.push({ pageId: p.id, rule: 'too-long', text: `Page ${n}: "${short(b.text)}" is too long for ${role} type (about ${budget} characters fit).` });
      });

      // pictures in a row of repeated items
      const repeated = blocks.filter((b) => b.type === 'card' || b.type === 'image');
      if (repeated.length >= 2) {
        const kinds = repeated.map((b) => (b.type === 'card' && b.showImage === false ? 'none' : b.media?.url ? (kind?.(b.media) || 'other') : 'empty'));
        if (kinds.includes('logo'))
          out.push({ pageId: p.id, rule: 'logo-as-photo', text: `Page ${n}: a logo is standing in as a picture in ${slot.label}. Use a photograph.` });
        if (kinds.includes('empty') && kinds.some((k) => k !== 'empty' && k !== 'none'))
          out.push({ pageId: p.id, rule: 'empty-picture', text: `Page ${n}: some items in ${slot.label} have a picture and some are empty.` });
        const real = [...new Set(kinds.filter((k) => k === 'product' || k === 'lifestyle'))];
        if (real.length > 1)
          out.push({ pageId: p.id, rule: 'mixed-pictures', text: `Page ${n}: ${slot.label} mixes product shots and lifestyle photos. Use one kind across the row.` });
      }
    }
  });

  // colour rhythm: a coloured page is an accent; two in a row, or too many, and it stops being one
  const surf = deck.pages.map(surfaceOf);
  surf.forEach((s, i) => {
    if (s === 'colour' && surf[i - 1] === 'colour')
      out.push({ pageId: deck.pages[i].id, rule: 'colour-rhythm', text: `Pages ${i} and ${i + 1} are both coloured; one accent page at a time.` });
  });
  const coloured = surf.filter((s) => s === 'colour').length;
  if (deck.pages.length >= 4 && coloured > Math.ceil(deck.pages.length / 4))
    out.push({ pageId: deck.pages[0].id, rule: 'colour-rhythm', text: `${coloured} of ${deck.pages.length} pages are coloured; about one in four keeps colour meaningful.` });

  return out;
}

function short(s?: string, n = 40) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

/* ----------------------------------------------------------- words */

/** The framework in plain words, for the assistant's instructions. Kept beside the code it describes. */
export const RULES_TEXT = `THE DESIGN FRAMEWORK (the app enforces the mechanical parts; you handle the judgement)
Type
- One title per page. Below it: at most one small eyebrow label above, then supporting copy. Never two titles.
- Every role has a length it can carry: display about ${BUDGET.display} characters, headline about ${BUDGET.headline}, subhead about ${BUDGET.subhead}, body about ${BUDGET.body}, eyebrow about ${BUDGET.eyebrow}. Over that, shorten the words; the app steps type down when it must, but short words in big type is the goal.
- Covers: the title is the product or the story in a few words. Sizes, pack counts and SKU detail are not titles; they go in a supporting line or on a product page.
Layout
- The layout decides positions, sizes and spacing. Pick the layout whose composition fits the content: cards for 3 parallel ideas, metrics for figures, split image/text for one idea with one picture, quote for one voice.
- Grids are compositions: fill a 3-card layout with 3, not 2.
Colour
- Light pages are the default. Dark and photo pages give weight to openings, section breaks and closings. A coloured page (set_surface, approved colours only) is an accent: never two in a row, and about one page in four, or one in three when someone asks for more colour.
Pictures
- Every item in a row has the same kind of picture: all dishes, all products, or none.
- Logos are never pictures. They belong on covers (the brand mark) and logo pages.
- A full-bleed photo carries type only with an overlay; the layout provides it.
Copy
- No sample words left from the layout, no duplicate pages, no "First point".
- Specific beats clever, one idea per block, plain words.`;
