'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Stage from '@/components/render/Stage';
import PageNav from './PageNav';
import Inspector from './Inspector';
import AssetsPanel from './AssetsPanel';
import BrandPanel from './BrandPanel';
import AddPanel from './AddPanel';
import AddPageModal from './AddPageModal';
import SharePanel from './SharePanel';
import type { Block, BlockType, Page, Presentation } from '@/lib/model/types';
import { uid } from '@/lib/model/types';
import { createPage, getTemplate } from '@/lib/templates/registry';
import { pageGuardrails } from '@/lib/guardrails';
import { getTheme } from '@/lib/brand/themes';
import type { BrandId } from '@/lib/brand/themes';
import { getStore, storeKindSync } from '@/lib/store';
import { ConflictError } from '@/lib/store/api';
import { processFile } from '@/lib/media';

type Tab = 'pages' | 'add' | 'assets' | 'brand';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function defaultBlock(type: BlockType, role?: string): Block {
  switch (type) {
    case 'metric':
      return { id: uid('b'), type, value: '+00%', label: 'What this measures', support: '', trend: 'none', style: { role: 'metricLarge', color: 'auto', align: 'left' } };
    case 'image':
    case 'video':
      return { id: uid('b'), type, media: { url: '', focalX: 0.5, focalY: 0.5, zoom: 1, autoplay: true, loop: true, muted: true } };
    case 'logo':
      return { id: uid('b'), type, variant: 'primary' };
    case 'quote':
      return { id: uid('b'), type, text: 'Add a quote', label: 'Who said it', style: { role: 'quote', color: 'auto', align: 'left' } };
    case 'checklist':
    case 'bullets':
      return { id: uid('b'), type, items: ['First point', 'Second point', 'Third point'], style: { role: 'subhead', color: 'auto', align: 'left' } };
    case 'timeline':
      return { id: uid('b'), type, items: ['1946 — Founded', '1999 — Alessi acquired', '2026 — Today'], style: { role: 'body', color: 'auto', align: 'left' } };
    case 'logoGrid':
      return { id: uid('b'), type, items: ['Account', 'Account', 'Account', 'Account'], style: { role: 'caption', color: 'auto', align: 'center' } };
    case 'card':
      return {
        id: uid('b'),
        type,
        text: 'Product name',
        support: 'A sentence of supporting copy.',
        showImage: true,
        wholesale: role === 'product' ? '$0.00' : undefined,
        msrp: role === 'product' ? '$0.00' : undefined,
        media: { url: '', focalX: 0.5, focalY: 0.5, zoom: 1 },
        style: { role: 'subhead', color: 'auto', align: 'left' },
      };
    case 'divider':
      return { id: uid('b'), type };
    case 'cta':
      return { id: uid('b'), type, text: 'Let’s talk', style: { role: 'caption', color: 'auto', align: 'left' } };
    default:
      return { id: uid('b'), type: 'text', text: '', style: { role: (role as any) || 'headline', color: 'auto', align: 'left' } };
  }
}

/** Swapping a layout carries the content across instead of throwing it away. */
function remapSlots(page: Page, newTemplateId: string): Record<string, Block[]> {
  const from = getTemplate(page.templateId);
  const to = getTemplate(newTemplateId);
  const next: Record<string, Block[]> = {};
  to.slots.forEach((s) => (next[s.key] = []));

  const pool: Block[] = [];
  from.slots.forEach((s) => {
    const blocks = page.slots[s.key] || [];
    const target = to.slots.find((x) => x.key === s.key);
    if (target) {
      const ok = blocks.filter((b) => target.accepts.includes(b.type));
      next[target.key] = ok.slice(0, target.max);
      pool.push(...blocks.filter((b) => !ok.includes(b)));
    } else {
      pool.push(...blocks);
    }
  });

  pool.forEach((b) => {
    const target = to.slots.find((s) => s.accepts.includes(b.type) && next[s.key].length < s.max);
    if (target) next[target.key].push(b);
  });

  // fill anything still empty with the template's own seed content
  const seed = to.seed();
  to.slots.forEach((s) => {
    if (next[s.key].length === 0 && seed[s.key]) next[s.key] = seed[s.key];
  });
  return next;
}

