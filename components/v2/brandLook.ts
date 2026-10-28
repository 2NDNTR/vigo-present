import { THEMES, type BrandId } from '@/lib/brand/themes';

/**
 * How a brand presents itself in the app's chrome: its own ground, ink, logo
 * and one signature colour. Taken from the brand theme, so a rebrand in
 * themes.ts reaches the dashboard too. A brand added later without a theme
 * gets the app's neutral sand until its identity is configured.
 */
export interface BrandLook {
  ground: string;
  ink: string;
  swatch: string;
  logo?: string;
  wordmark: string;
}

const SIGNATURE: Partial<Record<BrandId, { ground: keyof (typeof THEMES)['vigo']['colors']; ink: keyof (typeof THEMES)['vigo']['colors']; swatch: keyof (typeof THEMES)['vigo']['colors'] }>> = {
  corporate: { ground: 'cream', ink: 'brandPrimary', swatch: 'accent' },
  vigo: { ground: 'brandYellow', ink: 'black', swatch: 'brandRed' },
  alessi: { ground: 'cream', ink: 'brandPrimary', swatch: 'terracotta' },
};

export function brandLook(id: string): BrandLook {
  const theme = (THEMES as Record<string, (typeof THEMES)['vigo']>)[id];
  const sig = SIGNATURE[id as BrandId];
  if (!theme || !sig) {
    return { ground: '#e3c5b0', ink: '#000000', swatch: '#98d0d9', wordmark: id.toUpperCase() };
  }
  return {
    ground: theme.colors[sig.ground],
    ink: theme.colors[sig.ink],
    swatch: theme.colors[sig.swatch],
    logo: theme.logo.files?.primary,
    wordmark: theme.logo.text,
  };
}
