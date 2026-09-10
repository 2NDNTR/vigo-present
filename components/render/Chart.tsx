'use client';

import type { ChartData } from '@/lib/model/types';
import type { BrandTheme } from '@/lib/brand/themes';

/**
 * CHARTS
 * ---------------------------------------------------------------------------
 * Drawn as SVG from the brand theme, never as an image and never by a chart
 * library. Two reasons, and both are the reason this product exists:
 *
 *   1. A pasted screenshot of someone else's chart carries someone else's
 *      typeface, someone else's blue, and someone else's resolution. Drawn
 *      here, a chart is Vigo's — change a theme token and every chart in every
 *      deck follows.
 *   2. It stays DATA. A screenshot cannot be re-sorted, re-scaled, corrected
 *      when a number turns out to be wrong, or read out by a screen reader.
 *
 * Sizing is in the same design units as the rest of the stage, so a chart is
 * resolution-independent for the same reason type is: the SVG has a viewBox
 * in reference pixels and is stretched by the stage's own scale factor.
 *
 * The delta is never colour alone — it always carries its sign, because
 * roughly one man in twelve cannot separate the two colours, and a buyer
 * squinting at a projector is not going to ask which bar was the red one.
 */

const W = 1000; // reference width; the stage scales it

export function formatValue(v: number, unit?: ChartData['unit']): string {
  if (unit === 'percent') return (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '') + '%';
  const abs = Math.abs(v);
  const money = unit === 'currency' ? '$' : '';
  if (abs >= 1_000_000_000) return money + (v / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (abs >= 1_000_000) return money + (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (abs >= 1_000) return money + Math.round(v / 1000) + 'K';
  return money + String(Math.round(v * 10) / 10);
}

export function formatDelta(d: number): string {
  const s = (Math.round(Math.abs(d) * 10) / 10).toFixed(1).replace(/\.0$/, '');
  return (d > 0 ? '+' : d < 0 ? '−' : '') + s + '%';
}

interface Props {
  data: ChartData;
  theme: BrandTheme;
  onDark: boolean;
}

export default function Chart({ data, theme, onDark }: Props) {
  const kind = data.kind || 'bar';
  if (!data.categories?.length || !data.values?.length) {
    return <div className="ph">Add chart data, or build the page from a screenshot</div>;
  }
  if (kind === 'donut') return <Donut data={data} theme={theme} onDark={onDark} />;
  return <Bars data={data} theme={theme} onDark={onDark} column={kind === 'column'} />;
}

/* ------------------------------------------------------------------ colours */

function palette(theme: BrandTheme, onDark: boolean) {
  const ink = onDark ? '#ffffff' : theme.colors[theme.surface.ink] || '#111111';
  return {
    ink,
    accent: theme.colors.accent,
    neutral: onDark ? 'rgba(255,255,255,0.30)' : 'rgba(17,17,17,0.20)',
    rule: onDark ? 'rgba(255,255,255,0.16)' : 'rgba(17,17,17,0.14)',
    /* There is no green in this brand, and inventing one for a chart would be
     * the first unapproved colour in the system. So growth is set in the page's
     * own ink and decline in the accent — the sign carries the meaning, and
     * colour only emphasises the half worth arguing about. */
    up: ink,
    down: theme.colors.accent,
  };
}

/**
 * SLICE COLOURS
 * A share chart needs every slice told apart, and the legend beside it has to
 * agree — one function decides both, so they cannot drift. The ramp is built
 * from approved brand colours rather than from a generic chart palette, and
 * steps down in weight when it runs out of hues, which keeps ten slices
 * separable without inventing an eleventh brand colour.
 *
 * Ours is always the accent, wherever it lands in the order. An explicit
 * colour on the block wins over all of it.
 */
const RAMP_ROLES = ['brandPrimary', 'terracotta', 'brandYellow', 'brandSecondary', 'brandRed', 'neutral'] as const;

export function sliceColors(data: ChartData, theme: BrandTheme, onDark: boolean): string[] {
  const base = RAMP_ROLES.map((r) => theme.colors[r]).filter(Boolean) as string[];
  return data.categories.map((cat, i) => {
    const chosen = data.colors?.[i];
    if (chosen) return chosen;
    if (data.highlight && cat === data.highlight) return theme.colors.accent;
    const hue = base[i % base.length];
    const tier = Math.floor(i / base.length); // second time round, lighter
    if (!hue) return onDark ? 'rgba(255,255,255,0.35)' : 'rgba(17,17,17,0.3)';
    return tier === 0 ? hue : mix(hue, onDark ? '#000000' : '#ffffff', 0.34 * tier);
  });
}

/** blend two hex colours — used to extend the ramp without new brand colours */
function mix(a: string, b: string, t: number): string {
  const p = (h: string) => {
    const v = h.replace('#', '');
    const n = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  };
  try {
    const [r1, g1, b1] = p(a);
    const [r2, g2, b2] = p(b);
    const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
    return '#' + c(r1, r2) + c(g1, g2) + c(b1, b2);
  } catch {
    return a;
  }
}

/* --------------------------------------------------------------------- bars */

function Bars({
  data,
  theme,
  onDark,
  column,
}: Props & { column: boolean }) {
  const c = palette(theme, onDark);
  const fills = sliceColors(data, theme, onDark);
  const n = data.categories.length;
  const max = Math.max(...data.values.map((v) => Math.abs(v)), 1);
  const hasDelta = !!data.deltas?.some((d) => d !== null && d !== undefined);

  if (column) {
    /* Columns for a short series where the categories are periods or a handful
     * of brands — anything longer goes horizontal, where a name has room. */
    const gap = 26;
    const bw = (W - gap * (n - 1)) / n;
    const H = 420;
    const floor = H - (hasDelta ? 74 : 52);
    return (
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={chartLabel(data)}>
        <line x1={0} y1={floor} x2={W} y2={floor} stroke={c.rule} strokeWidth={1} />
        {data.categories.map((cat, i) => {
          const v = data.values[i] ?? 0;
          const h = (Math.abs(v) / max) * (floor - 46);
          const x = i * (bw + gap);
          const d = data.deltas?.[i];
          return (
            <g key={i}>
              <rect x={x} y={floor - h} width={bw} height={h} fill={fills[i]} />
              <text x={x + bw / 2} y={floor - h - 14} textAnchor="middle" className="ch-val" fill={c.ink}>
                {formatValue(v, data.unit)}
              </text>
              <text x={x + bw / 2} y={floor + 26} textAnchor="middle" className="ch-cat" fill={c.ink}>
                {cat}
              </text>
              {d !== null && d !== undefined ? (
                <text x={x + bw / 2} y={floor + 52} textAnchor="middle" className="ch-delta" fill={d >= 0 ? c.up : c.down}>
                  {formatDelta(d)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    );
  }

  /* Horizontal: the ranked list, which is how a brand dashboard is read. */
  const rowH = n > 8 ? 46 : n > 5 ? 56 : 66;
  const H = rowH * n + 10;
  const labelW = 260;
  const valueW = hasDelta ? 200 : 130;
  const trackW = W - labelW - valueW;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={chartLabel(data)}>
      {data.categories.map((cat, i) => {
        const v = data.values[i] ?? 0;
        const w = (Math.abs(v) / max) * trackW;
        const y = i * rowH;
        const mine = data.highlight && cat === data.highlight;
        const d = data.deltas?.[i];
        const barH = Math.min(26, rowH - 22);
        return (
          <g key={i}>
            <text x={0} y={y + rowH / 2 + 5} className={'ch-cat' + (mine ? ' mine' : '')} fill={c.ink}>
              {clip(cat, 26)}
            </text>
            <rect x={labelW} y={y + (rowH - barH) / 2} width={Math.max(2, w)} height={barH} fill={fills[i]} />
            <text x={labelW + Math.max(2, w) + 14} y={y + rowH / 2 + 5} className="ch-val" fill={c.ink}>
              {formatValue(v, data.unit)}
            </text>
            {d !== null && d !== undefined ? (
              <text x={W} y={y + rowH / 2 + 5} textAnchor="end" className="ch-delta" fill={d >= 0 ? c.up : c.down}>
                {formatDelta(d)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/* -------------------------------------------------------------------- donut */

function Donut({ data, theme, onDark }: Props) {
  const c = palette(theme, onDark);
  const total = data.values.reduce((a, b) => a + Math.abs(b), 0) || 1;
  const n = data.categories.length;
  /* Ten brands is a normal share chart in this category, and a legend of ten
   * at generous spacing runs off the slide. The rows tighten and the page
   * grows instead of the type shrinking to nothing. */
  const row = n > 7 ? 40 : n > 5 ? 46 : 52;
  const H = Math.max(420, n * row + 70);
  const cx = 210;
  const cy = H / 2;
  const r = Math.min(150, (H - 90) / 2);
  const ring = Math.max(30, r * 0.31);

  const fills = sliceColors(data, theme, onDark);
  let acc = 0;
  const arcs = data.categories.map((cat, i) => {
    const v = Math.abs(data.values[i] ?? 0);
    const frac = v / total;
    const a0 = acc * Math.PI * 2 - Math.PI / 2;
    acc += frac;
    const a1 = acc * Math.PI * 2 - Math.PI / 2;
    return { cat, v, frac, a0, a1, fill: fills[i] };
  });

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={chartLabel(data)}>
      {arcs.map((a, i) => (
        <path key={i} d={arc(cx, cy, r, ring, a.a0, a.a1)} fill={a.fill} />
      ))}
      {data.categories.map((cat, i) => {
        const y = cy - ((n - 1) * row) / 2 + i * row;
        const a = arcs[i];
        return (
          <g key={i}>
            <rect x={430} y={y - 14} width={16} height={16} fill={a.fill} />
            <text x={462} y={y} className="ch-cat" fill={c.ink}>{clip(cat, 30)}</text>
            <text x={W} y={y} textAnchor="end" className="ch-val" fill={c.ink}>
              {Math.round(a.frac * 100)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** an annulus sector, drawn the long way so it works without a stroke hack */
function arc(cx: number, cy: number, r: number, ring: number, a0: number, a1: number): string {
  const ri = r - ring;
  const big = a1 - a0 > Math.PI ? 1 : 0;
  const p = (rad: number, ang: number) => `${cx + rad * Math.cos(ang)} ${cy + rad * Math.sin(ang)}`;
  return [
    `M ${p(r, a0)}`,
    `A ${r} ${r} 0 ${big} 1 ${p(r, a1)}`,
    `L ${p(ri, a1)}`,
    `A ${ri} ${ri} 0 ${big} 0 ${p(ri, a0)}`,
    'Z',
  ].join(' ');
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function chartLabel(d: ChartData): string {
  return d.categories
    .map((c, i) => `${c}: ${formatValue(d.values[i] ?? 0, d.unit)}`)
    .join('; ');
}
