/**
 * Placeholder imagery.
 * ---------------------------------------------------------------------------
 * Until the real Vigo / Alessi photography library is connected, the asset
 * browser is populated with generated, clearly-labelled placeholder plates.
 * They are deterministic SVG data URIs so nothing has to be hosted.
 * Swap `ASSET_LIBRARY` for real CDN URLs and everything else keeps working.
 */

import type { Asset, AssetCategory } from '@/lib/model/types';
import type { BrandId, ColorRole } from '@/lib/brand/themes';
import { THEMES } from '@/lib/brand/themes';

const TONES: Record<string, [string, string, string]> = {
  stone: ['#E8E3DA', '#C7BEB1', '#8E8578'],
  clay: ['#E3D8CC', '#C0A98F', '#7E6A52'],
  olive: ['#DCDDD1', '#AFB39C', '#6F7462'],
  slate: ['#DDE0E3', '#AEB5BC', '#6B737B'],
  ink: ['#3A3B3E', '#26282B', '#131416'],
  cream: ['#F5F1E9', '#E4DCCC', '#B9AE98'],
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const ROTATION = ['stone', 'clay', 'olive', 'slate', 'cream'];

/* ------------------------------------------------------- brand-tinted tones

   A placeholder is the first thing anyone sees of a layout — it fills the
   template previews in "Add a page" and every image area on a new page. Drawn
   in neutral greys, every layout looked the same whichever brand the deck was,
   which rather undercuts a tool whose whole promise is that pages arrive on
   brand.

   The tones are derived from each brand's own approved SURFACE colours rather
   than written out again here, so they cannot drift from themes.ts: change
   Alessi's terracotta there and these follow. White and black are filtered out
   — they make no plate worth looking at.                                     */

const hex2rgb = (h: string): [number, number, number] => {
  const v = h.replace('#', '');
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgb2hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');

/** Mixes a colour toward white (t > 0) or black (t < 0). */
function shade(hexColor: string, t: number): string {
  const [r, g, b] = hex2rgb(hexColor);
  const target = t >= 0 ? 255 : 0;
  const k = Math.abs(t);
  return rgb2hex(r + (target - r) * k, g + (target - g) * k, b + (target - b) * k);
}

/**
 * Plates are tinted, not saturated: the mid stop is pulled well toward white so
 * a full-bleed Vigo red or Alessi yellow reads as a surface a photograph will
 * replace, rather than shouting over the layout it is meant to demonstrate.
 */
function brandTones(brand: BrandId): [string, string, string][] {
  const theme = THEMES[brand];
  const roles = (theme.surfaceColors || []).filter((c: ColorRole) => c !== 'white' && c !== 'black');
  if (!roles.length) return ROTATION.map((k) => TONES[k]);
  return roles.map((role: ColorRole) => {
    const base = theme.colors[role];
    const [r, g, b] = hex2rgb(base);
    // 50, not 90: the luminance formula weights red so low that Vigo's #E90000
    // scores 70 and would take the dark branch, giving a saturated red plate.
    // Only genuine near-blacks belong there.
    const dark = (r * 299 + g * 587 + b * 114) / 1000 < 50;
    // A near-black brand colour cannot be tinted toward white without losing
    // its identity, so it is lightened instead of washed out.
    return dark
      ? ([shade(base, 0.34), shade(base, 0.16), base] as [string, string, string])
      : ([shade(base, 0.62), shade(base, 0.14), shade(base, -0.42)] as [string, string, string]);
  });
}

export function placeholderImage(seed: string, label = '', tone?: string, brand?: BrandId): string {
  const palette = brand ? brandTones(brand) : ROTATION.map((k) => TONES[k]);
  const t = tone && TONES[tone] ? TONES[tone] : palette[hash(seed) % palette.length];
  const h = hash(seed);
  const a1 = (h % 60) - 30;
  const cx = 20 + (h % 60);
  const cy = 20 + ((h >> 3) % 60);
  const r1 = 30 + ((h >> 5) % 40);
  const r2 = 18 + ((h >> 7) % 30);
  const dark = t[2];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${a1} .5 .5)">
      <stop offset="0" stop-color="${t[0]}"/><stop offset="1" stop-color="${t[1]}"/>
    </linearGradient>
    <radialGradient id="r" cx="${cx}%" cy="${cy}%" r="${r1}%">
      <stop offset="0" stop-color="${dark}" stop-opacity=".38"/>
      <stop offset="1" stop-color="${dark}" stop-opacity="0"/>
    </radialGradient>
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3"/><feColorMatrix type="saturate" values="0"/></filter>
  </defs>
  <rect width="1200" height="800" fill="url(#g)"/>
  <circle cx="${cx * 12}" cy="${cy * 8}" r="${r1 * 5}" fill="url(#r)"/>
  <circle cx="${1200 - cx * 9}" cy="${800 - cy * 5}" r="${r2 * 6}" fill="${dark}" opacity=".10"/>
  <rect width="1200" height="800" filter="url(#n)" opacity=".07"/>
  ${
    label
      ? `<text x="60" y="740" font-family="Inter,system-ui,sans-serif" font-size="26" letter-spacing="3" fill="${dark}" opacity=".55">${label.toUpperCase()}</text>`
      : ''
  }
</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg.replace(/\s+/g, ' '));
}

const CATALOG: { category: AssetCategory; names: string[]; tone?: string }[] = [
  { category: 'Product Photography', names: ['Jar on marble', 'Bottle, side light', 'Tin, overhead', 'Pouch, angled', 'Range, three up', 'Label detail'] },
  { category: 'Lifestyle', names: ['Family table', 'Kitchen counter', 'Pouring detail', 'Market stall', 'Hands, plating', 'Evening table'], tone: 'clay' },
  { category: 'Recipes', names: ['Risotto, finished', 'Bruschetta board', 'Soup, close', 'Pasta toss', 'Salad, overhead', 'Bean stew'], tone: 'olive' },
  { category: 'Retail', names: ['Shelf set', 'Endcap display', 'Store aisle', 'Demo table', 'Case stack', 'Signage'], tone: 'slate' },
  { category: 'Social', names: ['Reel still 01', 'Reel still 02', 'Grid post 01', 'Grid post 02', 'Creator frame', 'Story frame'] },
  { category: 'Packaging', names: ['Front panel', 'Back panel', 'Case pack', 'Carton', 'Sleeve', 'Cap detail'], tone: 'cream' },
  { category: 'Backgrounds', names: ['Linen', 'Stone', 'Olive wood', 'Marble', 'Dark slate', 'Paper'], tone: 'stone' },
];

function buildFor(brand: BrandId): Asset[] {
  const out: Asset[] = [];
  CATALOG.forEach((group) => {
    group.names.forEach((name, i) => {
      const seed = brand + group.category + name + i;
      out.push({
        id: 'as_' + hash(seed).toString(36),
        brand,
        category: group.category,
        kind: 'image',
        name,
        url: placeholderImage(seed, name, group.tone),
        width: 1200,
        height: 800,
      });
    });
  });
  return out;
}

let cache: Asset[] | null = null;

export function assetLibrary(): Asset[] {
  if (!cache) {
    cache = [...buildFor('corporate'), ...buildFor('vigo'), ...buildFor('alessi')];
  }
  return cache;
}

export function assetsFor(brand: BrandId, category: AssetCategory | 'All'): Asset[] {
  return assetLibrary().filter((a) => a.brand === brand && (category === 'All' || a.category === category));
}
