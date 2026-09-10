import type { Block, TimelineEntry } from './types';

export type { TimelineEntry };

/**
 * TIMELINE ENTRIES
 * ---------------------------------------------------------------------------
 * A milestone is a date, a short line about what happened, and optionally a
 * picture. It used to be one string — "1946 — Founded in Tampa" — which meant
 * the date could not be set differently from the sentence, and there was
 * nowhere to hang an image.
 *
 * Existing decks are NOT migrated. Every one of them stores the old strings,
 * and rewriting the data of decks people have already sent to buyers to make a
 * layout change is not a trade worth making. Instead `entriesOf()` reads either
 * shape, and the first edit writes the new one. A deck nobody touches keeps
 * working forever; a deck someone edits quietly gains the new structure.
 */

/**
 * Splits a legacy milestone into its date and its sentence.
 *
 * Every deck in the product uses "date — text" with an em dash, because that is
 * what the seeds shipped with, so that is the case worth getting right. An en
 * dash, a hyphen surrounded by spaces, or a colon all read as the same
 * intention. Failing that, a leading year or numeric token is taken as the
 * date, which covers "1946 Founded in Tampa".
 *
 * If none of that matches, the whole string becomes the date rather than the
 * text. A milestone that is only "Founded in Tampa" is better shown large and
 * alone than shown as a caption under an empty date.
 */
export function parseMilestone(raw: string): TimelineEntry {
  const s = (raw || '').trim();
  if (!s) return { date: '' };

  const separated = s.match(/^(.{1,24}?)\s*[—–]\s*(.+)$/) || s.match(/^(.{1,24}?)\s+-\s+(.+)$/) || s.match(/^(.{1,24}?)\s*:\s+(.+)$/);
  if (separated) return { date: separated[1].trim(), text: separated[2].trim() };

  const leading = s.match(/^((?:19|20)\d{2}(?:\s*[–—-]\s*(?:19|20)?\d{2})?|Q[1-4](?:\s*['’]?\d{2,4})?|\d{1,4})\s+(.+)$/i);
  if (leading) return { date: leading[1].trim(), text: leading[2].trim() };

  return { date: s };
}

/** Reads a timeline block in either shape. Never mutates the block. */
export function entriesOf(block: Block): TimelineEntry[] {
  if (block.entries?.length) return block.entries;
  return (block.items || []).map(parseMilestone);
}

/**
 * The patch that saves an edit. `items` is cleared deliberately: once a block
 * carries structured entries, leaving the old strings behind would be a second
 * source of truth, and the two would drift the moment anyone typed.
 */
export function entriesPatch(entries: TimelineEntry[]): Partial<Block> {
  return { entries, items: undefined };
}

/** True when the row should reserve space for pictures. */
export function showsMedia(block: Block): boolean {
  if (typeof block.showImage === 'boolean') return block.showImage;
  return entriesOf(block).some((e) => !!e.media?.url);
}

export const EMPTY_ENTRY: TimelineEntry = { date: 'Year', text: 'What happened' };
