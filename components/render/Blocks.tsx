'use client';

import React from 'react';
import type { Block } from '@/lib/model/types';
import type { BrandTheme, TypeRole } from '@/lib/brand/themes';
import { typeVars, u } from './typeVars';
import EditableText from './EditableText';
import { mediaUrl } from '@/lib/assets/registry';

export interface RenderCtx {
  theme: BrandTheme;
  editable?: boolean;
  selectedId?: string;
  onSelect?: (blockId: string) => void;
  onChange?: (blockId: string, patch: Partial<Block>) => void;
  /** number of sibling blocks in a horizontal slot — used for auto-sizing */
  siblings?: number;
  /** true when this block is the only one on the page — the Single Metric case */
  solo?: boolean;
  /** true when this page's surface is dark — drives the automatic logo variant */
  onDark?: boolean;
  /** true when rendering the running page-corner mark rather than a placed logo */
  chrome?: boolean;
}

const colorFor = (b: Block) =>
  !b.style?.color || b.style.color === 'auto' ? 'currentColor' : `var(--c-${b.style.color})`;

const alignFor = (b: Block) => (b.style?.align === 'center' ? 'center' : 'left');

/**
 * Metrics in a row share the width, so each one steps down as the count goes
 * up. These figures sit alongside headlines and images, so the role size is
 * the ceiling — the Single Metric page is the only place a number is allowed
 * to grow past it (see the solo note below).
 */
function metricScale(role: TypeRole, siblings: number, value: string): number {
  let s = 1;
  if (siblings >= 4) s = 0.62;
  else if (siblings === 3) s = 0.8;
  else if (siblings === 2) s = 0.92;
  const len = (value || '').length;
  if (len > 9) s *= 0.62;
  else if (len > 6) s *= 0.78;
  return s;
}

/**
 * THE SINGLE METRIC PAGE
 * ---------------------------------------------------------------------------
 * When a metric is the only block on the page it IS the page, so it is set to
 * fill rather than to a fixed role size — "38%" and "$1,250,000" both run to
 * the same measure instead of one filling the spread and the other floating in
 * the middle of it.
 *
 * The fitting is done by measurement in EditableText, not by arithmetic here.
 * An earlier version estimated glyph widths at 0.62em, which held for Vigo and
 * hung Alessi's wider display face off both edges of the page.
 *
 * Deliberately scoped to a solo block. Every other metric shares its page with
 * a headline, an image or its siblings, and growing those is what pushed three
 * figures into each other on the Sales Growth page.
 */
const SOLO_MAX = 430; // ceiling on the figure's set size, in design units

/** Long copy is nudged down a little — then the guardrail asks for fewer words. */
function textScale(role: TypeRole, text: string): number {
  const len = (text || '').length;
  if (role === 'display') return len > 90 ? 0.62 : len > 55 ? 0.78 : 1;
  if (role === 'headline') return len > 130 ? 0.7 : len > 80 ? 0.85 : 1;
  if (role === 'quote') return len > 170 ? 0.72 : len > 110 ? 0.86 : 1;
  return 1;
}

