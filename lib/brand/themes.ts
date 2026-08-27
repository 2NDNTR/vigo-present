/**
 * BRAND / THEME ARCHITECTURE
 * ---------------------------------------------------------------------------
 * This is the single source of truth for every design decision in the product.
 * Presentations never store colors, fonts or sizes — they store *roles*
 * ("headline", "brandPrimary"). Change a value here and every presentation
 * ever created inherits the change.
 *
 * The values below are deliberately NEUTRAL PLACEHOLDERS. Replace the hex
 * values, font families and logo files with the real Vigo / Alessi brand
 * assets and nothing else in the codebase needs to change.
 */

export type BrandId = 'corporate' | 'vigo' | 'alessi';

export type ColorRole =
  | 'brandPrimary'
  | 'brandSecondary'
  | 'accent'
  | 'cream'
  | 'white'
  | 'black'
  | 'neutral'
  | 'brandYellow'
  | 'brandRed'
  | 'terracotta'
  | 'paleCream';

export type TypeRole =
  | 'display'
  | 'headline'
  | 'subhead'
  | 'body'
  | 'caption'
  | 'eyebrow'
  | 'quote'
  | 'metricXl'
  | 'metricLarge'
  | 'metricLabel';

export interface TypeStyle {
  /** size in design units (1 unit = 1px at the 1600x900 reference stage) */
  size: number;
  weight: number;
  lineHeight: number;
  tracking: number; // em
  family: 'display' | 'body';
  transform?: 'none' | 'uppercase';
}

export interface BrandTheme {
  id: BrandId;
  name: string;
  shortName: string;
  description: string;
  /**
   * Real artwork when `files` is present; otherwise the text wordmark is drawn
   * as a stand-in. Users pick an approved variant and nothing else — the logo
   * can't be recoloured, stretched or modified.
   */
  logo: {
    text: string;
    mark: string;
    tracking: number;
    weight: number;
    family: 'display' | 'body';
    files?: Partial<Record<'primary' | 'white' | 'black' | 'mark', string>>;
    /** width / height of the supplied artwork, so it never distorts */
    aspect?: number;
    /** rendered height in design units, and the minimum it may ever appear at */
    height?: number;
    minHeight?: number;
  };
  fonts: { display: string; body: string };
  colors: Record<ColorRole, string>;
  /**
   * The approved colours for TYPE, in the order they appear in the panel.
   * Deliberately separate from the page-surface palette — a colour can be
   * right for a headline and wrong for a full page, and vice versa.
   */
  textColors: ColorRole[];
  /**
   * The approved colours a PAGE SURFACE may be set to, in panel order.
   * Separate from textColors — a colour can be right behind type and wrong
   * inside it, and vice versa.
   */
  surfaceColors: ColorRole[];
  /** brand-specific names for shared roles, e.g. Vigo Red vs Terracotta */
  colorLabels?: Partial<Record<ColorRole, string>>;
  /** default page surface + ink pairing */
  surface: { bg: ColorRole; ink: ColorRole; muted: string };
  /** ink used when a page has a full-bleed image behind it */
  onImageInk: ColorRole;
  type: Record<TypeRole, TypeStyle>;
  /** identity of the accent rule/underline used by section dividers */
  rule: { color: ColorRole; weight: number };
}

const BASE_TYPE: Record<TypeRole, TypeStyle> = {
  display: { size: 132, tracking: 0, weight: 600, lineHeight: 0.94, family: 'display' },
  headline: { size: 76, tracking: 0, weight: 600, lineHeight: 1.02, family: 'display' },
  subhead: { size: 34, tracking: 0, weight: 400, lineHeight: 1.28, family: 'body' },
  body: { size: 22, tracking: 0, weight: 400, lineHeight: 1.55, family: 'body' },
  caption: { size: 15, tracking: 0, weight: 500, lineHeight: 1.4, family: 'body', transform: 'uppercase' },
  eyebrow: { size: 24, tracking: 0, weight: 600, lineHeight: 1.2, family: 'body', transform: 'uppercase' },
  quote: { size: 52, tracking: 0, weight: 400, lineHeight: 1.24, family: 'display' },
  metricXl: { size: 200, tracking: 0, weight: 600, lineHeight: 0.86, family: 'display' },
  metricLarge: { size: 120, tracking: 0, weight: 600, lineHeight: 0.88, family: 'display' },
  metricLabel: { size: 17, tracking: 0, weight: 600, lineHeight: 1.35, family: 'body', transform: 'uppercase' },
};