export default function Editor({ id }: { id: string }) {
  const router = useRouter();
  const [pres, setPres] = useState<Presentation | null>(null);
  const [missing, setMissing] = useState(false);
  const [currentId, setCurrentId] = useState<string>('');
  const [tab, setTab] = useState<Tab>('pages');
  const [selected, setSelected] = useState<{ blockId: string; slotKey: string } | null>(null);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [adding, setAdding] = useState<null | { afterIndex: number }>(null);
  const [sharing, setSharing] = useState(false);
  const [saved, setSaved] = useState<'saved' | 'saving' | 'error'>('saved');
  const [conflict, setConflict] = useState<{ message: string; latest: Presentation } | null>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    getStore()
      .then((s) => s.get(id))
      .then((p) => {
        if (!p) return setMissing(true);
        setPres(p);
        setCurrentId(p.pages[0]?.id || '');
      })
      .catch(() => setMissing(true));
  }, [id]);

  /* ------------------------------------------------------------ autosave */
  const queueSave = useCallback((next: Presentation) => {
    setSaved('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const s = await getStore();
      try {
        await s.save(next);
        setSaved('saved');
      } catch (e: any) {
        if (e instanceof ConflictError || e?.name === 'ConflictError') {
          setSaved('error');
          setConflict({ message: e.message, latest: (e as ConflictError).latest });
          return;
        }
        if (e?.message === 'SIGNED_OUT') {
          setSaved('error');
          window.location.href = '/login';
          return;
        }
        setSaved('error');
        if (e?.message === 'STORAGE_FULL') {
          window.alert('This browser ran out of local storage. Remove a large image or connect a database to keep going.');
        }
      }
    }, 600);
  }, []);

  const presRef = useRef<Presentation | null>(null);
  presRef.current = pres;

  /* --------------------------------------------------------- undo history */
  const past = useRef<Presentation[]>([]);
  const future = useRef<Presentation[]>([]);
  const lastPush = useRef(0);
  const [histTick, setHistTick] = useState(0);

  const apply = useCallback(
    (next: Presentation) => {
      presRef.current = next;
      setPres(next);
      queueSave(next);
    },
    [queueSave]
  );

  const update = useCallback(
    (fn: (draft: Presentation) => void, opts: { history?: boolean; coalesce?: boolean; force?: boolean } = {}) => {
      const cur = presRef.current;
      if (!cur) return;
      // a locked presentation is read-only; only an explicit unlock gets through
      if (cur.locked && !opts.force) return;
      if (opts.history !== false) {
        // typing produces one history entry per pause, not per keystroke
        const now = Date.now();
        if (!(opts.coalesce && now - lastPush.current < 1200)) {
          past.current.push(clone(cur));
          if (past.current.length > 60) past.current.shift();
          future.current = [];
          lastPush.current = now;
          setHistTick((t) => t + 1);
        }
      }
      const next = clone(cur);
      fn(next);
      next.updatedAt = Date.now();
      apply(next);
    },
    [apply]
  );

  const undo = useCallback(() => {
    const cur = presRef.current;
    if (!cur || past.current.length === 0) return;
    const prev = past.current.pop()!;
    future.current.push(clone(cur));
    setHistTick((t) => t + 1);
    apply(prev);
    if (!prev.pages.some((p) => p.id === currentId)) setCurrentId(prev.pages[0].id);
    setSelected(null);
  }, [apply, currentId]);

  const redo = useCallback(() => {
    const cur = presRef.current;
    if (!cur || future.current.length === 0) return;
    const next = future.current.pop()!;
    past.current.push(clone(cur));
    setHistTick((t) => t + 1);
    apply(next);
    if (!next.pages.some((p) => p.id === currentId)) setCurrentId(next.pages[0].id);
    setSelected(null);
  }, [apply, currentId]);

  const setLocked = useCallback(
    (v: boolean) => {
      update((d) => {
        d.locked = v || undefined;
      }, { force: true });
    },
    [update]
  );

  const pageIndex = useMemo(() => (pres ? pres.pages.findIndex((p) => p.id === currentId) : -1), [pres, currentId]);
  const page = pageIndex >= 0 ? pres!.pages[pageIndex] : null;

  /* --------------------------------------------------------- page actions */
  const addPageAfter = (i: number, templateId: string) => {
    update((d) => {
      const np = createPage(templateId);
      d.pages.splice(i + 1, 0, np);
      setTimeout(() => setCurrentId(np.id), 0);
    });
  };

  const onDropOnSlot = async (slotKey: string, e: React.DragEvent) => {
    if (!page) return;
    const template = getTemplate(page.templateId);
    const slot = template.slots.find((s) => s.key === slotKey);
    const assetUrl = e.dataTransfer.getData('application/x-vigo-asset');
    const assetId = e.dataTransfer.getData('application/x-vigo-asset-id') || undefined;
    const file = e.dataTransfer.files?.[0];
    let url = assetUrl;
    let kind: 'image' | 'video' = 'image';
    let width = 1200;
    let height = 800;
    if (!url && file) {
      const m = await processFile(file);
      url = m.url;
      kind = m.kind;
      width = m.width;
      height = m.height;
      if (m.tooLarge) window.alert('That file is very large. It has been added, but consider a smaller version.');
    }
    if (!url) return;

    const acceptsMedia = slot && (slot.accepts.includes('image') || slot.accepts.includes('video'));
    update((d) => {
      const p = d.pages.find((x) => x.id === page.id);
      if (!p) return;
      const cardHere = (p.slots[slotKey] || []).find((b) => b.type === 'card');
      if (cardHere && kind === 'image') {
        // dropping onto a card fills the card's own image well
        cardHere.showImage = true;
        cardHere.media = { url, assetId, width, height, focalX: 0.5, focalY: 0.5, zoom: 1 };
      } else if (acceptsMedia) {
        const list = p.slots[slotKey] || (p.slots[slotKey] = []);
        const existing = list.find((b) => b.type === 'image' || b.type === 'video');
        if (existing) {
          existing.type = kind;
          existing.media = { url, assetId, width, height, focalX: 0.5, focalY: 0.5, zoom: 1, autoplay: true, loop: true, muted: true };
        } else {
          list.push({ id: uid('b'), type: kind, media: { url, assetId, width, height, focalX: 0.5, focalY: 0.5, zoom: 1, autoplay: true, loop: true, muted: true } });
        }
      } else {
        // dropping media on a copy area sets the page background — full bleed, instantly
        p.background = {
          kind,
          media: { url, assetId, width, height, focalX: 0.5, focalY: 0.5, zoom: 1, autoplay: true, loop: true, muted: true },
          overlay: p.background?.overlay && p.background.overlay !== 'none' ? p.background.overlay : 'gradient',
        };
      }
    });
  };

  const useAsset = (asset: { id: string; path: string; width?: number; height?: number }) => {
    const url = asset.path;
    const assetId = asset.id;
    if (!page) return;
    const template = getTemplate(page.templateId);
    const slot =
      template.slots.find((s) => s.key === activeSlot && (s.accepts.includes('image') || s.accepts.includes('video'))) ||
      template.slots.find((s) => s.accepts.includes('image'));
    update((d) => {
      const p = d.pages.find((x) => x.id === page.id);
      if (!p) return;
      const media = { url, assetId, width: asset.width, height: asset.height, focalX: 0.5, focalY: 0.5, zoom: 1 };
      const card = activeSlot && (p.slots[activeSlot] || []).find((b) => b.type === 'card');
      if (card) {
        card.showImage = true;
        card.media = { ...media };
        return;
      }
      if (!slot) {
        p.background = { kind: 'image', media: { ...media }, overlay: 'gradient' };
        return;
      }
      const list = p.slots[slot.key] || (p.slots[slot.key] = []);
      const existing = list.find((b) => b.type === 'image' || b.type === 'video');
      if (existing) existing.media = { ...media };
      else list.push({ id: uid('b'), type: 'image', media: { ...media } });
    });
  };

  const addBlock = (type: BlockType, role?: string) => {
    if (!page) return;
    const template = getTemplate(page.templateId);
    const slot =
      template.slots.find((s) => s.key === activeSlot && s.accepts.includes(type)) ||
      template.slots.find((s) => s.accepts.includes(type));
    if (!slot) return;
    const b = defaultBlock(type, role);
    update((d) => {
      const p = d.pages.find((x) => x.id === page.id);
      if (!p) return;
      (p.slots[slot.key] = p.slots[slot.key] || []).push(b);
    });
    setSelected({ blockId: b.id, slotKey: slot.key });
    setTab('pages');
  };

  /* ------------------------------------------------------------- keyboard */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      const editing = (document.activeElement as HTMLElement)?.isContentEditable;
      if (editing) return;
      if (!pres) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        const i = pres.pages.findIndex((p) => p.id === currentId);
        if (i < pres.pages.length - 1) setCurrentId(pres.pages[i + 1].id);
      }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        const i = pres.pages.findIndex((p) => p.id === currentId);
        if (i > 0) setCurrentId(pres.pages[i - 1].id);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [pres, currentId, undo, redo]);

  if (missing) {
    return (
      <div style={{ padding: 60 }}>
        <p>That presentation couldn&rsquo;t be found in this browser.</p>
        <button className="btn" onClick={() => router.push('/dashboard')}>Back to dashboard</button>
      </div>
    );
  }
  if (!pres || !page) return <div style={{ padding: 60 }} className="muted">Loading…</div>;

  // Guardrail notices moved up from the Inspector: the panel renders them above
  // its tab row, so they are visible and fixed in place on every tab.
  const warnings = pageGuardrails(page, getTemplate(page.templateId), getTheme(page.brandOverride || pres.brand));

  return (
    <div className="editor">
      <div className="ed-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <button className="btn ghost sm" onClick={() => router.push('/dashboard')} title="All presentations">
            ←
          </button>
          {/* data-value drives the width: the wrapper's ::after renders the
              same string invisibly, so the field is exactly as wide as its
              title until it reaches the cap. See .ed-titlewrap. */}
          <span className="ed-titlewrap" data-value={pres.title}>
            <input
              className="ed-title"
              /* size=1 so the input contributes almost nothing to the grid
                 track. Left at its default of 20 characters, every title —
                 even "Q3 Review" — would sit in a field padded out to that
                 width. The ::after string is what sets the width. */
              size={1}
              readOnly={!!pres.locked}
              value={pres.title}
              title={pres.title}
              onChange={(e) => update((d) => { d.title = e.target.value; })}
            />
          </span>
          <span className={'savechip' + (saved === 'error' ? ' bad' : '')}>
            {saved === 'saving' ? 'Saving…' : saved === 'error' ? 'Not saved' : 'Saved'}
          </span>
          <span className="undo-group" data-tick={histTick}>
            <button
              className="btn sm"
              onClick={undo}
              disabled={past.current.length === 0}
              title="Undo (⌘Z)"
            >
              ↶ Undo
            </button>
            <button
              className="btn sm ghost"
              onClick={redo}
              disabled={future.current.length === 0}
              title="Redo (⇧⌘Z)"
            >
              ↷
            </button>
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn sm" onClick={() => router.push('/present/' + pres.id)}>
            Preview
          </button>
          <button className="btn sm primary" onClick={() => setSharing(true)}>
            Share
          </button>
        </div>
      </div>

      <div className="ed-body">
        <div className="ed-left">
          <PageNav
            pages={pres.pages}
            brand={pres.brand}
            currentId={currentId}
            onSelect={(pid) => {
              setCurrentId(pid);
              setSelected(null);
            }}
            onReorder={(from, to) =>
              update((d) => {
                const [m] = d.pages.splice(from, 1);
                d.pages.splice(to, 0, m);
              })
            }
            onDuplicate={(i) =>
              update((d) => {
                const copy = clone(d.pages[i]);
                copy.id = uid('pg');
                copy.sectionStart = undefined;
                Object.keys(copy.slots).forEach((k) => copy.slots[k].forEach((b) => (b.id = uid('b'))));
                d.pages.splice(i + 1, 0, copy);
                setTimeout(() => setCurrentId(copy.id), 0);
              })
            }
            onDelete={(i) =>
              update((d) => {
                if (d.pages.length === 1) return;
                const removed = d.pages.splice(i, 1)[0];
                if (removed.id === currentId) {
                  const n = d.pages[Math.max(0, i - 1)];
                  setTimeout(() => setCurrentId(n.id), 0);
                }
              })
            }
            onAddAfter={(i) => setAdding({ afterIndex: i })}
            onRenameSection={(i, name) =>
              update((d) => {
                d.pages[i].sectionStart = name === undefined ? undefined : name;
              })
            }
          />
        </div>

        <div className="ed-center" onMouseDown={() => setSelected(null)}>
          {conflict ? (
            <div className="lockbar" style={{ background: '#fdf6e6', borderColor: '#f0dfae', color: '#6a5209' }}>
              <span>
                <b>{conflict.message}</b> Your recent edits have not been saved.
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn sm"
                  onClick={() => {
                    presRef.current = conflict.latest;
                    setPres(conflict.latest);
                    setConflict(null);
                    setSaved('saved');
                  }}
                >
                  Load their version
                </button>
                <button
                  className="btn sm primary"
                  onClick={() => {
                    const cur = presRef.current;
                    if (!cur) return;
                    const forced = { ...cur, version: conflict.latest.version } as Presentation;
                    setConflict(null);
                    presRef.current = forced;
                    setPres(forced);
                    queueSave(forced);
                  }}
                >
                  Keep mine
                </button>
              </span>
            </div>
          ) : null}
          {pres.locked ? (
            <div className="lockbar">
              <span>
                <b>Locked.</b> This presentation is read-only so it can&rsquo;t be edited or re-shared
                by mistake.
              </span>
              <button className="btn sm" onClick={() => setLocked(false)}>
                Unlock to edit
              </button>
            </div>
          ) : null}
          <div className="canvas-frame" onMouseDown={(e) => e.stopPropagation()}>
            <div className="canvas-caption">
              <span>
                Page {pageIndex + 1} of {pres.pages.length} · {getTemplate(page.templateId).name}
              </span>
              <span>{page.brandOverride ? page.brandOverride : pres.brand}</span>
            </div>
            <div className="canvas-shell">
              <Stage
                page={page}
                brand={pres.brand}
                editable={!pres.locked}
                selectedId={selected?.blockId}
                onSelectBlock={(blockId, slotKey) => setSelected({ blockId, slotKey })}
                onSelectSlot={(slotKey) => setActiveSlot(slotKey)}
                onChangeBlock={(bid, patch) =>
                  update(
                    (d) => {
                      const p = d.pages.find((x) => x.id === page.id);
                      if (!p) return;
                      Object.keys(p.slots).forEach((k) =>
                        p.slots[k].forEach((b, idx) => {
                          if (b.id === bid) p.slots[k][idx] = { ...b, ...patch };
                        })
                      );
                    },
                    { coalesce: true }
                  )
                }
                onChangePage={(patch) =>
                  update(
                    (d) => {
                      const i = d.pages.findIndex((x) => x.id === page.id);
                      if (i >= 0) d.pages[i] = { ...d.pages[i], ...patch };
                    },
                    { coalesce: true }
                  )
                }
                onReorderBlocks={(slotKey, from, to) =>
                  update((d) => {
                    const p = d.pages.find((x) => x.id === page.id);
                    if (!p || !p.slots[slotKey]) return;
                    const list = p.slots[slotKey];
                    const [m] = list.splice(from, 1);
                    list.splice(to, 0, m);
                  })
                }
                onDropOnSlot={onDropOnSlot}
              />
            </div>
          </div>
          {!pres.locked && (
            <button className="addpage" style={{ maxWidth: 1180 }} onClick={() => setAdding({ afterIndex: pageIndex })}>
              + Add page
            </button>
          )}
        </div>

        <div className="ed-right" onMouseDown={(e) => e.stopPropagation()}>
          {/* Page guidance sits above the tabs, so it holds one position
              whichever tab is open rather than appearing only under Pages. */}
          {warnings.length > 0 && (
            <div className="panel-notices">
              {warnings.slice(0, 3).map((w) => (
                <div
                  className="warn"
                  key={w.id}
                  style={w.tone === 'info' ? { background: '#f4f6f8', borderColor: '#e0e5ea', color: '#5f6368' } : undefined}
                >
                  <span>{w.tone === 'warn' ? '△' : 'ⓘ'}</span>
                  <span>{w.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* The bar, not the track, is what sticks — it needs an opaque
              background spanning the panel's full width, or content scrolls
              visibly through the tabs. */}
          <div className="ed-tabsbar">
            <div className="ed-tabs">
              {(['pages', 'add', 'assets', 'brand'] as Tab[]).map((t) => (
                <button key={t} className={'tabbtn' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {tab === 'pages' && (
            <Inspector
              presentation={pres}
              page={page}
              selected={selected}
              onChangeBlock={(bid, patch) =>
                update((d) => {
                  const p = d.pages.find((x) => x.id === page.id);
                  if (!p) return;
                  Object.keys(p.slots).forEach((k) =>
                    p.slots[k].forEach((b, idx) => {
                      if (b.id === bid) p.slots[k][idx] = { ...b, ...patch };
                    })
                  );
                })
              }
              onDeleteBlock={(bid) => {
                update((d) => {
                  const p = d.pages.find((x) => x.id === page.id);
                  if (!p) return;
                  Object.keys(p.slots).forEach((k) => (p.slots[k] = p.slots[k].filter((b) => b.id !== bid)));
                });
                setSelected(null);
              }}
              onChangePage={(patch) =>
                update((d) => {
                  const i = d.pages.findIndex((x) => x.id === page.id);
                  if (i >= 0) d.pages[i] = { ...d.pages[i], ...patch };
                })
              }
              onSwapTemplate={(tid) =>
                update((d) => {
                  const i = d.pages.findIndex((x) => x.id === page.id);
                  if (i < 0) return;
                  const nextSlots = remapSlots(d.pages[i], tid);
                  const t = getTemplate(tid);
                  d.pages[i] = {
                    ...d.pages[i],
                    templateId: tid,
                    slots: nextSlots,
                    background:
                      d.pages[i].background?.kind === 'theme' && t.background
                        ? clone(t.background)
                        : d.pages[i].background,
                  };
                })
              }
            />
          )}
          {tab === 'add' && (
            <AddPanel
              page={page}
              activeSlot={activeSlot}
              onAddPage={() => setAdding({ afterIndex: pageIndex })}
              onAddBlock={addBlock}
            />
          )}
          {tab === 'assets' && <AssetsPanel brand={pres.brand} onUse={useAsset} />}
          {tab === 'brand' && (
            <BrandPanel
              brand={pres.brand}
              onChangeBrand={(b: BrandId) =>
                update((d) => {
                  d.brand = b;
                })
              }
            />
          )}
        </div>
      </div>

      {adding && (
        <AddPageModal
          brand={pres.brand}
          onClose={() => setAdding(null)}
          onPick={(templateId) => {
            addPageAfter(adding.afterIndex, templateId);
            setAdding(null);
          }}
        />
      )}

      {sharing && (
        <SharePanel
          presentation={pres}
          backend={storeKindSync()}
          onSetLocked={setLocked}
          onChange={(patch) => update((d) => Object.assign(d, patch))}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}
