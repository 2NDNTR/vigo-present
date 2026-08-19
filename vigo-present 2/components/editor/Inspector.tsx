'use client';

import React, { useRef } from 'react';
import type { Block, MediaRef, Page, PageBackground, Presentation } from '@/lib/model/types';
import type { PageTemplate } from '@/lib/templates/registry';
import { TEMPLATES, getTemplate } from '@/lib/templates/registry';
import {
  BRAND_ORDER,
  COLOR_LABELS,
  SWATCH_ORDER,
  THEMES,
  TYPE_LABELS,
  getTheme,
} from '@/lib/brand/themes';
import type { ColorRole, TypeRole } from '@/lib/brand/themes';
import { pageGuardrails } from '@/lib/guardrails';
import { processFile } from '@/lib/media';

const ROLES_FOR: Record<string, TypeRole[]> = {
  text: ['display', 'headline', 'subhead', 'body', 'caption', 'eyebrow'],
  metric: ['metricXl', 'metricLarge'],
  quote: ['quote', 'headline'],
  checklist: ['subhead', 'body', 'headline'],
  bullets: ['subhead', 'body'],
  timeline: ['body', 'caption'],
  logoGrid: ['caption', 'body'],
  card: ['subhead', 'headline', 'body'],
  cta: ['caption', 'body'],
};

const OVERLAYS: { id: PageBackground['overlay']; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'gradientTop', label: 'Grad. top' },
  { id: 'scrim', label: 'Scrim' },
];

export interface InspectorProps {
  presentation: Presentation;
  page: Page;
  selected: { blockId: string; slotKey: string } | null;
  onChangeBlock: (id: string, patch: Partial<Block>) => void;
  onDeleteBlock: (id: string) => void;
  onChangePage: (patch: Partial<Page>) => void;
  onSwapTemplate: (templateId: string) => void;
}

