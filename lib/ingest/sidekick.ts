import type { Block, MediaRef, Page, Presentation } from '@/lib/model/types';
import { uid } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';
import { createPage, getTemplate, TEMPLATES } from '@/lib/templates/registry';
import { remapSlots } from '@/lib/model/remap';
import { tidyPage } from '@/lib/model/tidy';
import { enforcePage } from '@/lib/design/framework';
import { pageGuardrails } from '@/lib/guardrails';
import { getTheme } from '@/lib/brand/themes';

/**
 * THE ASSISTANT — the deck is edited by asking.
 * ---------------------------------------------------------------------------
 * In V2 nobody styles a page. The person says what should be true ("Engagement
 * is at +55%", "add a page on the olive oil range after the hero", "build this
 * page from the screenshot I attached") and the assistant returns OPERATIONS
 * on the deck: change these words, add a page in this approved layout, move
 * that page, put this photo here.
 *
 * The contract is the safety, as it was for the page wizard. There is no field
 * for a colour, a font, a size or a position, so none can come back; layouts
 * are chosen from the approved library by id; photos come from the brand's
 * library or from what the person attached. Every figure must be traceable to
 * something the person gave — their words or their image.
 */

export type OpKind = 'set_text' | 'remove_block' | 'tidy_page' | 'add_page' | 'copy_page' | 'delete_page' | 'move_page' | 'change_layout' | 'set_image';

export interface Fill {
  slot: string;
  index?: number;
  text?: string;
  support?: string;
  label?: string;
  value?: string;
  items?: string[];
  image?: string;
}

export interface DeckOp {
  op: OpKind;
  pageId?: string;
  blockId?: string;
  text?: string;
  support?: string;
  label?: string;
  value?: string;
  items?: string[];
  layout?: string;
  afterPageId?: string;
  section?: string;
  fills?: Fill[];
  image?: string;
  /** copy_page: the team presentation the page comes from */
  fromPresentationId?: string;
  /** copy_page: the source page itself, filled in by the server, never by the model */
  pageData?: Page;
}

export interface DeckReply {
  reply?: string;
  ops?: DeckOp[];
}

const FILL = {
  type: 'object',
  properties: {
    slot: { type: 'string', description: 'slot key of the chosen layout' },
    index: { type: 'number', description: '0-based position inside the slot' },
    text: { type: 'string' },
    support: { type: 'string' },
    label: { type: 'string' },
    value: { type: 'string', description: 'a figure the person gave, in words or in an attached image' },
    items: { type: 'array', items: { type: 'string' } },
    image: { type: 'string', description: 'a library asset id or an attachment id (att1, att2…)' },
  },
  required: ['slot'],
};

export const DECK_SCHEMA = {
  type: 'object' as const,
  properties: {
    reply: {
      type: 'string',
      description: 'One or two plain sentences to the person: what you changed, or the one question you need answered.',
    },
    ops: {
      type: 'array',
      description: 'The edits, in order. Empty when you are asking a question.',
      items: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['set_text', 'remove_block', 'tidy_page', 'add_page', 'copy_page', 'delete_page', 'move_page', 'change_layout', 'set_image'] },
          fromPresentationId: { type: 'string', description: 'copy_page: id of the team presentation the page comes from; pageId is then the page in THAT presentation' },
          pageId: { type: 'string', description: 'id of an existing page, exactly as given; for tidy_page, "all" tidies every page' },
          blockId: { type: 'string', description: 'id of an existing block on that page, exactly as given' },
          text: { type: 'string' },
          support: { type: 'string' },
          label: { type: 'string' },
          value: { type: 'string', description: 'a figure the person gave, in words or in an attached image' },
          items: { type: 'array', items: { type: 'string' } },
          layout: { type: 'string', description: 'an approved layout id (add_page, change_layout)' },
          afterPageId: { type: 'string', description: 'add_page / move_page: the page it goes after; "start" for the front' },
          section: { type: 'string', description: 'add_page: a section name, only when it starts a new section' },
          fills: { type: 'array', items: FILL, description: 'add_page: the words and pictures for the new page, by slot' },
          image: { type: 'string', description: 'set_image: a library asset id or an attachment id' },
        },
        required: ['op'],
      },
    },
  },
  required: ['reply'],
};

