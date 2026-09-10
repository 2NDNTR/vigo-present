import type { AssetCategory } from '@/lib/model/types';

/**
 * ASSET NAMING — SHARED BY BOTH RUNTIMES
 * ---------------------------------------------------------------------------
 * These four helpers decide what an asset is called and where it is filed.
 * Nothing here touches IndexedDB, the DOM, or the database, which is the point:
 * the browser uploader and the server-side importer have to derive *identical*
 * ids and pathnames or the "replace once, updates everywhere" promise quietly
 * breaks — a re-import would sit alongside the hand-uploaded file instead of
 * replacing it.
 *
 * They used to live in `uploads.ts`, but that module is `'use client'` because
 * it owns the IndexedDB store. Importing it from a route handler compiles
 * cleanly and then throws at request time, which is a bad way to find out. Kept
 * separate, both sides can share one definition. `uploads.ts` re-exports these,
 * so every existing import keeps working.
 */

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'asset';

export const prettyName = (s: string) =>
  s
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Folder a file belongs in, matching the repository layout. */
export const CATEGORY_FOLDER: Record<string, string> = {
  'Product Photography': 'product',
  Lifestyle: 'lifestyle',
  Recipes: 'recipes',
  Retail: 'retail',
  Social: 'social',
  Packaging: 'packaging',
  Backgrounds: 'backgrounds',
  Logos: 'logos',
  Icons: 'icons',
};

export function assetPathFor(a: { brand: string; category: string; fileName: string }): string {
  return `/assets/${a.brand}/${CATEGORY_FOLDER[a.category] || 'misc'}/${a.fileName}`;
}

export type { AssetCategory };
