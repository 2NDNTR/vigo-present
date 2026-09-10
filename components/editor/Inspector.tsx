'use client';

import React, { useRef, useState } from 'react';
import type { Block, MediaRef, Page, PageBackground, Presentation } from '@/lib/model/types';
import { RETAILERS, retailerDef } from '@/lib/brand/retailers';
import type { PageTemplate } from '@/lib/templates/registry';
import { TEMPLATES, getTemplate } from '@/lib/templates/registry';
import Select from '@/components/ui/Select';
import {
  BRAND_ORDER,
  COLOR_LABELS,
  THEMES,
  TYPE_LABELS,
  colorLabel,
  getTheme,
} from '@/lib/brand/themes';
import type { ColorRole, TypeRole } from '@/lib/brand/themes';
import { processFile } from '@/lib/media';
import { EMPTY_ENTRY, entriesOf, entriesPatch, showsMedia } from '@/lib/model/timeline';
import { EMPTY_LOGO, logosOf, logosPatch } from '@/lib/model/logos';

const ROLES_FOR: Record<string, TypeRole[]> = {
  text: ['display', 'headline', 'subhead', 'body', 'caption', 'eyebrow'],
  metric: ['metricXl', 'metricLarge'],
  quote: ['quote', 'headline'],
  checklist: ['subhead', 'body', 'headline'],
  bullets: ['subhead', 'body'],
  timeline: ['body', 'caption'],  // the caption; the date is always the metric face
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
  /** deck-level edits — the retailer is a property of the whole deck */
  onChangeDeck?: (patch: Partial<Presentation>) => void;
  /** insert a page composed elsewhere — the screenshot reader returns one */
  onInsertPage?: (page: Page) => void;
}