export const DECK_SYSTEM = `You are the assistant inside Vigo Presents, where a food importer's sales team builds presentations for retail buyers. People do not design pages here. They tell you what should be true, and you edit the deck by returning operations.

Operations:
- set_text: change the words of one existing block (text, support, label, value, items). Use it for any wording or figure change, on any page.
- add_page: a new page in an approved layout, placed after afterPageId, with fills for its slots. Fill every slot that has something to say; leave the rest to the layout's defaults.
- delete_page, move_page: by page id.
- change_layout: move a page into another approved layout; its content is carried across.
- set_image: put a picture on a page — on an image block or a card (blockId), or on the page's first picture area when blockId is left out.

Reading a request:
- "Engagement is at +55%" means find the block whose label or text is about engagement and set its value. Search the whole deck; prefer the open page when two match.
- "this page" / "here" means the open page.
- When attachments are present, look at them. A screenshot of a slide or a chart is a reference: build or rebuild the page with the same structure and the same figures in an approved layout. A product or lifestyle photograph is material: place it where it belongs (image: "att1").
- If the request is ambiguous in a way that would change the wrong thing, ask one short question and return no ops.

Hard rules:
- Never invent a figure, date, customer, claim or statistic. A value must come from the person's words or from an attached image. If a figure is needed and you do not have it, write the label and leave the value out.
- You cannot choose fonts, colours, sizes, positions or backgrounds, and you must not try. Brand styling is automatic.
- Only use ids that appear in the deck, the layout list, the asset list or the attachments.
- Keep within each slot's capacity. Headlines under about 80 characters; supporting copy under about 300.

How to write: specific beats clever, one idea per block, plain words — no "leverage", "solutions" or "best-in-class". Write the reply to the person in the same plain voice, past tense for what you did ("Updated engagement to +55% on page 7.").`;

/* ------------------------------------------------------------ describe */

function blockLine(b: Block, pic: (m: MediaRef) => string): string {
  const bits = [
    b.text ? `text: ${b.text}` : '',
    b.label ? `label: ${b.label}` : '',
    b.value ? `value: ${b.value}` : '',
    b.support ? `support: ${b.support}` : '',
    b.items?.length ? `items: ${b.items.join(' | ')}` : '',
    b.media?.url && (b.type !== 'card' || b.showImage !== false) ? `picture: ${pic(b.media)}` : '',
  ].filter(Boolean);
  return `    - block ${b.id} (${b.type})${bits.length ? ': ' + bits.join('; ') : ' — empty'}`;
}

/** The deck as the model may see it: ids, layouts and words. No styling. */
/** How a picture is described to the model: its library name and folder when known. */
export type PictureNamer = (m: MediaRef) => string;
const defaultNamer: PictureNamer = (m) => m.alt || m.assetId || 'set';

export function deckForModel(p: Presentation, openPageId: string, pic: PictureNamer = defaultNamer): string {
  const out: string[] = [`Deck: "${p.title}" — brand ${p.brand}${p.retailer ? ', for ' + p.retailer : ''}. ${p.pages.length} pages.`];
  p.pages.forEach((pg, i) => {
    const t = getTemplate(pg.templateId);
    out.push(
      `\nPage ${i + 1} — id ${pg.id}${pg.id === openPageId ? ' (OPEN NOW)' : ''} — layout ${t.id}${pg.sectionStart ? ' — starts section "' + pg.sectionStart + '"' : ''}`
    );
    t.slots.forEach((s) => {
      const blocks = pg.slots[s.key] || [];
      out.push(`  slot ${s.key} (${s.label}, up to ${s.max}):`);
      blocks.forEach((b) => out.push(blockLine(b, pic)));
      if (!blocks.length) out.push('    (empty)');
    });
    const bg = pg.background;
    if (bg?.kind === 'image' || bg?.kind === 'video') out.push(`  background: ${bg.kind}${bg.media?.url ? ' ' + pic(bg.media) : ''}`);
    else if (bg?.kind === 'color') out.push(`  background: hand-picked colour ${bg.color || ''}`);
    // the layout's own warnings: too much text, too many items, poor contrast
    try {
      const warn = pageGuardrails(pg, t, getTheme(pg.brandOverride || p.brand));
      warn.forEach((w) => out.push(`  WARNING: ${w.text}`));
    } catch {
      /* warnings are advice, never a reason to fail */
    }
  });
  return out.join('\n');
}

