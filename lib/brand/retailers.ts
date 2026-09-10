import type { MediaRef } from '@/lib/model/types';

/**
 * RETAILERS
 * ---------------------------------------------------------------------------
 * A deck built for one account carries that account's mark. The sales team
 * makes a Publix deck, a Walmart deck and a Target deck out of the same
 * material, so the retailer is a property of the DECK, not of a page or a
 * block — set it once and every page that shows the brand lockup co-brands.
 *
 * The shipped marks live in /public/retailers and are referenced by id, so a
 * deck stores four characters rather than an image, and replacing a mark
 * (a rebrand, a better cut) updates every deck ever made. Anything not on
 * this list is carried as `media`, which is how an account we have not
 * shipped a logo for still works the day someone needs it.
 *
 * Trademarks belong to the retailers. These are here so a Vigo salesperson
 * can address an account by name; they are not Vigo's marks and the deck
 * never implies endorsement.
 */

export interface RetailerRef {
  /** id from the list below, or 'custom' when the mark was uploaded */
  id: string;
  /** the account's name — alt text, and the fallback when there is no mark */
  name: string;
  /** set only for an uploaded mark */
  media?: MediaRef;
}

export interface RetailerDef {
  id: string;
  name: string;
  src: string;
  /** how much wider than tall the mark is — reserves the right box before load */
  ratio: number;
}

export const RETAILERS: RetailerDef[] = [
  { id: 'publix', name: 'Publix', src: '/retailers/publix.png', ratio: 1000 / 210 },
  { id: 'walmart', name: 'Walmart', src: '/retailers/walmart.png', ratio: 1000 / 236 },
  { id: 'target', name: 'Target', src: '/retailers/target.png', ratio: 1000 / 276 },
];

export function retailerDef(id?: string): RetailerDef | undefined {
  return RETAILERS.find((r) => r.id === id);
}

/** The image to draw for a deck's retailer, shipped or uploaded. */
export function retailerSrc(r?: RetailerRef): string | undefined {
  if (!r) return undefined;
  const def = retailerDef(r.id);
  if (def) return def.src;
  return r.media?.url || undefined;
}