/**
 * BRAND RULE: letter-spacing is 0 on every typographic role, in every brand.
 * It is enforced here rather than left as thirty separate values, so no future
 * theme edit can quietly reintroduce tracking anywhere in the system.
 */
function typeFor(overrides: Partial<Record<TypeRole, Partial<TypeStyle>>>): Record<TypeRole, TypeStyle> {
  const out = {} as Record<TypeRole, TypeStyle>;
  (Object.keys(BASE_TYPE) as TypeRole[]).forEach((k) => {
    out[k] = { ...BASE_TYPE[k], ...(overrides[k] || {}), tracking: 0 };
  });
  return out;
}

export const THEMES: Record<BrandId, BrandTheme> = {
  corporate: {
    id: 'corporate',
    name: 'Vigo Importing Company',
    shortName: 'Corporate',
    description: 'Parent company. Restrained, institutional, editorial.',
    logo: { text: 'VIGO IMPORTING CO.', mark: 'VIC', tracking: 0.22, weight: 600, family: 'body' },
    fonts: {
      display: "'Fraunces', 'Iowan Old Style', Georgia, serif",
      body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    },
    colors: {
      brandPrimary: '#1C1F24',
      brandSecondary: '#4A5058',
      accent: '#8A7A5E',
      cream: '#F4F1EA',
      white: '#FFFFFF',
      black: '#0B0C0E',
      neutral: '#9AA0A8',
      brandYellow: '#FFE812',
      brandRed: '#E90000',
      terracotta: '#DF683F',
      paleCream: '#F7F7BF',
    },
    textColors: ['brandPrimary', 'brandSecondary', 'accent', 'white', 'black', 'neutral'],
    surfaceColors: ['brandPrimary', 'brandSecondary', 'accent', 'cream', 'white', 'black', 'neutral'],
    surface: { bg: 'cream', ink: 'brandPrimary', muted: 'rgba(28,31,36,0.62)' },
    onImageInk: 'white',
    type: typeFor({}),
    rule: { color: 'accent', weight: 3 },
  },

  vigo: {
    id: 'vigo',
    name: 'Vigo Foods',
    shortName: 'Vigo',
    description: 'Everyday, generous, confident. Sunborn display, Trade Gothic copy.',
    logo: {
      text: 'VIGO',
      mark: 'V',
      weight: 400,
      family: 'display',
      files: {
        primary: '/logos/vigo-primary.png',
        white: '/logos/vigo-white.png',
        black: '/logos/vigo-black.png',
        mark: '/logos/vigo-primary.png',
      },
      aspect: 2.5993,
      height: 62,
      minHeight: 34,
    },
    fonts: {
      // Sunborn Sans One is the primary display face. Second in the stack is an
      // upright cut derived from the supplied Slant file (its 15° shear removed)
      // — a stand-in that disappears the moment SunbornSansOne.otf is dropped
      // into public/fonts/. The slanted cut is never used.
      display:
        "'Sunborn Sans One', 'Sunborn Sans One Upright', 'Archivo', 'Helvetica Neue', Arial, sans-serif",
      body:
        "'TradeGothic Cond 18', 'Archivo Narrow', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    },
    colors: {
      brandPrimary: '#23262B',
      brandSecondary: '#565C64',
      accent: '#7E6A4F',
      cream: '#F6F3EC',
      white: '#FFFFFF',
      black: '#000000',
      neutral: '#A2A7AE',
      brandYellow: '#FFE812',
      brandRed: '#E90000',
      terracotta: '#DF683F',
      paleCream: '#F7F7BF',
    },
    // Vigo type uses these four and nothing else.
    textColors: ['brandYellow', 'white', 'black', 'brandRed'],
    surfaceColors: ['brandPrimary', 'cream', 'white', 'black', 'brandYellow', 'brandRed'],
    colorLabels: { brandYellow: 'Vigo Yellow', brandRed: 'Vigo Red' },
    surface: { bg: 'white', ink: 'black', muted: 'rgba(0,0,0,0.62)' },
    onImageInk: 'white',
    /**
     * Sunborn has a 900/1000 cap height — far taller than a normal face — so
     * every size set in it comes down about 22% to sit correctly against the
     * page. Weights are pinned to the weights that actually exist in the files
     * so no browser ever synthesises a fake bold.
     *
     * Per the brand: Sunborn for display, headline, subhead and metrics;
     * Trade Gothic Condensed No. 18 for body, captions and labels.
     */
    type: typeFor({
      display: { size: 104, weight: 400, lineHeight: 0.98 },
      headline: { size: 60, weight: 400, lineHeight: 1.06 },
      subhead: { size: 30, weight: 400, lineHeight: 1.22, family: 'display' },
      body: { size: 25, weight: 500, lineHeight: 1.5 },
      caption: { size: 17, weight: 500 },
      eyebrow: { weight: 500 },
      quote: { size: 44, weight: 400, lineHeight: 1.2 },
      metricXl: { size: 156, weight: 400, lineHeight: 0.9 },
      metricLarge: { size: 94, weight: 400, lineHeight: 0.92 },
      metricLabel: { size: 19, weight: 500 },
    }),
    rule: { color: 'accent', weight: 4 },
  },

  alessi: {
    id: 'alessi',
    name: 'Alessi Foods',
    shortName: 'Alessi',
    description: 'Premium Italian. Futura Extra Bold caps, generous spacing.',
    logo: {
      text: 'ALESSI',
      mark: 'A',
      tracking: 0.3,
      weight: 700,
      family: 'display',
      files: { primary: '/logos/alessi-primary.png' },
      aspect: 2.3426,
      // The badge carries the "Autentico" ribbon inside its bounds, so it needs
      // more height than a plain wordmark to stay legible.
      height: 102,
      minHeight: 58,
    },
    fonts: {
      display: "'Futura Extra Bold', 'Futura', 'Avenir Next', 'Century Gothic', sans-serif",
      body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    },
    colors: {
      brandPrimary: '#1A1815',
      brandSecondary: '#514B42',
      accent: '#9B8A6B',
      cream: '#F2EEE6',
      white: '#FFFFFF',
      black: '#000000',
      neutral: '#A69E90',
      brandYellow: '#FBEF77',
      brandRed: '#DF683F',
      terracotta: '#DF683F',
      paleCream: '#F7F7BF',
    },
    textColors: ['brandPrimary', 'brandSecondary', 'accent', 'white', 'black', 'neutral'],
    // Alessi page surfaces use these four and nothing else.
    surfaceColors: ['brandYellow', 'terracotta', 'paleCream', 'black'],
    colorLabels: {
      brandYellow: 'Alessi Yellow',
      terracotta: 'Terracotta',
      paleCream: 'Pale Cream',
      black: 'Black',
    },
    surface: { bg: 'cream', ink: 'brandPrimary', muted: 'rgba(26,24,21,0.6)' },
    onImageInk: 'white',
    /**
     * Futura Extra Bold, set in caps, for display / headline / subhead per the
     * brand. Its 754/1000 cap height plus all-caps setting means those sizes
     * come down from the base scale. Weight is pinned to 700 — the only weight
     * in the file — so nothing is ever synthetically bolded.
     *
     * Quote and the metric numerals use the same face without the caps
     * transform: caps quotes shout, and numerals have no case to change.
     */
    type: typeFor({
      display: { size: 112, weight: 700, lineHeight: 1.0, transform: 'uppercase' },
      headline: { size: 64, weight: 700, lineHeight: 1.08, transform: 'uppercase' },
      subhead: { size: 26, weight: 700, lineHeight: 1.24, family: 'display', transform: 'uppercase' },
      quote: { size: 40, weight: 700, lineHeight: 1.22 },
      metricXl: { size: 168, weight: 700 },
      metricLarge: { size: 100, weight: 700 },
    }),
    rule: { color: 'accent', weight: 2 },
  },
};

export const BRAND_ORDER: BrandId[] = ['corporate', 'vigo', 'alessi'];

export function getTheme(id: BrandId | undefined): BrandTheme {
  return THEMES[id || 'corporate'] || THEMES.corporate;
}

/** Colours the user is allowed to pick from, in the order they are shown. */
/** Colours offered for PAGE SURFACES. Type colours come from theme.textColors. */
export const SWATCH_ORDER: ColorRole[] = [
  'brandPrimary',
  'brandSecondary',
  'accent',
  'cream',
  'white',
  'black',
  'neutral',
];

/** Relative luminance / WCAG contrast — used by the readability guardrail. */
export function luminanceOf(hex: string): number {
  const h = (hex || '#000').replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const v = (i: number) => parseInt(n.slice(i, i + 2), 16) / 255;
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(v(0)) + 0.7152 * f(v(2)) + 0.0722 * f(v(4));
}

export function contrastRatio(a: string, b: string): number {
  const la = luminanceOf(a);
  const lb = luminanceOf(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export const COLOR_LABELS: Record<ColorRole, string> = {
  brandPrimary: 'Brand Primary',
  brandSecondary: 'Brand Secondary',
  accent: 'Accent',
  cream: 'Cream',
  white: 'White',
  black: 'Black',
  neutral: 'Neutral',
  brandYellow: 'Brand Yellow',
  brandRed: 'Brand Red',
  terracotta: 'Terracotta',
  paleCream: 'Pale Cream',
};

/** Brand-specific colour name, falling back to the shared label. */
export function colorLabel(theme: BrandTheme, role: ColorRole): string {
  return (theme.colorLabels && theme.colorLabels[role]) || COLOR_LABELS[role];
}

export const TYPE_LABELS: Record<TypeRole, string> = {
  display: 'Display',
  headline: 'Headline',
  subhead: 'Subhead',
  body: 'Body',
  caption: 'Caption',
  eyebrow: 'Eyebrow',
  quote: 'Quote',
  metricXl: 'Metric XL',
  metricLarge: 'Metric Large',
  metricLabel: 'Metric Label',
};

/** Produces the CSS custom properties that drive every rendered page. */
export function themeVars(theme: BrandTheme): Record<string, string> {
  const vars: Record<string, string> = {
    '--font-display': theme.fonts.display,
    '--font-body': theme.fonts.body,
    '--c-muted': theme.surface.muted,
    '--rule-color': theme.colors[theme.rule.color],
    '--rule-weight': String(theme.rule.weight),
  };
  (Object.keys(theme.colors) as ColorRole[]).forEach((k) => {
    vars['--c-' + k] = theme.colors[k];
  });
  (Object.keys(theme.type) as TypeRole[]).forEach((k) => {
    const t = theme.type[k];
    vars['--t-' + k + '-size'] = String(t.size);
    vars['--t-' + k + '-weight'] = String(t.weight);
    vars['--t-' + k + '-lh'] = String(t.lineHeight);
    vars['--t-' + k + '-tracking'] = t.tracking + 'em';
    vars['--t-' + k + '-family'] = t.family === 'display' ? theme.fonts.display : theme.fonts.body;
    vars['--t-' + k + '-transform'] = t.transform || 'none';
  });
  vars['--page-bg'] = theme.colors[theme.surface.bg];
  vars['--page-ink'] = theme.colors[theme.surface.ink];
  return vars;
}