/** The approved layouts, with their slots, so add_page fills land in real places. */
export function layoutsForModel(): string {
  return TEMPLATES.map(
    (t) =>
      `${t.id} — ${t.name}. ${t.hint} Slots: ${t.slots.map((s) => `${s.key} (${s.accepts.join('/')}, up to ${s.max})`).join(', ')}`
  ).join('\n');
}

/* --------------------------------------------------------------- apply */

export interface Material {
  /** attachment or library asset id → the picture to use */
  media: (id: string) => MediaRef | undefined;
  /** everything the person typed in this conversation, for the figure check */
  said: string;
  /** material the assistant read (this deck, team decks): a figure from here must match exactly */
  seen?: string;
  /** a picture was attached: figures may come from it */
  sawImage: boolean;
}

export interface Applied {
  lines: { pageId?: string; text: string; caution?: boolean }[];
  focus?: string;
  skipped: number;
  /** why each skipped change was left out, in plain words */
  reasons?: string[];
}

function skip(out: Applied, why: string) {
  out.skipped++;
  (out.reasons ||= []).push(why);
}

const digits = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) || []).map((d) => d.replace(',', '.'));

/** A figure is accepted only if its numbers were given — in words, or in an image. */
function figureCheck(value: string, m: Material): 'ok' | 'image' | 'invented' {
  const need = digits(value);
  if (!need.length) return 'ok';
  // the person's own words: the numbers are enough ("engagement is 55 percent" gives +55%)
  const have = digits(m.said);
  if (need.every((d) => have.includes(d))) return 'ok';
  // anything else it read: only the figure exactly as written there
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  if (m.seen && norm(m.seen).includes(norm(value))) return 'ok';
  return m.sawImage ? 'image' : 'invented';
}

function short(s?: string, n = 48) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

function blockName(b: Block) {
  return short(b.label || b.text || b.type, 32);
}

function setWords(b: Block, src: Partial<Fill>, m: Material, out: Applied, pageNo: number, pageId: string) {
  const changes: string[] = [];
  const put = (k: 'text' | 'support' | 'label', v?: string) => {
    if (typeof v !== 'string') return;
    const s = v.trim().slice(0, 600);
    if (!s || s === b[k]) return;
    b[k] = s;
    changes.push(k);
  };
  put('text', src.text);
  put('support', src.support);
  put('label', src.label);
  if (Array.isArray(src.items) && src.items.length) {
    b.items = src.items.map((x) => String(x).trim().slice(0, 300)).filter(Boolean).slice(0, 12);
    changes.push('items');
  }
  let caution = false;
  if (typeof src.value === 'string' && src.value.trim() && src.value.trim() !== b.value) {
    const v = src.value.trim().slice(0, 40);
    const check = figureCheck(v, m);
    if (check === 'invented') {
      skip(out, `a figure nobody gave (${v})`);
    } else {
      const before = b.value;
      b.value = v;
      caution = check === 'image';
      out.lines.push({
        pageId,
        caution,
        text: `Page ${pageNo}, ${blockName(b)}: ${before ? before + ' → ' : ''}${v}${caution ? ' (read from your image — check it)' : ''}`,
      });
    }
  }
  if (changes.length) out.lines.push({ pageId, text: `Page ${pageNo}, ${blockName(b)}: rewrote ${changes.join(', ')}` });
}

function placeImage(page: Page, media: MediaRef, blockId?: string): boolean {
  const t = getTemplate(page.templateId);
  const all = Object.values(page.slots).flat();
  const target = blockId ? all.find((b) => b.id === blockId) : undefined;
  if (target?.type === 'card') {
    target.showImage = true;
    target.media = { ...media };
    return true;
  }
  if (target && (target.type === 'image' || target.type === 'video')) {
    target.media = { ...media };
    return true;
  }
  const slot = t.slots.find((s) => s.accepts.includes('image'));
  if (slot) {
    const list = page.slots[slot.key] || (page.slots[slot.key] = []);
    const existing = list.find((b) => b.type === 'image');
    if (existing) existing.media = { ...media };
    else if (list.length < slot.max) list.push({ id: uid('b'), type: 'image', media: { ...media } } as Block);
    else return false;
    return true;
  }
  page.background = { kind: 'image', media: { ...media }, overlay: 'gradient' } as Page['background'];
  return true;
}

