'use client';

import React, { CSSProperties, useEffect, useRef, useState } from 'react';
import type { Block, Page } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';
import { getTheme, themeVars } from '@/lib/brand/themes';
import { getTemplate } from '@/lib/templates/registry';
import BlockView from './Blocks';
import { mediaUrl, useAssetRegistry } from '@/lib/assets/registry';

const REF_FIXED = 1600;
const REF_STACKED = 920;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(el.getBoundingClientRect().width);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export interface StageProps {
  page: Page;
  brand: BrandId;
  mode?: 'fixed' | 'fill' | 'stacked';
  editable?: boolean;
  selectedId?: string;
  activeSlot?: string;
  onSelectBlock?: (blockId: string, slotKey: string) => void;
  onSelectSlot?: (slotKey: string) => void;
  onChangeBlock?: (blockId: string, patch: Partial<Block>) => void;
  onDropOnSlot?: (slotKey: string, e: React.DragEvent) => void;
  onChangePage?: (patch: Partial<Page>) => void;
  onReorderBlocks?: (slotKey: string, from: number, to: number) => void;
  className?: string;
  style?: CSSProperties;
}

export default function Stage(props: StageProps) {
  const { page, brand, mode = 'fixed', editable } = props;
  const [ref, w] = useWidth<HTMLDivElement>();
  const [dropSlot, setDropSlot] = useState<string | null>(null);
  const [dragBlock, setDragBlock] = useState<{ slot: string; index: number } | null>(null);
  useAssetRegistry();

  const theme = getTheme(page.brandOverride || brand);
  const template = getTemplate(page.templateId);
  const bg = page.background || { kind: 'theme', overlay: 'none' };

  // ---- resolve the page surface and the ink that sits on it
  let pageBg = theme.colors[theme.surface.bg];
  let pageInk = theme.colors[theme.surface.ink];
  const bgUrl = bg.kind === 'image' || bg.kind === 'video' ? mediaUrl(bg.media) : '';
  const hasMedia = !!bgUrl;

  if (bg.kind === 'color' && bg.color) {
    pageBg = theme.colors[bg.color];
    pageInk = luminance(pageBg) < 0.45 ? theme.colors.white : theme.colors.brandPrimary;
  } else if (bg.kind === 'image' || bg.kind === 'video') {
    pageBg = theme.colors.black;
    pageInk = bg.overlay === 'light' ? theme.colors.brandPrimary : theme.colors.white;
  }

  const unit = (mode === 'stacked' ? w / REF_STACKED : w / REF_FIXED) || 0.0001;
  const sizing =
    mode === 'fixed' ? { aspectRatio: '16 / 9' } : mode === 'fill' ? { height: '100%' } : {};

  const vars: CSSProperties = {
    ...(themeVars(theme) as CSSProperties),
    ['--u' as any]: String(unit),
    ['--page-bg' as any]: pageBg,
    ['--page-ink' as any]: pageInk,
    background: pageBg,
    color: pageInk,
  };

  const onDark = luminance(pageBg) < 0.5;

  const areas = template.layout.areas.map((a) => `"${a}"`).join(' ');

  // Optional page chrome: a running headline top-left, the brand logo top-right.
  // Available on every layout, off by default.
  const chromeOn = !!(page.headline !== undefined || page.showLogo);
  const chromePad = Math.max(template.layout.pad, 74);
  const CHROME_H = 92;

  return (
    <div
      ref={ref}
      className={'stage ' + (mode === 'stacked' ? 'stacked ' : '') + (props.className || '')}
      style={{ ...vars, ...sizing, ...(props.style || {}) }}
    >
      {/* background layer */}
      {hasMedia ? (
        <div className="stage-bg">
          {bg.kind === 'video' ? (
            <video
              src={bgUrl}
              autoPlay={bg.media.autoplay !== false}
              loop={bg.media.loop !== false}
              muted
              playsInline
              style={{
                objectPosition: `${Math.round((bg.media.focalX ?? 0.5) * 100)}% ${Math.round((bg.media.focalY ?? 0.5) * 100)}%`,
                transform: bg.media.zoom && bg.media.zoom !== 1 ? `scale(${bg.media.zoom})` : undefined,
              }}
            />
          ) : (
            <img
              src={bgUrl}
              alt=""
              style={{
                objectPosition: `${Math.round((bg.media.focalX ?? 0.5) * 100)}% ${Math.round((bg.media.focalY ?? 0.5) * 100)}%`,
                transform: bg.media.zoom && bg.media.zoom !== 1 ? `scale(${bg.media.zoom})` : undefined,
              }}
            />
          )}
        </div>
      ) : null}
      {hasMedia && bg.overlay && bg.overlay !== 'none' ? (
        <div className={'stage-ov ov-' + bg.overlay} />
      ) : null}

      {/* empty full-bleed hint */}
      {(bg.kind === 'image' || bg.kind === 'video') && !hasMedia && editable ? (
        <div
          className="stage-ov"
          style={{
            background:
              'repeating-linear-gradient(135deg, rgba(0,0,0,0.03) 0 14px, rgba(0,0,0,0.06) 14px 28px)',
          }}
        />
      ) : null}

      {chromeOn ? (
        <div
          className="page-chrome"
          style={{ padding: `calc(var(--u) * ${chromePad}px)`, height: `calc(var(--u) * ${chromePad + CHROME_H}px)` }}
        >
          {/* The eyebrow renders only when the page actually has one. Both it
              and the logo used to appear together because each merely turned
              the chrome band ON — so switching the logo on also produced an
              empty "ENTER YOUR TEXT" field nobody asked for. They are two
              independent toggles and now render independently; the band itself
              appears if either is on. */}
          {page.headline !== undefined ? (
            <BlockView
              block={{ id: page.id + '-hd', type: 'text', text: page.headline || '', style: { role: 'eyebrow', color: 'auto', align: 'left' } }}
              ctx={{
                theme,
                editable,
                onDark,
                onChange: (_id, patch) => props.onChangePage && props.onChangePage({ headline: patch.text }),
              }}
            />
          ) : null}
          {page.showLogo ? (
            <div className="page-chrome-logo">
              <BlockView block={{ id: page.id + '-lg', type: 'logo' }} ctx={{ theme, onDark, chrome: true }} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className="stage-grid"
        style={{
          gridTemplateColumns: template.layout.columns,
          gridTemplateRows: template.layout.rows,
          gridTemplateAreas: areas,
          // NOTE: all four sides are set as longhand on purpose. Mixing the
          // `padding` shorthand with a `paddingTop` longhand in one React style
          // object makes React clear the longhand when it is undefined, which
          // silently zeroed the top padding on every page without page chrome.
          paddingTop: `calc(var(--u) * ${chromeOn ? chromePad + CHROME_H : template.layout.pad}px)`,
          paddingRight: `calc(var(--u) * ${template.layout.pad}px)`,
          paddingBottom: `calc(var(--u) * ${template.layout.pad}px)`,
          paddingLeft: `calc(var(--u) * ${template.layout.pad}px)`,
          gap: `calc(var(--u) * ${template.layout.gap}px)`,
        }}
      >
        {template.slots.map((slot) => {
          const blocks = page.slots[slot.key] || [];
          const horizontal = slot.dir === 'h';
          // A square frame is centred on BOTH axes, and that has to be decided
          // here rather than in CSS: a square slot is also a bleed slot, and the
          // bleed branch below writes alignItems:'stretch' inline, which beats
          // any class rule and pins the frame to the left of its cell.
          const squareFrame = slot.frame === 'square';
          const style: CSSProperties = {
            gridArea: slot.key,
            justifyContent: squareFrame
              ? 'center'
              : slot.justify === 'center'
              ? 'center'
              : slot.justify === 'end'
              ? 'flex-end'
              : 'flex-start',
            // A framed product may be centred in its column or aligned to the
            // column's leading edge. Left-aligned, the shot lines up with the
            // name and specs beneath it and the composition reads as a spec
            // sheet; centred, it floats. Templates choose per slot.
            alignItems: squareFrame
              ? slot.items === 'start'
                ? 'flex-start'
                : 'center'
              : slot.bleed
              ? 'stretch'
              : slot.items === 'center'
              ? 'center'
              : slot.items === 'stretch'
              ? 'stretch'
              : 'flex-start',
            gap: `calc(var(--u) * ${slot.gap ?? 22}px)`,
            padding: (slot as any).pad ? `calc(var(--u) * ${(slot as any).pad}px)` : undefined,
            // Read by .slot.sq's padding rule.
            ...(squareFrame ? ({ ['--sqpad' as any]: String(slot.framePad ?? 102) } as CSSProperties) : {}),
          };
          if (slot.maxWidth) style.maxWidth = `calc(var(--u) * ${slot.maxWidth}px)`;
          const hasCards = blocks.some((b) => b.type === 'card');
          if (horizontal) {
            style.alignItems = hasCards ? 'stretch' : 'flex-end';
            style.justifyContent = 'space-between';
          }

          const empty = blocks.length === 0;

          return (
            <div
              key={slot.key}
              className={
                'slot' +
                (horizontal ? ' h' : '') +
                (slot.bleed ? ' bleed' : '') +
                (slot.frame === 'square' ? ' sq' : '') +
                (editable ? ' editable' : '') +
                (dropSlot === slot.key ? ' dropping' : '')
              }
              style={style}
              data-slot={slot.key}
              onMouseDown={editable ? () => props.onSelectSlot && props.onSelectSlot(slot.key) : undefined}
              onDragOver={
                editable
                  ? (e) => {
                      e.preventDefault();
                      setDropSlot(slot.key);
                    }
                  : undefined
              }
              onDragLeave={editable ? () => setDropSlot((s) => (s === slot.key ? null : s)) : undefined}
              onDrop={
                editable
                  ? (e) => {
                      e.preventDefault();
                      setDropSlot(null);
                      props.onDropOnSlot && props.onDropOnSlot(slot.key, e);
                    }
                  : undefined
              }
            >
              {empty && editable ? (
                <div className="ph" style={{ minHeight: `calc(var(--u) * 90px)` }}>
                  {slot.hint}
                </div>
              ) : null}
              {blocks.map((b, bi) => (
                <div
                  key={b.id}
                  className={'blockslot' + (dragBlock && dragBlock.slot === slot.key && dragBlock.index === bi ? ' dragging' : '')}
                  style={
                    horizontal
                      ? { flex: 1, minWidth: 0, ...(b.type === 'card' ? { alignSelf: 'stretch' } : {}) }
                      : slot.frame === 'square'
                      ? // Sizing is left entirely to .slot.sq .blockslot in CSS.
                        // The bleed branch below would force flex:1 + width:100%
                        // inline, and an inline style beats the class rule that
                        // has to keep this box square.
                        undefined
                      : slot.bleed
                      ? { flex: 1, minHeight: 0, width: '100%' }
                      : b.type === 'card'
                      ? { width: '100%', flex: 1, minHeight: 0 }
                      : { width: '100%' }
                  }
                  onDragOver={
                    editable && dragBlock && dragBlock.slot === slot.key
                      ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      : undefined
                  }
                  onDrop={
                    editable && dragBlock && dragBlock.slot === slot.key
                      ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (dragBlock.index !== bi && props.onReorderBlocks) {
                            props.onReorderBlocks(slot.key, dragBlock.index, bi);
                          }
                          setDragBlock(null);
                        }
                      : undefined
                  }
                >
                  {editable && blocks.length > 1 ? (
                    <span
                      className="grip"
                      title="Drag to reorder"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('application/x-vigo-block', b.id);
                        setDragBlock({ slot: slot.key, index: bi });
                      }}
                      onDragEnd={() => setDragBlock(null)}
                    >
                      ⠿
                    </span>
                  ) : null}
                  <BlockView
                    block={b}
                    ctx={{
                      theme,
                      editable,
                      onDark,
                      selectedId: props.selectedId,
                      siblings: Math.max(1, blocks.filter((x) => x.type === 'metric').length),
                      onSelect: (id) => props.onSelectBlock && props.onSelectBlock(id, slot.key),
                      onChange: props.onChangeBlock,
                    }}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
