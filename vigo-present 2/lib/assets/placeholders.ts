/**
 * Placeholder imagery.
 * ---------------------------------------------------------------------------
 * Until the real Vigo / Alessi photography library is connected, the asset
 * browser is populated with generated, clearly-labelled placeholder plates.
 * They are deterministic SVG data URIs so nothing has to be hosted.
 * Swap `ASSET_LIBRARY` for real CDN URLs and everything else keeps working.
 */

import type { Asset, AssetCategory } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';

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

export function placeholderImage(seed: string, label = '', tone?: string): string {
  const keys = ROTATION;
  const t = TONES[tone || keys[hash(seed) % keys.length]];
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
