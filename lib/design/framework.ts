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
  if (getTemplate(page.templateId).category === 'Products') return 'light';
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

/** The title size a layout designs for an area (or for the page), from its own sample. */
export function designedTitleRole(templateId: string, slotKey: string): TypeRole | undefined {
  const seed = getTemplate(templateId).seed();
  const inSlot = (seed[slotKey] || []).find((b) => b.type === 'text' && TITLE.includes(roleOf(b) as TypeRole));
  const anywhere = Object.values(seed).flat().find((b) => b.type === 'text' && TITLE.includes(roleOf(b) as TypeRole));
  return roleOf((inSlot || anywhere) as Block) as TypeRole | undefined;
}

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

  /* Upside-down titles: a sentence set as the title, with the real title in a
   * short line beside it. Swap them: the short line becomes the title, the long
   * one supporting copy. (Generated decks do this; so do some V1 pages.) */
  for (const slot of t.slots) {
    const texts = (page.slots[slot.key] || []).filter((b) => b.type === 'text');
    const title = texts.find((b) => TITLE.includes(roleOf(b) as TypeRole));
    if (!title) continue;
    const role = roleOf(title)!;
    const len = (title.text || '').trim().length;
    if (len <= budgetFor(page.templateId, role) * 1.5) continue;
    const short_ = texts.find((b) => b !== title && !TITLE.includes(roleOf(b) as TypeRole) && (b.text || '').trim().length >= 8 && (b.text || '').trim().length <= budgetFor(page.templateId, 'headline'));
    if (!short_) continue;
    short_.style = { ...(short_.style || {}), role } as Block['style'];
    title.style = { ...(title.style || {}), role: len > (BUDGET.subhead || 140) ? 'body' : 'subhead' } as Block['style'];
    fixes.push(`"${short(short_.text)}" is now the title, and the long line "${short(title.text)}" supporting copy`);
  }

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
        // UNIFORMITY: a title is the size its layout designs it to be, on every page that uses the
        // layout (every cover title the same display size). Long titles are flagged for shorter
        // words, never shrunk; only a paragraph standing in for a title (2.5x over) steps down.
        const designed = designedTitleRole(page.templateId, slot.key) || role;
        if (len > budgetFor(page.templateId, designed) * 2.5) {
          if (role !== 'subhead') set('subhead', `"${short(b.text)}" is a paragraph, not a title, and reads as supporting copy`);
        } else if (role !== designed) set(designed, `"${short(b.text)}" is back to the layout's title size`);
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
  rule: 'placeholder' | 'too-long' | 'card-title' | 'jammed-list' | 'repeated-label' | 'duplicate-page' | 'logo-as-photo' | 'mixed-pictures' | 'colour-rhythm' | 'empty-picture';
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
        if (b.type === 'card' && (b.text || '').length > 40)
          out.push({ pageId: p.id, rule: 'card-title', text: `Page ${n}: the card title "${short(b.text)}" is a sentence. Card titles are 2 to 5 words; put the sentence in the card text.` });
        if ((b.type === 'checklist' || b.type === 'bullets') && (b.items || []).some((s) => /\n/.test(s)))
          out.push({ pageId: p.id, rule: 'jammed-list', text: `Page ${n}: several points are written as one list item. Make each point its own item.` });
        if (b.type === 'text' && roleOf(b) === 'eyebrow') {
          const same = Object.values(p.slots).flat().some((x) => x !== b && x.type === 'text' && TITLE.includes(roleOf(x) as TypeRole) && (x.text || '').trim().toLowerCase() === (b.text || '').trim().toLowerCase());
          if (same) out.push({ pageId: p.id, rule: 'repeated-label', text: `Page ${n}: the small label repeats the title. Remove it or make it say something else.` });
        }
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
- Every role has a length it can carry: display about ${BUDGET.display} characters, headline about ${BUDGET.headline}, subhead about ${BUDGET.subhead}, body about ${BUDGET.body}, eyebrow about ${BUDGET.eyebrow}. Over that, shorten the words. Titles are never made smaller to fit: every page using a layout has the same title size, and every cover title is the same display size, so a long title must be rewritten shorter.
- Covers: the title is the product or the story in a few words. Sizes, pack counts and SKU detail are not titles; they go in a supporting line or on a product page.
Layout
- The layout decides positions, sizes and spacing. Pick the layout whose composition fits the content: cards for 3 parallel ideas, metrics for figures, split image/text for one idea with one picture, quote for one voice.
- Grids are compositions: fill a 3-card layout with 3, not 2.
Colour
- Product pages are white: any page showing product shots (packshots on white) is drawn on white, so the shots sit cleanly. Never colour a product page; put colour on story, data and section pages instead.
- Light pages are the default. Dark and photo pages give weight to openings, section breaks and closings. A coloured page (set_surface, approved colours only) is an accent: never two in a row, and about one page in four, or one in three when someone asks for more colour.
Pictures
- Every item in a row has the same kind of picture: all dishes, all products, or none.
- Logos are never pictures. They belong on covers (the brand mark) and logo pages.
- A full-bleed photo carries type only with an overlay; the layout provides it.
Copy
- No sample words left from the layout, no duplicate pages, no "First point".
- Specific beats clever, one idea per block, plain words.`;

/* ------------------------------------------------------------- polish */

/**
 * Presentation-quality fixes applied to what is DRAWN (Stage), for content that
 * arrives in the wrong shape — from generation, imports or quick edits. Nothing
 * here invents words; it hides leftovers, splits what was jammed together, and
 * steps type down to the size the words actually need.
 *
 *  - a small label that repeats the title is not drawn;
 *  - sample text left from a layout is not drawn once the block has real copy;
 *  - list items written as several lines become separate points;
 *  - long list items and long card titles read as body copy, not display caps;
 *  - a card whose "title" is really a paragraph shows it as the card's text;
 *  - a logo used as a picture inside a page is not drawn (the page mark carries
 *    the brand), except on the cover.
 */
export function polishPage(page: Page, isLogoPicture?: (m: MediaRef) => boolean): void {
  const t = getTemplate(page.templateId);
  const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const titles = Object.values(page.slots)
    .flat()
    .filter((b) => b.type === 'text' && TITLE.includes(roleOf(b) as TypeRole))
    .map((b) => norm(b.text));

  for (const slot of t.slots) {
    let list = page.slots[slot.key] || [];
    list = list.filter((b) => {
      if (b.type === 'text' && roleOf(b) === 'eyebrow' && titles.includes(norm(b.text))) return false;
      if (t.id !== 'cover' && (b.type === 'image' || b.type === 'card') && b.media?.url && isLogoPicture?.(b.media)) {
        if (b.type === 'card') {
          b.showImage = false;
          return true;
        }
        return false;
      }
      return true;
    });
    list.forEach((b) => {
      const real = (s?: string) => !!s && !isPlaceholder(s);
      if (isPlaceholder(b.support) && (real(b.text) || real(b.label) || real(b.value))) b.support = '';
      if (b.type === 'checklist' || b.type === 'bullets') {
        const items = (b.items || []).flatMap((it) => String(it).split(/\n+/)).map((s) => s.trim()).filter(Boolean);
        b.items = items;
        if (items.some((s) => s.length > 44)) b.style = { ...(b.style || {}), role: 'body' } as Block['style'];
      }
      if (b.type === 'card') {
        const len = (b.text || '').trim().length;
        if (len > 64 && !(b.support || '').trim()) {
          b.support = b.text;
          b.text = '';
        } else if (len > 40) b.style = { ...(b.style || {}), role: 'body' } as Block['style'];
      }
    });
    page.slots[slot.key] = list;
  }
}

/** The size every element is written to, for whoever writes the copy. */
export const COPY_BUDGET_TEXT = `COPY BUDGETS (write to these; longer copy is shrunk or hidden, never shown at full size)
- Page title (headline/display): 3 to 8 words, under 50 characters. Never a full sentence of explanation.
- Small label above a title (eyebrow): 1 to 4 words, under 30 characters, and never the same words as the title.
- Card title: 2 to 5 words, under 32 characters. Card text: one sentence, under 110 characters. Fill both; never leave a layout's sample text.
- Bullet or checklist point: one point per item, under 60 characters. Four points are four items, never one item with line breaks.
- Metric: the figure alone ("+38%", "$24.8M"); label 1 to 4 words.
- Body copy on a page: two sentences at most.`;
