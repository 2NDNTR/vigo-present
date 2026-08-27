import type { BrandId, ColorRole, TypeRole } from '@/lib/brand/themes';

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
  | 'card';

export type Align = 'left' | 'center';

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
  // card / product card
  wholesale?: string;
  msrp?: string;
  showImage?: boolean;
  // logo grid
  columns?: number;
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
