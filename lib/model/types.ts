import type { BrandId, ColorRole, TypeRole } from '@/lib/brand/themes';
import type { RetailerRef } from '@/lib/brand/retailers';

/**
 * CRITICAL TECHNICAL PRINCIPLE
 * ---------------------------------------------------------------------------
 * A presentation is NEVER stored as HTML. It is stored as structured data:
 *   Presentation -> Page -> Template -> Slots -> Blocks -> Content
 * All visual decisions live in the brand theme, so updating a token updates
 * every presentation ever created.
 */

export type BlockType =
  | 'text'
  | 'metric'
  | 'image'
  | 'video'
  | 'logo'
  | 'quote'
  | 'checklist'
  | 'bullets'
  | 'divider'
  | 'cta'
  | 'logoGrid'
  | 'timeline'
  | 'table'
  | 'card';

export type Align = 'left' | 'center';

/** Column kind, inferred on ingest; drives alignment and number formatting. */
export type CellType = 'text' | 'number' | 'currency' | 'percent' | 'date';

export interface TableData {
  headers: string[];
  rows: string[][];
  types?: CellType[];
  /** a TOTAL row lifted out of the body so it can be ruled off and bolded */
  total?: string[];
  /** shown under the table — where the numbers came from */
  source?: string;
}

export interface BlockStyle {
  role?: TypeRole;          // typography role — user picks the role, not the size
  color?: ColorRole | 'auto';
  align?: Align;
}

export interface MediaRef {
  url: string;
  focalX?: number;   // 0..1
  focalY?: number;   // 0..1
  zoom?: number;     // 1 = cover
  alt?: string;
  poster?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  assetId?: string;
  width?: number;
  height?: number;
}

export interface TimelineEntry {
  date: string;
  text?: string;
  media?: MediaRef;
}

export interface LogoEntry {
  /** the brand's name — alt text, fallback wordmark, and searchable copy */
  name: string;
  /** an optional line under the mark saying what it is */
  caption?: string;
  media?: MediaRef;
}

export interface Block {
  id: string;
  type: BlockType;
  style?: BlockStyle;
  // text
  text?: string;
  // metric
  value?: string;
  label?: string;
  support?: string;
  trend?: 'up' | 'down' | 'none';
  // media
  media?: MediaRef;
  // list-ish
  items?: string[];
  /**
   * Timeline milestones as structured data — date, copy and an optional
   * picture. Blocks authored before this existed still carry `items`;
   * `lib/model/timeline.ts` reads either and writes this one.
   */
  entries?: TimelineEntry[];
  // card / product card
  wholesale?: string;
  msrp?: string;
  showImage?: boolean;
  // table — ingested from a spreadsheet, see lib/data/sheet.ts
  table?: TableData;
  // logo grid
  columns?: number;
  /**
   * Logo grid cells as structured data — mark, name and an optional caption.
   * Blocks authored before this existed still carry `items`;
   * `lib/model/logos.ts` reads either and writes this one.
   */
  logos?: LogoEntry[];
  // logo
  variant?: 'auto' | 'primary' | 'white' | 'black' | 'mark';
  brand?: BrandId;
  // cta
  href?: string;
}

export type Overlay = 'none' | 'light' | 'dark' | 'gradient' | 'gradientTop' | 'scrim';

export interface PageBackground {
  kind: 'theme' | 'color' | 'image' | 'video';
  color?: ColorRole;
  media?: MediaRef;
  overlay?: Overlay;
}

export interface Page {
  id: string;
  templateId: string;
  /** starts a new named section in the navigator when present */
  sectionStart?: string;
  /**
   * Page chrome. `headline` is the running head top-left — undefined means the
   * page has none, which is different from an empty one. `showLogo` puts the
   * brand lockup top-right. Both have been written by the editor since the
   * chrome band existed; they belong in the type.
   */
  headline?: string;
  showLogo?: boolean;
  /** per-page brand styling for corporate / multi-brand decks */
  brandOverride?: BrandId;
  background: PageBackground;
  slots: Record<string, Block[]>;
  notes?: string;
}

export type PresentationStatus = 'draft' | 'published' | 'unpublished';
export type ShareAccess = 'public' | 'password' | 'internal';
export type PresentationMode = 'scroll' | 'slide';

export interface ShareSettings {
  slug: string;
  access: ShareAccess;
  password?: string;
  mode: PresentationMode;
}

export interface Presentation {
  id: string;
  orgId: string;
  title: string;
  brand: BrandId;
  /**
   * The account this deck was built for. Set on the deck, not the page: a
   * retailer deck is the same material addressed to one buyer, so the mark
   * follows the brand lockup onto every page that shows one.
   */
  retailer?: RetailerRef;
  status: PresentationStatus;
  /** locked decks are read-only and their share settings are frozen */
  locked?: boolean;
  share: ShareSettings;
  pages: Page[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  /** server row version — used to refuse a save that would overwrite someone */
  version?: number;
}

export interface PresentationVersion {
  id: string;
  presentationId: string;
  createdAt: number;
  label: string;
  snapshot: Presentation;
}

export interface Asset {
  id: string;
  brand: BrandId;
  category: AssetCategory;
  kind: 'image' | 'video' | 'logo';
  name: string;
  url: string;
  width?: number;
  height?: number;
}

export type AssetCategory =
  | 'Logos'
  | 'Product Photography'
  | 'Lifestyle'
  | 'Recipes'
  | 'Retail'
  | 'Social'
  | 'Packaging'
  | 'Backgrounds'
  | 'Icons';

export const ASSET_CATEGORIES: AssetCategory[] = [
  'Logos',
  'Product Photography',
  'Lifestyle',
  'Recipes',
  'Retail',
  'Social',
  'Packaging',
  'Backgrounds',
  'Icons',
];

export function uid(prefix = 'id'): string {
  return (
    prefix +
    '_' +
    Math.random().toString(36).slice(2, 9) +
    Math.random().toString(36).slice(2, 5)
  );
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'presentation'
  );
}