export default function Inspector(props: InspectorProps) {
  const { presentation, page, selected } = props;
  const template = getTemplate(page.templateId);
  const theme = getTheme(page.brandOverride || presentation.brand);
  const block =
    selected && (page.slots[selected.slotKey] || []).find((b) => b.id === selected.blockId);

  /**
   * A square product frame is a fixed composition: 1:1, centred, evenly inset,
   * and contained rather than cropped. Framing controls are therefore hidden
   * for it — pan and zoom only mean something when the image is being cropped
   * to fill a box, and "set as full bleed" is the exact thing the frame exists
   * to prevent. Offering controls that cannot improve the page, and can only
   * knock it off-brand, is the opposite of what this tool is for.
   */
  const selectedSlot = selected ? template.slots.find((s) => s.key === selected.slotKey) : undefined;
  const fixedFrame = selectedSlot?.frame === 'square';

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
      {/* Page guidance is no longer drawn here — the editor renders it above
          the panel's tab row, so it keeps the same position on every tab
          instead of appearing only under Pages. */}

      {/* ------------------------------------------------- selected block */}
      {block ? (
        <>
          <div className="panel-sec" style={{ paddingTop: 0 }}>
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
                <div className="label" style={{ marginBottom: 6 }}>Text colour</div>
                <div className="swatches">
                  <button
                    className={'swatch' + (!block.style?.color || block.style.color === 'auto' ? ' on' : '')}
                    onClick={() => patchStyle({ color: 'auto' })}
                    title="Automatic — always readable on this page"
                    style={{ background: 'linear-gradient(135deg,#fff 0 50%,#17181a 50% 100%)' }}
                  />
                  {theme.textColors.map((c: ColorRole) => (
                    <button
                      key={c}
                      className={'swatch' + (block.style?.color === c ? ' on' : '')}
                      title={colorLabel(theme, c) + ' — ' + theme.colors[c].toUpperCase()}
                      style={{ background: theme.colors[c] }}
                      onClick={() => patchStyle({ color: c })}
                    />
                  ))}
                </div>
                <p className="tiny" style={{ marginTop: 7 }}>
                  {(block.style?.color || 'auto') === 'auto'
                    ? 'Automatic picks the readable ink for this page.'
                    : colorLabel(theme, block.style.color as ColorRole)}
                </p>
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
                    {/* No framing controls: a card image is a fixed 1:1 frame,
                        contained and centred, exactly like the product slots.
                        Pan only means something when an image is being cropped
                        to fill a box, and nothing here is. */}
                    {block.media?.url && (
                      <p className="tiny" style={{ marginTop: 2 }}>
                        Card images sit in a fixed 1:1 frame — swap the file and it
                        lands correctly.
                      </p>
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
                  {[2, 3, 4, 5, 6].map((c) => (
                    <button key={c} className={(block.columns || 4) === c ? 'on' : ''} onClick={() => props.onChangeBlock(block.id, { columns: c })}>
                      {c}
                    </button>
                  ))}
                </div>

                <div className="label" style={{ marginTop: 14, marginBottom: 6 }}>Logos</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn sm"
                    onClick={() =>
                      props.onChangeBlock(block.id, logosPatch([...logosOf(block), { ...EMPTY_LOGO }]))
                    }
                  >
                    + Add logo
                  </button>
                  <button
                    className="btn sm"
                    disabled={logosOf(block).length <= 1}
                    onClick={() => props.onChangeBlock(block.id, logosPatch(logosOf(block).slice(0, -1)))}
                  >
                    Remove last
                  </button>
                </div>
                <p className="tiny" style={{ marginTop: 7 }}>
                  Drag a mark from Assets onto any cell. Marks are always fitted whole, never
                  cropped or stretched. A cell with no artwork keeps its name set in type, so a
                  house brand and a partner can sit in the same grid.
                </p>
              </div>
            )}

            {block.type === 'timeline' && (
              <div style={{ marginTop: 14 }}>
                <div className="label" style={{ marginBottom: 6 }}>Image cards</div>
                <div className="seg">
                  <button
                    className={showsMedia(block) ? 'on' : ''}
                    onClick={() => props.onChangeBlock(block.id, { showImage: true })}
                  >
                    Show
                  </button>
                  <button
                    className={showsMedia(block) ? '' : 'on'}
                    onClick={() => props.onChangeBlock(block.id, { showImage: false })}
                  >
                    Hide
                  </button>
                </div>
                <p className="tiny" style={{ marginTop: 7 }}>
                  Drag a photo from Assets onto any card. Milestones without one keep their space,
                  so the dates stay on a single line.
                </p>

                <div className="label" style={{ marginTop: 14, marginBottom: 6 }}>Milestones</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn sm"
                    onClick={() =>
                      props.onChangeBlock(
                        block.id,
                        entriesPatch([...entriesOf(block), { ...EMPTY_ENTRY }])
                      )
                    }
                  >
                    + Add milestone
                  </button>
                  <button
                    className="btn sm"
                    disabled={entriesOf(block).length <= 1}
                    onClick={() =>
                      props.onChangeBlock(block.id, entriesPatch(entriesOf(block).slice(0, -1)))
                    }
                  >
                    Remove last
                  </button>
                </div>
              </div>
            )}

            {(block.type === 'checklist' || block.type === 'bullets') && (
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
                  {(['auto', 'primary', 'white', 'black'] as const).map((v) => (
                    <button key={v} className={(block.variant || 'auto') === v ? 'on' : ''} onClick={() => props.onChangeBlock(block.id, { variant: v })}>
                      {v === 'auto' ? 'Auto' : v === 'primary' ? 'Primary' : v === 'white' ? 'White' : 'Black'}
                    </button>
                  ))}
                </div>
                <p className="tiny" style={{ marginTop: 8 }}>
                  Auto uses the knockout on dark pages and the full-colour mark on light ones.
                  Logos can&rsquo;t be recoloured, stretched or modified — clear space, minimum size
                  and aspect ratio are handled for you.
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
                  {block.media?.url && !fixedFrame && (
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
                {block.media?.url && !fixedFrame && (
                  <>
                    <Slider label="Horizontal" value={block.media.focalX ?? 0.5} onChange={(v) => patchMedia({ focalX: v })} />
                    <Slider label="Vertical" value={block.media.focalY ?? 0.5} onChange={(v) => patchMedia({ focalY: v })} />
                    <Slider label="Zoom" min={1} max={2} value={block.media.zoom ?? 1} onChange={(v) => patchMedia({ zoom: v })} />
                  </>
                )}
                {block.media?.url && fixedFrame && (
                  <p className="tiny" style={{ marginTop: 2 }}>
                    Product images sit in a fixed 1:1 frame, so there is nothing to
                    position — swap the file and it lands correctly.
                  </p>
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
      <div className="panel-sec" style={!block ? { paddingTop: 0 } : undefined}>
        <h4 className="panel-h">Page</h4>

        <div className="label" style={{ marginBottom: 6 }}>Layout</div>
        {/* The category becomes a section heading rather than a prefix on every
            row, so forty-five layouts read as six short lists. */}
        <Select
          style={{ marginBottom: 14 }}
          ariaLabel="Page layout"
          value={page.templateId}
          onChange={props.onSwapTemplate}
          options={TEMPLATES.map((t: PageTemplate) => ({
            value: t.id,
            label: t.name,
            group: t.category,
          }))}
        />

        <div className="label" style={{ marginBottom: 6 }}>Page eyebrow</div>
        <div className="seg" style={{ marginBottom: 8 }}>
          <button
            className={page.headline !== undefined ? 'on' : ''}
            onClick={() => props.onChangePage({ headline: page.headline ?? 'Section eyebrow' })}
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

        {/* ---------------------------------------------- screenshot reader
            A category review arrives as a PDF of somebody else's charts.
            Retyping one is ten minutes and a typo; this is ten seconds and
            keeps it as data, drawn in our own hand. What comes back is a
            proposal — the numbers are editable on the page like any others,
            and they should be checked against the source before it goes out. */}
        {props.onInsertPage ? <ChartFromImage onInsert={props.onInsertPage} /> : null}

        {/* ------------------------------------------------------- retailer
            A deck built for one account carries that account's mark beside
            ours. It is deck-level on purpose: a salesperson sets Publix once
            and every page showing the lockup co-brands, instead of setting a
            logo twenty-one times and missing three. */}
        {props.onChangeDeck ? (
          <>
            <div className="label" style={{ marginBottom: 6 }}>Retailer (whole deck)</div>
            <Select
              style={{ marginBottom: 6 }}
              ariaLabel="Retailer for this deck"
              value={presentation.retailer?.id || ''}
              onChange={(id) =>
                props.onChangeDeck!({
                  retailer: id ? { id, name: retailerDef(id)?.name || id } : undefined,
                })
              }
              options={[
                { value: '', label: 'None — Vigo | Alessi only' },
                ...RETAILERS.map((r) => ({ value: r.id, label: r.name, group: 'Accounts' })),
              ]}
            />
            <p className="tiny" style={{ marginTop: 0, marginBottom: 14 }}>
              Shows beside the brand lockup on every page with the logo on. Turn the logo on below.
            </p>
          </>
        ) : null}

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
          <>
            <div className="swatches" style={{ marginBottom: 6 }}>
              {theme.surfaceColors.map((c) => (
                <button
                  key={c}
                  title={colorLabel(theme, c) + ' — ' + theme.colors[c].toUpperCase()}
                  className={'swatch' + (page.background?.color === c ? ' on' : '')}
                  style={{ background: theme.colors[c] }}
                  onClick={() => setBg({ color: c })}
                />
              ))}
            </div>
            <p className="tiny" style={{ marginBottom: 10 }}>
              {page.background?.color
                ? colorLabel(theme, page.background.color)
                : 'Pick an approved background colour.'}
            </p>
          </>
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


/* ------------------------------------------------- chart from a screenshot */

function ChartFromImage({ onInsert }: { onInsert: (page: Page) => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const read = async (file: File) => {
    setProblem(null);
    setDone(null);
    setBusy(true);
    try {
      const image = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error('That file could not be read.'));
        fr.readAsDataURL(file);
      });
      const res = await fetch('/api/ingest/chart', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image }),
      });
      const j = await res.json();
      if (!res.ok || !j.page) {
        setProblem(j.error || 'That image could not be read as a chart.');
        return;
      }
      onInsert(j.page);
      setDone('Page added — check the figures against the report.');
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Something went wrong reading that image.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="label" style={{ marginBottom: 6 }}>Build a page from a screenshot</div>
      <button
        className="btn"
        style={{ width: '100%' }}
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? 'Reading the chart…' : 'Choose a chart screenshot'}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) read(f);
        }}
      />
      {problem ? (
        <p className="tiny" style={{ marginTop: 8, color: 'var(--danger, #b23)' }}>{problem}</p>
      ) : done ? (
        <p className="tiny" style={{ marginTop: 8 }}>{done}</p>
      ) : (
        <p className="tiny" style={{ marginTop: 8 }}>
          Crop to one chart or table. The numbers come back as data and are drawn in Vigo styling — always check them against the source.
        </p>
      )}
    </div>
  );
}
