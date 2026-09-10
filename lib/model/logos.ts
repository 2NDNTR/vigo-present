import type { Block, LogoEntry } from './types';

export type { LogoEntry };

/**
 * LOGO GRID ENTRIES
 * ---------------------------------------------------------------------------
 * A logo grid cell is a mark, a name, and optionally a line saying what the
 * thing is. It used to be a bare string, which meant a page of partners or
 * house brands could only ever be a list of typeset names — and a brand page
 * that spells "ALESSI" in the deck's own headline face is not showing the
 * Alessi brand, it is showing the word.
 *
 * As with the timeline, existing decks are NOT migrated. `logosOf()` reads
 * either shape and the first edit writes the new one, so a deck nobody touches
 * keeps rendering exactly as it did.
 *
 * The name is kept even when there is artwork. It is the alt text, it is what
 * the cell falls back to if the asset is ever removed from the library, and it
 * is what someone searching the deck's text will match on.
 */

/** Reads a logo grid in either shape. Never mutates the block. */
export function logosOf(block: Block): LogoEntry[] {
  if (block.logos?.length) return block.logos;
  return (block.items || []).map((name) => ({ name }));
}

/**
 * The patch that saves an edit. `items` is cleared deliberately — two sources
 * of truth for the same list drift the moment anyone types.
 */
export function logosPatch(logos: LogoEntry[]): Partial<Block> {
  return { logos, items: undefined };
}

/**
 * True once at least one cell carries real artwork.
 *
 * Checks `assetId` as well as `url` because a block that has been through the
 * store has only the id — the URL is resolved from the asset record at render
 * time. Anything asking "is there a logo here?" that looks at `url` alone gets
 * the wrong answer for every saved deck.
 */
export function hasArtwork(block: Block): boolean {
  return logosOf(block).some((l) => !!(l.media?.assetId || l.media?.url));
}

export const EMPTY_LOGO: LogoEntry = { name: 'Name' };
