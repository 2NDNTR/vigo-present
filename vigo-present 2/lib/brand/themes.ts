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
  | 'neutral';

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
  /** placeholder wordmark rendering until real logo files are supplied */
  logo: { text: string; mark: string; tracking: number; weight: number; family: 'display' | 'body' };
  fonts: { display: string; body: string };
  colors: Record<ColorRole, string>;
  /** default page surface + ink pairing */
  surface: { bg: ColorRole; ink: ColorRole; muted: string };
  /** ink used when a page has a full-bleed image behind it */
  onImageInk: ColorRole;
  type: Record<TypeRole, TypeStyle>;
  /** identity of the accent rule/underline used by section dividers */
  rule: { color: ColorRole; weight: number };
}

const BASE_TYPE: Record<TypeRole, TypeStyle> = {
  display: { size: 132, weight: 600, lineHeight: 0.94, tracking: -0.03, family: 'display' },
  headline: { size: 76, weight: 600, lineHeight: 1.02, tracking: -0.02, family: 'display' },
  subhead: { size: 34, weight: 400, lineHeight: 1.28, tracking: -0.01, family: 'body' },
  body: { size: 22, weight: 400, lineHeight: 1.55, tracking: 0, family: 'body' },
  caption: { size: 15, weight: 500, lineHeight: 1.4, tracking: 0.08, family: 'body', transform: 'uppercase' },
  eyebrow: { size: 15, weight: 600, lineHeight: 1.2, tracking: 0.18, family: 'body', transform: 'uppercase' },
  quote: { size: 52, weight: 400, lineHeight: 1.24, tracking: -0.02, family: 'display' },
  metricXl: { size: 200, weight: 600, lineHeight: 0.86, tracking: -0.045, family: 'display' },
  metricLarge: { size: 120, weight: 600, lineHeight: 0.88, tracking: -0.04, family: 'display' },
  metricLabel: { size: 17, weight: 600, lineHeight: 1.35, tracking: 0.14, family: 'body', transform: 'uppercase' },
};

function typeFor(overrides: Partial<Record<TypeRole, Partial<TypeStyle>>>): Record<TypeRole, TypeStyle> {
  const out = {} as Record<TypeRole, TypeStyle>;
  (Object.keys(BASE_TYPE) as TypeRole[]).forEach((k) => {
    out[k] = { ...BASE_TYPE[k], ...(overrides[k] || {}) };
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
    },
    surface: { bg: 'cream', ink: 'brandPrimary', muted: 'rgba(28,31,36,0.62)' },
    onImageInk: 'white',
    type: typeFor({}),
    rule: { color: 'accent', weight: 3 },
  },

  vigo: {
    id: 'vigo',
    name: 'Vigo Foods',
    shortName: 'Vigo',
    description: 'Everyday, generous, confident. Bold type, food-forward imagery.',
    logo: { text: 'VIGO', mark: 'V', tracking: 0.08, weight: 700, family: 'body' },
    fonts: {
      display: "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    },
    colors: {
      brandPrimary: '#23262B',
      brandSecondary: '#565C64',
      accent: '#7E6A4F',
      cream: '#F6F3EC',
      white: '#FFFFFF',
      black: '#0B0C0E',
      neutral: '#A2A7AE',
    },
    surface: { bg: 'white', ink: 'brandPrimary', muted: 'rgba(35,38,43,0.62)' },
    onImageInk: 'white',
    type: typeFor({
      display: { weight: 700, tracking: -0.035 },
      headline: { weight: 700, tracking: -0.025 },
      metricXl: { weight: 700 },
      metricLarge: { weight: 700 },
      quote: { weight: 600, tracking: -0.025 },
    }),
    rule: { color: 'accent', weight: 4 },
  },

  alessi: {
    id: 'alessi',
    name: 'Alessi Foods',
    shortName: 'Alessi',
    description: 'Premium Italian. Elegant serif display, quiet luxury spacing.',
    logo: { text: 'ALESSI', mark: 'A', tracking: 0.3, weight: 500, family: 'display' },
    fonts: {
      display: "'Cormorant Garamond', 'Iowan Old Style', Georgia, serif",
      body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    },
    colors: {
      brandPrimary: '#1A1815',
      brandSecondary: '#514B42',
      accent: '#9B8A6B',
      cream: '#F2EEE6',
      white: '#FFFFFF',
      black: '#0A0908',
      neutral: '#A69E90',
    },
    surface: { bg: 'cream', ink: 'brandPrimary', muted: 'rgba(26,24,21,0.6)' },
    onImageInk: 'white',
    type: typeFor({
      display: { size: 148, weight: 500, tracking: -0.02, lineHeight: 0.92 },
      headline: { size: 84, weight: 500, tracking: -0.015 },
      quote: { size: 58, weight: 400 },
      metricXl: { size: 210, weight: 500, tracking: -0.03 },
      metricLarge: { size: 126, weight: 500, tracking: -0.03 },
      eyebrow: { tracking: 0.24 },
    }),
    rule: { color: 'accent', weight: 2 },
  },
};

export const BRAND_ORDER: BrandId[] = ['corporate', 'vigo', 'alessi'];

export function getTheme(id: BrandId | undefined): BrandTheme {
  return THEMES[id || 'corporate'] || THEMES.corporate;
}

/** Colours the user is allowed to pick from, in the order they are shown. */
export const SWATCH_ORDER: ColorRole[] = [
  'brandPrimary',
  'brandSecondary',
  'accent',
  'cream',
  'white',
  'black',
  'neutral',
];

export const COLOR_LABELS: Record<ColorRole, string> = {
  brandPrimary: 'Brand Primary',
  brandSecondary: 'Brand Secondary',
  accent: 'Accent',
  cream: 'Cream',
  white: 'White',
  black: 'Black',
  neutral: 'Neutral',
};

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