export default function Inspector(props: InspectorProps) {
  const { presentation, page, selected } = props;
  const template = getTemplate(page.templateId);
  const theme = getTheme(page.brandOverride || presentation.brand);
  const block =
    selected && (page.slots[selected.slotKey] || []).find((b) => b.id === selected.blockId);
  const warnings = pageGuardrails(page, template);
  const fileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const patchStyle = (patch: any) =>
    block && props.onChangeBlock(block.id, { style: { ...(block.style || {}), ...patch } });

  const patchMedia = (patch: Partial<MediaRef>) =>
    block && props.onChangeBlock(block.id, { media: { ...(block.media || { url: '' }), ...patch } });

  const setBg = (patch: Partial<PageBackground>) =>
    props.onChangePage({ background: { ...(page.background || { kind: 'theme' }), ...patch } as PageBackground });

  return (
    <div>
      {warnings.length > 0 && (
        <div className="panel-sec" style={{ paddingTop: 0 }}>
          {warnings.slice(0, 3).map((w) => (
            <div className="warn" key={w.id} style={w.tone === 'info' ? { background: '#f4f6f8', borderColor: '#e0e5ea', color: '#5f6368' } : undefined}>
              <span>{w.tone === 'warn' ? '△' : 'ⓘ'}</span>
              <span>{w.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------- selected block */}
      {block ? (
        <>
          <div className="panel-sec" style={warnings.length ? undefined : { paddingTop: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 className="panel-h" style={{ margin: 0 }}>
                {block.type === 'text' ? 'Text' : block.type[0].toUpperCase() + block.type.slice(1)}
              </h4>
              <button className="btn ghost sm" onClick={() => props.onDeleteBlock(block.id)}>
                Remove
              </button>
            </div>

            {ROLES_FOR[block.type] && (
              <>
                <div className="label" style={{ marginBottom: 6 }}>Style</div>
                <div className="rolelist" style={{ marginBottom: 14 }}>
                  {ROLES_FOR[block.type].map((r) => (
                    <button
                      key={r}
                      className={'rolebtn' + ((block.style?.role || '') === r ? ' on' : '')}
                      onClick={() => patchStyle({ role: r })}
                    >
                      <span className="rn" style={{ fontFamily: theme.type[r].family === 'display' ? theme.fonts.display : theme.fonts.body }}>
                        {TYPE_LABELS[r]}
                      </span>
                      <span className="rs">{theme.type[r].size}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {block.type !== 'image' && block.type !== 'video' && block.type !== 'logo' && (
              <>
                <div className="label" style={{ marginBottom: 6 }}>Alignment</div>
                <div className="seg" style={{ marginBottom: 14 }}>
                  {(['left', 'center'] as const).map((a) => (
                    <button key={a} className={(block.style?.align || 'left') === a ? 'on' : ''} onClick={() => patchStyle({ align: a })}>
                      {a === 'left' ? 'Left' : 'Center'}
                    </button>
                  ))}
                </div>
              </>
            )}

            {block.type !== 'image' && block.type !== 'video' && (
              <>
                <div className="label" style={{ marginBottom: 6 }}>Colour</div>
                <div className="swatches">
                  <button
                    className={'swatch' + (!block.style?.color || block.style.color === 'auto' ? ' on' : '')}
                    onClick={() => patchStyle({ color: 'auto' })}
                    title="Automatic — always readable"
                    style={{ background: 'linear-gradient(135deg,#fff 0 50%,#17181a 50% 100%)' }}
                  />
                  {SWATCH_ORDER.map((c: ColorRole) => (
                    <button
                      key={c}
                      className={'swatch' + (block.style?.color === c ? ' on' : '')}
                      title={COLOR_LABELS[c]}
                      style={{ background: theme.colors[c] }}
                      onClick={() => patchStyle({ color: c })}
                    />
                  ))}
                </div>
              </>
            )}

            {(block.type === 'metric') && (
              <div style={{ marginTop: 14 }}>
                <div className="label" style={{ marginBottom: 6 }}>Trend indicator</div>
                <div className="seg">
                  {(['none', 'up', 'down'] as const).map((t) => (
                    <button key={t} className={(block.trend || 'none') === t ? 'on' : ''} onClick={() => props.onChangeBlock(block.id, { trend: t })}>
                      {t === 'none' ? 'None' : t === 'up' ? '▲ Up' : '▼ Down'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {block.type === 'card' && (
              <div style={{ marginTop: 14 }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const m = await processFile(f);
                    props.onChangeBlock(block.id, {
                      showImage: true,
                      media: { url: m.url, width: m.width, height: m.height, focalX: 0.5, focalY: 0.5, zoom: 1 },
                    });
                    e.target.value = '';
                  }}
                />
                <div className="label" style={{ marginBottom: 6 }}>Card image</div>
                <div className="seg" style={{ marginBottom: 8 }}>
                  <button className={block.showImage !== false ? 'on' : ''} onClick={() => props.onChangeBlock(block.id, { showImage: true })}>
                    Show
                  </button>
                  <button className={block.showImage === false ? 'on' : ''} onClick={() => props.onChangeBlock(block.id, { showImage: false })}>
                    Hide
                  </button>
                </div>
                {block.showImage !== false && (
                  <>
                    <button className="btn sm" style={{ marginBottom: 8 }} onClick={() => fileRef.current?.click()}>
                      {block.media?.url ? 'Replace image' : 'Upload image'}
                    </button>
                    {block.media?.url && (
                      <>
                        <Slider label="Horizontal" value={block.media.focalX ?? 0.5} onChange={(v) => patchMedia({ focalX: v })} />
                        <Slider label="Vertical" value={block.media.focalY ?? 0.5} onChange={(v) => patchMedia({ focalY: v })} />
                      </>
                    )}
                  </>
                )}

                <div className="label" style={{ margin: '14px 0 6px' }}>Pricing</div>
                <div className="seg" style={{ marginBottom: 8 }}>
                  <button
                    className={block.wholesale !== undefined || block.msrp !== undefined ? 'on' : ''}
                    onClick={() =>
                      props.onChangeBlock(block.id, {
                        wholesale: block.wholesale ?? '$0.00',
                        msrp: block.msrp ?? '$0.00',
                      })
                    }
                  >
                    Show
                  </button>
                  <button
                    className={block.wholesale === undefined && block.msrp === undefined ? 'on' : ''}
                    onClick={() => props.onChangeBlock(block.id, { wholesale: undefined, msrp: undefined })}
                  >
                    Hide
                  </button>
                </div>
                {(block.wholesale !== undefined || block.msrp !== undefined) && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div className="tiny" style={{ marginBottom: 4 }}>Wholesale</div>
                      <input
                        className="field"
                        style={{ height: 36 }}
                        value={block.wholesale ?? ''}
                        placeholder="$0.00"
                        onChange={(e) => props.onChangeBlock(block.id, { wholesale: e.target.value })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="tiny" style={{ marginBottom: 4 }}>MSRP</div>
                      <input
                        className="field"
                        style={{ height: 36 }}
                        value={block.msrp ?? ''}
                        placeholder="$0.00"
                        onChange={(e) => props.onChangeBlock(block.id, { msrp: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                <p className="tiny" style={{ marginTop: 8 }}>
                  Leave a price blank and it disappears from the card.
                </p>
              </div>
            )}

            {block.type === 'logoGrid' && (
              <div style={{ marginTop: 14 }}>
                <div className="label" style={{ marginBottom: 6 }}>Columns</div>
                <div className="seg">
                  {[3, 4, 5, 6].map((c) => (
                    <button key={c} className={(block.columns || 4) === c ? 'on' : ''} onClick={() => props.onChangeBlock(block.id, { columns: c })}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(block.type === 'checklist' || block.type === 'bullets' || block.type === 'timeline' || block.type === 'logoGrid') && (
              <div style={{ marginTop: 14 }}>
                <div className="label" style={{ marginBottom: 6 }}>Items</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn sm"
                    onClick={() => props.onChangeBlock(block.id, { items: [...(block.items || []), 'New item'] })}
                  >
                    + Add item
                  </button>
                  <button
                    className="btn sm"
                    disabled={(block.items || []).length <= 1}
                    onClick={() => props.onChangeBlock(block.id, { items: (block.items || []).slice(0, -1) })}
                  >
                    Remove last
                  </button>
                </div>
              </div>
            )}

            {block.type === 'logo' && (
              <div style={{ marginTop: 4 }}>
                <div className="label" style={{ marginBottom: 6 }}>Approved variant</div>
                <div className="seg">
                  {(['primary', 'white', 'black', 'mark'] as const).map((v) => (
                    <button key={v} className={(block.variant || 'primary') === v ? 'on' : ''} onClick={() => props.onChangeBlock(block.id, { variant: v })}>
                      {v === 'primary' ? 'Primary' : v === 'white' ? 'White' : v === 'black' ? 'Black' : 'Mark'}
                    </button>
                  ))}
                </div>
                <p className="tiny" style={{ marginTop: 8 }}>
                  Logos can&rsquo;t be recoloured, stretched or modified. Clear space and minimum size are handled for you.
                </p>
              </div>
            )}

            {(block.type === 'image' || block.type === 'video') && (
              <div style={{ marginTop: 4 }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const m = await processFile(f);
                    props.onChangeBlock(block.id, {
                      type: m.kind,
                      media: { url: m.url, width: m.width, height: m.height, focalX: 0.5, focalY: 0.5, zoom: 1 },
                    });
                    e.target.value = '';
                  }}
                />
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <button className="btn sm" onClick={() => fileRef.current?.click()}>
                    {block.media?.url ? 'Replace' : 'Upload'}
                  </button>
                  {block.media?.url && (
                    <button
                      className="btn sm"
                      onClick={() =>
                        setBg({
                          kind: block.type === 'video' ? 'video' : 'image',
                          media: { ...(block.media as MediaRef) },
                          overlay: 'gradient',
                        })
                      }
                    >
                      Set as full bleed
                    </button>
                  )}
                </div>
                {block.media?.url && (
                  <>
                    <Slider label="Horizontal" value={block.media.focalX ?? 0.5} onChange={(v) => patchMedia({ focalX: v })} />
                    <Slider label="Vertical" value={block.media.focalY ?? 0.5} onChange={(v) => patchMedia({ focalY: v })} />
                    <Slider label="Zoom" min={1} max={2} value={block.media.zoom ?? 1} onChange={(v) => patchMedia({ zoom: v })} />
                  </>
                )}
                {block.type === 'video' && block.media?.url && (
                  <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                    {(['autoplay', 'loop', 'muted', 'controls'] as const).map((k) => (
                      <label key={k} className="tiny" style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--app-ink-2)' }}>
                        <input
                          type="checkbox"
                          checked={!!block.media?.[k]}
                          onChange={(e) => patchMedia({ [k]: e.target.checked } as any)}
                        />
                        {k[0].toUpperCase() + k.slice(1)}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* ------------------------------------------------------ page level */}
      <div className="panel-sec" style={!block && !warnings.length ? { paddingTop: 0 } : undefined}>
        <h4 className="panel-h">Page</h4>

        <div className="label" style={{ marginBottom: 6 }}>Layout</div>
        <select
          className="field"
          style={{ marginBottom: 14 }}
          value={page.templateId}
          onChange={(e) => props.onSwapTemplate(e.target.value)}
        >
          {TEMPLATES.map((t: PageTemplate) => (
            <option key={t.id} value={t.id}>
              {t.category} — {t.name}
            </option>
          ))}
        </select>

        <div className="label" style={{ marginBottom: 6 }}>Page headline</div>
        <div className="seg" style={{ marginBottom: 8 }}>
          <button
            className={page.headline !== undefined ? 'on' : ''}
            onClick={() => props.onChangePage({ headline: page.headline ?? 'Section headline' })}
          >
            On
          </button>
          <button className={page.headline === undefined ? 'on' : ''} onClick={() => props.onChangePage({ headline: undefined })}>
            Off
          </button>
        </div>
        {page.headline !== undefined && (
          <input
            className="field"
            style={{ marginBottom: 10 }}
            value={page.headline}
            placeholder="Headline for this page"
            onChange={(e) => props.onChangePage({ headline: e.target.value })}
          />
        )}

        <div className="label" style={{ marginBottom: 6 }}>Brand logo, top right</div>
        <div className="seg" style={{ marginBottom: 14 }}>
          <button className={page.showLogo ? 'on' : ''} onClick={() => props.onChangePage({ showLogo: true })}>
            Show
          </button>
          <button className={!page.showLogo ? 'on' : ''} onClick={() => props.onChangePage({ showLogo: false })}>
            Hide
          </button>
        </div>

        <div className="label" style={{ marginBottom: 6 }}>Background</div>
        <div className="seg" style={{ marginBottom: 10 }}>
          {(['theme', 'color', 'image', 'video'] as const).map((k) => (
            <button key={k} className={(page.background?.kind || 'theme') === k ? 'on' : ''} onClick={() => setBg({ kind: k })}>
              {k === 'theme' ? 'Default' : k === 'color' ? 'Colour' : k === 'image' ? 'Image' : 'Video'}
            </button>
          ))}
        </div>

        {page.background?.kind === 'color' && (
          <div className="swatches" style={{ marginBottom: 10 }}>
            {SWATCH_ORDER.map((c) => (
              <button
                key={c}
                title={COLOR_LABELS[c]}
                className={'swatch' + (page.background?.color === c ? ' on' : '')}
                style={{ background: theme.colors[c] }}
                onClick={() => setBg({ color: c })}
              />
            ))}
          </div>
        )}

        {(page.background?.kind === 'image' || page.background?.kind === 'video') && (
          <>
            <input
              ref={bgFileRef}
              type="file"
              accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const m = await processFile(f);
                setBg({ kind: m.kind, media: { url: m.url, width: m.width, height: m.height, focalX: 0.5, focalY: 0.5, zoom: 1 } });
                e.target.value = '';
              }}
            />
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const assetUrl = e.dataTransfer.getData('application/x-vigo-asset');
                if (assetUrl) {
                  setBg({ kind: 'image', media: { url: assetUrl, width: 1200, height: 800, focalX: 0.5, focalY: 0.5, zoom: 1 } });
                  return;
                }
                const f = e.dataTransfer.files?.[0];
                if (f) {
                  const m = await processFile(f);
                  setBg({ kind: m.kind, media: { url: m.url, width: m.width, height: m.height, focalX: 0.5, focalY: 0.5, zoom: 1 } });
                }
              }}
              onClick={() => bgFileRef.current?.click()}
              style={{
                border: '1px dashed var(--app-line)',
                borderRadius: 8,
                padding: 14,
                textAlign: 'center',
                fontSize: 12.5,
                color: 'var(--app-ink-2)',
                cursor: 'pointer',
                marginBottom: 10,
                backgroundImage: page.background?.media?.url && page.background.kind === 'image' ? `url(${page.background.media.url})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                minHeight: 64,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={page.background?.media?.url ? { background: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: 5 } : undefined}>
                {page.background?.media?.url ? 'Replace background' : 'Drop an image here, or click to upload'}
              </span>
            </div>

            <div className="label" style={{ marginBottom: 6 }}>Overlay</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {OVERLAYS.map((o) => (
                <button
                  key={o.id}
                  className={'chip' + ((page.background?.overlay || 'none') === o.id ? ' on' : '')}
                  style={{ height: 28, fontSize: 12 }}
                  onClick={() => setBg({ overlay: o.id })}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {page.background?.media?.url && (
              <>
                <Slider label="Horizontal" value={page.background.media.focalX ?? 0.5} onChange={(v) => setBg({ media: { ...page.background.media, focalX: v } })} />
                <Slider label="Vertical" value={page.background.media.focalY ?? 0.5} onChange={(v) => setBg({ media: { ...page.background.media, focalY: v } })} />
                <Slider label="Zoom" min={1} max={2} value={page.background.media.zoom ?? 1} onChange={(v) => setBg({ media: { ...page.background.media, zoom: v } })} />
              </>
            )}
          </>
        )}

        <div className="label" style={{ margin: '14px 0 6px' }}>Section name</div>
        <input
          className="field"
          placeholder="No section break"
          value={page.sectionStart || ''}
          onChange={(e) => props.onChangePage({ sectionStart: e.target.value || undefined })}
        />

        {presentation.brand === 'corporate' && (
          <>
            <div className="label" style={{ margin: '14px 0 6px' }}>Brand for this page</div>
            <div className="seg">
              <button className={!page.brandOverride ? 'on' : ''} onClick={() => props.onChangePage({ brandOverride: undefined })}>
                Corporate
              </button>
              {BRAND_ORDER.filter((b) => b !== 'corporate').map((b) => (
                <button key={b} className={page.brandOverride === b ? 'on' : ''} onClick={() => props.onChangePage({ brandOverride: b })}>
                  {THEMES[b].shortName}
                </button>
              ))}
            </div>
            <p className="tiny" style={{ marginTop: 8 }}>
              Multi-brand decks can switch approved styling page by page.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="tiny" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span className="mono-num">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}