export default function BlockView({ block, ctx }: { block: Block; ctx: RenderCtx }) {
  const set = (patch: Partial<Block>) => ctx.onChange && ctx.onChange(block.id, patch);
  const selected = ctx.selectedId === block.id;
  const wrapProps = {
    className: 'blockwrap' + (selected ? ' selected' : ''),
    onMouseDown: ctx.editable ? () => ctx.onSelect && ctx.onSelect(block.id) : undefined,
    style: { color: colorFor(block), width: '100%' } as React.CSSProperties,
  };

  switch (block.type) {
    /* --------------------------------------------------------------- text */
    case 'text': {
      const role = (block.style?.role || 'body') as TypeRole;
      return (
        <div {...wrapProps}>
          <EditableText
            className="tt"
            style={{ ...typeVars(role, textScale(role, block.text || '')), textAlign: alignFor(block) }}
            value={block.text || ''}
            editable={ctx.editable}
            placeholder="Enter your text"
            onChange={(v) => set({ text: v })}
          />
        </div>
      );
    }

    /* ------------------------------------------------------------- metric */
    case 'metric': {
      const role = (block.style?.role || 'metricLarge') as TypeRole;
      const solo = !!ctx.solo;
      const scale = solo ? 1 : metricScale(role, ctx.siblings || 1, block.value || '');
      const growTo = solo
        ? Math.max(1, SOLO_MAX / (ctx.theme.type[role]?.size || SOLO_MAX))
        : undefined;
      const center = alignFor(block) === 'center';
      return (
        <div {...wrapProps}>
          <div className="metric" style={{ alignItems: center ? 'center' : 'flex-start', textAlign: center ? 'center' : 'left' }}>
            <div className="mv">
              <EditableText
                className="tt"
                style={typeVars(role, scale)}
                growTo={growTo}
                value={block.value || ''}
                editable={ctx.editable}
                placeholder="0%"
                onChange={(v) => set({ value: v })}
              />
              {block.trend && block.trend !== 'none' ? (
                <span className="trend">{block.trend === 'up' ? '▲' : '▼'}</span>
              ) : null}
            </div>
            <EditableText
              className="tt mlabel"
              style={{ ...typeVars('metricLabel'), textAlign: center ? 'center' : 'left' }}
              value={block.label || ''}
              editable={ctx.editable}
              placeholder="What this measures"
              onChange={(v) => set({ label: v })}
            />
            {block.support || (ctx.editable && selected) ? (
              <EditableText
                className="tt msupport"
                style={{ ...typeVars('body', 0.95), textAlign: center ? 'center' : 'left' }}
                value={block.support || ''}
                editable={ctx.editable}
                placeholder="Optional context"
                onChange={(v) => set({ support: v })}
              />
            ) : null}
          </div>
        </div>
      );
    }

    /* -------------------------------------------------------------- media */
    case 'image':
    case 'video': {
      const m = block.media;
      const resolved = mediaUrl(m);
      const has = !!resolved;
      if (!has) {
        return (
          <div {...wrapProps} style={{ ...wrapProps.style, height: '100%' }}>
            <div className="ph">Drop {block.type === 'video' ? 'a video' : 'an image'} here<br />or pick one from Assets</div>
          </div>
        );
      }
      const objectPosition = `${Math.round((m.focalX ?? 0.5) * 100)}% ${Math.round((m.focalY ?? 0.5) * 100)}%`;
      const transform = m.zoom && m.zoom !== 1 ? `scale(${m.zoom})` : undefined;
      return (
        <div {...wrapProps} style={{ ...wrapProps.style, height: '100%' }}>
          <div className="media-el">
            {block.type === 'video' ? (
              <video
                src={resolved}
                poster={m.poster}
                autoPlay={m.autoplay !== false}
                loop={m.loop !== false}
                muted={m.muted !== false}
                controls={!!m.controls}
                playsInline
                style={{ objectPosition, transform }}
              />
            ) : (
              <img src={resolved} alt={m.alt || ''} style={{ objectPosition, transform }} />
            )}
          </div>
        </div>
      );
    }

    /* --------------------------------------------------------------- logo */
    case 'logo': {
      const t = ctx.theme;
      const chosen = block.variant || 'auto';
      // 'auto' keeps the mark legible: the knockout on dark surfaces and
      // photography, the full-colour artwork on light ones.
      const variant =
        chosen === 'auto' ? (ctx.onDark ? 'white' : 'primary') : chosen;

      // Real artwork, when the brand has supplied it. Height is fixed by the
      // theme and width follows the artwork's own aspect ratio, so the logo can
      // never be stretched, squashed or recoloured.
      const file = t.logo.files?.[variant] || t.logo.files?.primary;
      if (file) {
        // The corner mark is page furniture, not a title-card logo: it runs at
        // the brand's chromeHeight so it never competes with the page's own
        // content. A placed logo — a cover, say — keeps its full size.
        const base = ctx.chrome ? t.logo.chromeHeight || 44 : t.logo.height || 56;
        const h = ctx.chrome ? base : Math.max(base, t.logo.minHeight || 0);
        return (
          <div {...wrapProps} style={{ ...wrapProps.style, width: 'auto' }}>
            <img
              className="logo-img"
              src={file}
              alt={t.name}
              style={{ height: u(h), width: u(h * (t.logo.aspect || 1)) }}
            />
          </div>
        );
      }

      const variantColor =
        variant === 'white' ? '#fff' : variant === 'black' ? '#000' : 'currentColor';
      if (variant === 'mark') {
        return (
          <div {...wrapProps} style={{ ...wrapProps.style, width: 'auto' }}>
            <span className="logo-el" style={{ color: variantColor }}>
              <span className="lm" style={{ background: 'currentColor', color: 'var(--page-bg)' }}>
                {t.logo.mark}
              </span>
            </span>
          </div>
        );
      }
      return (
        <div {...wrapProps} style={{ ...wrapProps.style, width: 'auto' }}>
          <span
            className="logo-el"
            style={
              {
                color: variantColor,
                ['--logo-family' as any]: t.logo.family === 'display' ? 'var(--font-display)' : 'var(--font-body)',
                ['--logo-weight' as any]: String(t.logo.weight),
                ['--logo-tracking' as any]: t.logo.tracking + 'em',
              } as React.CSSProperties
            }
          >
            <span className="lt">{t.logo.text}</span>
          </span>
        </div>
      );
    }

    /* -------------------------------------------------------------- quote */
    case 'quote': {
      const role = (block.style?.role || 'quote') as TypeRole;
      return (
        <div {...wrapProps}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: u(28) }}>
            <div
              className="tt"
              style={{ ...typeVars(role, 1.4), color: 'var(--rule-color)', lineHeight: 0.6, height: u(46) }}
              aria-hidden
            >
              &ldquo;
            </div>
            <EditableText
              className="tt"
              style={{ ...typeVars(role, textScale('quote', block.text || '')), textAlign: alignFor(block) }}
              value={block.text || ''}
              editable={ctx.editable}
              placeholder="Add a quote"
              onChange={(v) => set({ text: v })}
            />
            <EditableText
              className="tt"
              style={{ ...typeVars('caption'), opacity: 0.65, textAlign: alignFor(block) }}
              value={block.label || ''}
              editable={ctx.editable}
              placeholder="Who said it"
              onChange={(v) => set({ label: v })}
            />
          </div>
        </div>
      );
    }

    /* ---------------------------------------------------------- checklist */
    case 'checklist':
    case 'bullets': {
      const items = block.items || [];
      const role = (block.style?.role || 'subhead') as TypeRole;
      const upd = (i: number, v: string) => {
        const next = [...items];
        next[i] = v;
        set({ items: next });
      };
      return (
        <div {...wrapProps}>
          <div className="checklist">
            {items.map((it, i) => (
              <div className={block.type === 'checklist' ? 'checkrow' : 'bulletrow'} key={i}>
                {block.type === 'checklist' ? <span className="ck">✓</span> : <span className="bd" />}
                <EditableText
                  className="tt"
                  style={{ ...typeVars(role), flex: 1 }}
                  value={it}
                  editable={ctx.editable}
                  placeholder="Add a point"
                  onChange={(v) => upd(i, v)}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    /* ----------------------------------------------------------- timeline */
    /* -------------------------------------------------------------- table */
    case 'table': {
      const t = block.table;
      if (!t || !t.headers.length) {
        return (
          <div {...wrapProps}>
            <div className="ph" style={{ minHeight: 0 }}>Upload a spreadsheet from the Add panel</div>
          </div>
        );
      }
      // Numeric columns are right-aligned with tabular figures so the digits
      // line up in columns — the single thing that makes a table of numbers
      // scannable rather than a wall of text.
      const numeric = (i: number) => {
        const k = t.types?.[i];
        return k === 'number' || k === 'currency' || k === 'percent';
      };
      const cls = (i: number) => 'td' + (numeric(i) ? ' num' : '');
      const scale = t.headers.length >= 7 ? 0.78 : t.headers.length >= 5 ? 0.88 : 1;
      return (
        <div {...wrapProps} style={{ ...wrapProps.style, width: '100%' }}>
          <div className="dtable" style={typeVars('body', scale)}>
            <div className="dt-row dt-head" style={{ gridTemplateColumns: `repeat(${t.headers.length}, minmax(0,1fr))` }}>
              {t.headers.map((h, i) => (
                <div key={i} className={cls(i) + ' th'}>{h}</div>
              ))}
            </div>
            {t.rows.map((r, ri) => (
              <div key={ri} className="dt-row" style={{ gridTemplateColumns: `repeat(${t.headers.length}, minmax(0,1fr))` }}>
                {r.map((c, i) => (
                  <div key={i} className={cls(i)}>{c}</div>
                ))}
              </div>
            ))}
            {t.total ? (
              <div className="dt-row dt-total" style={{ gridTemplateColumns: `repeat(${t.headers.length}, minmax(0,1fr))` }}>
                {t.total.map((c, i) => (
                  <div key={i} className={cls(i)}>{c}</div>
                ))}
              </div>
            ) : null}
          </div>
          {t.source ? <div className="dt-source">{t.source}</div> : null}
        </div>
      );
    }

    case 'timeline': {
      const items = block.items || [];
      const upd = (i: number, v: string) => {
        const next = [...items];
        next[i] = v;
        set({ items: next });
      };
      return (
        <div {...wrapProps}>
          <div className="tl">
            {items.map((it, i) => (
              <div className="tl-item" key={i}>
                <EditableText
                  className="tt"
                  style={typeVars('body', 0.92)}
                  value={it}
                  editable={ctx.editable}
                  placeholder="Milestone"
                  onChange={(v) => upd(i, v)}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    /* ---------------------------------------------------------- logo grid */
    case 'logoGrid': {
      const items = block.items || [];
      const upd = (i: number, v: string) => {
        const next = [...items];
        next[i] = v;
        set({ items: next });
      };
      return (
        <div {...wrapProps}>
          <div className="logogrid" style={{ gridTemplateColumns: `repeat(${block.columns || 4}, 1fr)` }}>
            {items.map((it, i) => (
              <div className="logocell" key={i}>
                <EditableText
                  className="tt"
                  style={{ ...typeVars('caption'), textAlign: 'center', width: '100%' }}
                  value={it}
                  editable={ctx.editable}
                  placeholder="Account"
                  onChange={(v) => upd(i, v)}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    /* --------------------------------------------------------------- card */
    case 'card': {
      const n = ctx.siblings || 1;
      const cardScale = n >= 4 ? 0.72 : n === 3 ? 0.84 : n === 2 ? 0.94 : 1;
      const role = (block.style?.role || 'subhead') as TypeRole;
      const showImage = block.showImage !== false;
      const hasPrice = !!(block.wholesale || block.msrp) || (ctx.editable && selected);
      return (
        <div {...wrapProps} style={{ ...wrapProps.style, height: '100%' }}>
          <div className="card-el">
            {showImage ? (
              <div className="cimg">
                {mediaUrl(block.media) ? (
                  <img
                    src={mediaUrl(block.media)}
                    alt={block.media.alt || ''}
                    style={{
                      objectPosition: `${Math.round((block.media.focalX ?? 0.5) * 100)}% ${Math.round((block.media.focalY ?? 0.5) * 100)}%`,
                    }}
                  />
                ) : (
                  <div className="ph" style={{ minHeight: 0 }}>Drop an image</div>
                )}
              </div>
            ) : null}

            <div className="card-body">
              <EditableText
                className="tt"
                style={{ ...typeVars(role, cardScale), textAlign: alignFor(block) }}
                value={block.text || ''}
                editable={ctx.editable}
                placeholder="Product or card name"
                onChange={(v) => set({ text: v })}
              />
              <EditableText
                className="tt"
                style={{ ...typeVars('body', 0.86 * cardScale), opacity: 0.78, textAlign: alignFor(block) }}
                value={block.support || ''}
                editable={ctx.editable}
                placeholder="A sentence of supporting copy"
                onChange={(v) => set({ support: v })}
              />
            </div>

            {hasPrice ? (
              <div className="price-row">
                {block.wholesale || (ctx.editable && selected) ? (
                  <div className="price">
                    <span className="tt" style={{ ...typeVars('caption', 0.86), opacity: 0.55 }}>
                      Wholesale
                    </span>
                    <EditableText
                      className="tt"
                      style={typeVars('body', 0.95 * cardScale)}
                      value={block.wholesale || ''}
                      editable={ctx.editable}
                      placeholder="$0.00"
                      onChange={(v) => set({ wholesale: v })}
                    />
                  </div>
                ) : null}
                {block.msrp || (ctx.editable && selected) ? (
                  <div className="price">
                    <span className="tt" style={{ ...typeVars('caption', 0.86), opacity: 0.55 }}>
                      MSRP
                    </span>
                    <EditableText
                      className="tt"
                      style={typeVars('body', 0.95 * cardScale)}
                      value={block.msrp || ''}
                      editable={ctx.editable}
                      placeholder="$0.00"
                      onChange={(v) => set({ msrp: v })}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    /* ------------------------------------------------------------ divider */
    case 'divider':
      return (
        <div {...wrapProps}>
          <div className="rule-el" />
        </div>
      );

    /* ---------------------------------------------------------------- cta */
    case 'cta':
      return (
        <div {...wrapProps}>
          <span
            style={{
              display: 'inline-block',
              border: `${u(2)} solid currentColor`,
              borderRadius: u(999),
              padding: `${u(16)} ${u(34)}`,
            }}
          >
            <EditableText
              className="tt"
              style={typeVars('caption')}
              value={block.text || ''}
              editable={ctx.editable}
              placeholder="Call to action"
              onChange={(v) => set({ text: v })}
            />
          </span>
        </div>
      );

    default:
      return null;
  }
}