/**
 * Applies the operations to a draft of the deck. Anything that refers to a
 * page, block, layout or picture that does not exist is skipped, not guessed.
 */
export function applyDeckOps(d: Presentation, ops: DeckOp[], m: Material): Applied {
  const out: Applied = { lines: [], skipped: 0 };
  const pageNo = (id: string) => d.pages.findIndex((p) => p.id === id) + 1;
  const layoutOk = (id?: string) => !!id && TEMPLATES.some((t) => t.id === id);

  for (const op of ops || []) {
    const page = op.pageId ? d.pages.find((p) => p.id === op.pageId) : undefined;
    switch (op.op) {
      case 'set_text': {
        const b = page && Object.values(page.slots).flat().find((x) => x.id === op.blockId);
        if (!page || !b) {
          skip(out, 'a block that is not in this deck');
          break;
        }
        setWords(b, op, m, out, pageNo(page.id), page.id);
        out.focus = page.id;
        break;
      }
      case 'remove_block': {
        const key = page && Object.keys(page.slots).find((k) => page.slots[k].some((b) => b.id === op.blockId));
        if (!page || !key) {
          skip(out, 'a block that is not in this deck');
          break;
        }
        const b = page.slots[key].find((x) => x.id === op.blockId)!;
        page.slots[key] = page.slots[key].filter((x) => x.id !== op.blockId);
        out.lines.push({ pageId: page.id, text: `Page ${pageNo(page.id)}: removed ${short(b.text || b.label || b.value || b.type, 32)}` });
        out.focus = page.id;
        break;
      }
      case 'tidy_page': {
        const targets = op.pageId === 'all' ? d.pages : page ? [page] : [];
        if (!targets.length) {
          skip(out, 'a page that is not in this deck');
          break;
        }
        let any = 0;
        targets.forEach((p) => {
          const n = tidyPage(p);
          any += n;
          if (n) out.lines.push({ pageId: p.id, text: `Page ${pageNo(p.id)}: reformatted to the layout's styling (${n} ${n === 1 ? 'fix' : 'fixes'})` });
        });
        if (!any) out.lines.push({ pageId: targets[0].id, text: 'Already consistent: nothing to reformat' });
        out.focus = targets[0].id;
        break;
      }
      case 'add_page': {
        if (!layoutOk(op.layout)) {
          skip(out, 'a layout that is not approved');
          break;
        }
        const np = createPage(op.layout!, op.section || undefined, d.brand as BrandId);
        const t = getTemplate(op.layout!);
        const quiet: Applied = { lines: [], skipped: 0 };
        for (const f of op.fills || []) {
          const slot = t.slots.find((s) => s.key === f.slot);
          if (!slot) continue;
          const list = np.slots[slot.key] || (np.slots[slot.key] = []);
          const i = Math.max(0, Math.min(slot.max - 1, Number(f.index) || 0));
          if (f.image && !f.text && !f.value && !f.label) {
            const media = m.media(f.image);
            const target = list[i];
            if (media) placeImage(np, media, target?.id);
            continue;
          }
          // a repeat of the slot's own shape, emptied, when the fill asks for more than the seed has
          while (list.length <= i && list.length && list.length < slot.max) {
            const src = list[list.length - 1];
            list.push({ ...src, id: uid('b'), text: src.text !== undefined ? '' : undefined, value: undefined, label: src.label !== undefined ? '' : undefined, support: src.support !== undefined ? '' : undefined });
          }
          const b = list[i];
          if (!b) continue;
          setWords(b, f, m, quiet, 0, np.id);
          if (f.image) {
            const media = m.media(f.image);
            if (media) placeImage(np, media, b.id);
          }
        }
        // the template's sample content never reaches a buyer unannounced: in every slot the
        // request filled, items it did not fill are removed; elsewhere sample figures are cleared
        const filledAt: Record<string, number> = {};
        (op.fills || []).forEach((f) => {
          const i = Number(f.index) || 0;
          filledAt[f.slot] = Math.max(filledAt[f.slot] ?? -1, i);
        });
        t.slots.forEach((s) => {
          const list = np.slots[s.key] || [];
          if (filledAt[s.key] !== undefined) np.slots[s.key] = list.slice(0, filledAt[s.key] + 1);
          else list.forEach((b) => b.value && (b.value = ''));
        });
        const at = op.afterPageId === 'start' ? 0 : d.pages.findIndex((p) => p.id === op.afterPageId) + 1 || d.pages.length;
        d.pages.splice(at, 0, np);
        out.skipped += quiet.skipped;
        (quiet.reasons || []).forEach((r) => (out.reasons ||= []).push(r));
        out.lines.push({
          pageId: np.id,
          caution: quiet.lines.some((l) => l.caution),
          text: `Added page ${at + 1}: ${t.name}${quiet.lines.some((l) => l.caution) ? ' (figures read from your image — check them)' : ''}`,
        });
        out.focus = np.id;
        break;
      }
      case 'copy_page': {
        const src = op.pageData;
        if (!src || !TEMPLATES.some((t) => t.id === src.templateId)) {
          skip(out, 'a page that could not be found in the team library');
          break;
        }
        // a fresh copy with new ids; it takes this deck's brand unless the source page was itself an exception
        const np = JSON.parse(JSON.stringify(src)) as Page;
        np.id = uid('pg');
        Object.values(np.slots).forEach((list) => list.forEach((b) => (b.id = uid('b'))));
        const at = op.afterPageId === 'start' ? 0 : d.pages.findIndex((p) => p.id === op.afterPageId) + 1 || d.pages.length;
        d.pages.splice(at, 0, np);
        out.lines.push({ pageId: np.id, text: `Copied in as page ${at + 1}: ${getTemplate(np.templateId).name}` });
        out.focus = np.id;
        break;
      }
      case 'delete_page': {
        if (!page || d.pages.length === 1) {
          skip(out, 'a page that is not in this deck (or the only page)');
          break;
        }
        const n = pageNo(page.id);
        d.pages = d.pages.filter((p) => p.id !== page.id);
        out.lines.push({ text: `Removed page ${n}` });
        out.focus = d.pages[Math.max(0, n - 2)]?.id;
        break;
      }
      case 'move_page': {
        if (!page) {
          skip(out, 'a page that is not in this deck');
          break;
        }
        d.pages = d.pages.filter((p) => p.id !== page.id);
        const at = op.afterPageId === 'start' ? 0 : d.pages.findIndex((p) => p.id === op.afterPageId) + 1 || d.pages.length;
        d.pages.splice(at, 0, page);
        out.lines.push({ pageId: page.id, text: `Moved to page ${at + 1}` });
        out.focus = page.id;
        break;
      }
      case 'change_layout': {
        if (!page || !layoutOk(op.layout) || op.layout === page.templateId) {
          skip(out, 'a layout change to an unapproved or identical layout');
          break;
        }
        const t = getTemplate(op.layout!);
        page.slots = remapSlots(page, op.layout!);
        page.templateId = op.layout!;
        if (page.background?.kind === 'theme' && t.background) page.background = JSON.parse(JSON.stringify(t.background));
        out.lines.push({ pageId: page.id, text: `Page ${pageNo(page.id)}: now ${t.name}` });
        out.focus = page.id;
        break;
      }
      case 'set_image': {
        const media = op.image ? m.media(op.image) : undefined;
        if (!page || !media || !placeImage(page, media, op.blockId)) {
          skip(out, 'a picture that could not be found');
          break;
        }
        out.lines.push({ pageId: page.id, text: `Page ${pageNo(page.id)}: placed ${short(media.alt || 'the picture', 32)}` });
        out.focus = page.id;
        break;
      }
      default:
        skip(out, 'something it cannot do');
    }
  }
  // every page an edit touched answers to the design framework before it is shown to anyone
  const touched = new Set(out.lines.map((l) => l.pageId).filter(Boolean) as string[]);
  d.pages.forEach((p) => {
    if (!touched.has(p.id)) return;
    enforcePage(p).forEach((fix) => out.lines.push({ pageId: p.id, text: `Page ${pageNo(p.id)}: ${fix}` }));
  });
  return out;
}
