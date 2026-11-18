'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import NewPresentation from '@/components/NewPresentation';
import PdfImport from '@/components/PdfImport';
import { getStore } from '@/lib/store';
import { getTemplate } from '@/lib/templates/registry';
import Thumb from '@/components/ui/Thumb';
import type { Presentation } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';
import { uploadShared } from '@/lib/assets/sharedUpload';
import { useApp } from './Shell';
import { brandLook } from './brandLook';

/**
 * ONE PROMPT
 * ---------------------------------------------------------------------------
 * Describe the deck, drop in photos or a PDF, pick the brand, send. The
 * planner proposes an outline built from the brand's own layouts; nothing is
 * saved until the person approves it, then the deck opens in the editor.
 *
 * Photos go straight into the team library (so the deck points at a stored
 * copy everyone can reuse) and the planner sees a small preview of each to
 * place it on a page that suits it. PDFs and text files are source material.
 */
const STEPS = ['Reading your brief', 'Choosing layouts and writing', 'Outline ready'] as const;
const BUILD = ['Saving the deck', 'Opening the editor'] as const;

type Attachment = {
  key: string;
  name: string;
  kind: 'photo' | 'pdf' | 'text';
  state: 'working' | 'ready' | 'failed';
  problem?: string;
  preview?: string;
  url?: string;
  assetId?: string;
  width?: number;
  height?: number;
  data?: string;
  text?: string;
};

const PDF_LIMIT = 2_400_000; // bytes, so one request stays inside the platform's body limit

function shrink(file: File, max = 768): Promise<{ data: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = c.getContext('2d')!;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve({ data: c.toDataURL('image/jpeg', 0.8), width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    img.src = url;
  });
}

function base64Of(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export default function Composer({ initialBrand }: { initialBrand?: string }) {
  const router = useRouter();
  const { user, brands } = useApp();
  const editable = (brands || []).filter((b) => b.role && b.role !== 'viewer');
  const [brand, setBrand] = useState<string | undefined>(initialBrand);
  const [brief, setBrief] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [step, setStep] = useState(-1);
  const [building, setBuilding] = useState(-1);
  const [problem, setProblem] = useState<string | null>(null);
  const [startBlank, setStartBlank] = useState(false);
  const [fromPdf, setFromPdf] = useState(false);
  const [plan, setPlan] = useState<Presentation | null>(null);
  const [approach, setApproach] = useState<string | null>(null);
  const [brandMenu, setBrandMenu] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!brand && editable.length) setBrand(editable[0].id);
  }, [brand, editable]);

  useEffect(() => {
    if (!brandMenu) return;
    const shut = () => setBrandMenu(false);
    window.addEventListener('mousedown', shut);
    return () => window.removeEventListener('mousedown', shut);
  }, [brandMenu]);

  // the box grows with what is typed, up to a point
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(320, Math.max(84, el.scrollHeight)) + 'px';
  }, [brief]);

  const busy = step >= 0 || building >= 0;
  const working = files.some((f) => f.state === 'working');
  const current = editable.find((b) => b.id === brand) || (brands || []).find((b) => b.id === brand);

  const patch = (key: string, p: Partial<Attachment>) => setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, ...p } : f)));

  const add = (list: FileList | File[]) => {
    Array.from(list)
      .slice(0, 10)
      .forEach(async (file) => {
        const key = Math.random().toString(36).slice(2);
        const isImg = /^image\//.test(file.type);
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        const isText = /^text\//.test(file.type) || /\.(md|txt|csv)$/i.test(file.name);
        if (!isImg && !isPdf && !isText) {
          setProblem(`${file.name} can't be used here. Add photos, a PDF or a text file.`);
          return;
        }
        const kind: Attachment['kind'] = isImg ? 'photo' : isPdf ? 'pdf' : 'text';
        setFiles((fs) => [...fs, { key, name: file.name, kind, state: 'working' }]);
        try {
          if (kind === 'photo') {
            const small = await shrink(file);
            patch(key, { preview: small.data });
            const stored = await uploadShared(file, (brand || 'corporate') as BrandId, 'Lifestyle');
            patch(key, {
              state: 'ready',
              url: stored.url,
              assetId: stored.id,
              width: stored.width || small.width,
              height: stored.height || small.height,
            });
          } else if (kind === 'pdf') {
            if (file.size > PDF_LIMIT) {
              patch(key, { state: 'failed', problem: 'Over 2.4 MB. Use a smaller PDF or paste the key points.' });
              return;
            }
            patch(key, { state: 'ready', data: await base64Of(file) });
          } else {
            patch(key, { state: 'ready', text: (await file.text()).slice(0, 20_000) });
          }
        } catch {
          patch(key, { state: 'failed', problem: kind === 'photo' ? 'Could not be added to the library.' : 'Could not be read.' });
        }
      });
  };

  const generate = async () => {
    const text = brief.trim();
    if (!text || !brand || busy || working) return;
    setProblem(null);
    setStep(0);
    try {
      const ready = files.filter((f) => f.state === 'ready');
      const req = fetch('/api/compose/deck', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          brief: text,
          brand,
          photos: ready
            .filter((f) => f.kind === 'photo')
            .map((f) => ({ url: f.url, assetId: f.assetId, width: f.width, height: f.height, name: f.name, preview: f.preview })),
          documents: ready.filter((f) => f.kind === 'pdf').map((f) => ({ name: f.name, data: f.data })),
          notes: ready
            .filter((f) => f.kind === 'text')
            .map((f) => `${f.name}:\n${f.text}`)
            .join('\n\n'),
        }),
      });
      setStep(1);
      const r = await req;
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.presentation) {
        setProblem(j.error || 'That brief could not be planned. Say who it is for and what it needs to prove, then try again.');
        setStep(-1);
        return;
      }
      setApproach(j.approach || null);
      setPlan(j.presentation);
      setStep(-1);
    } catch {
      setProblem('The connection dropped while planning. Your brief is still here, so try again.');
      setStep(-1);
    }
  };

  const build = async (p: Presentation) => {
    setBuilding(0);
    try {
      const s = await getStore();
      await s.save(p);
      setBuilding(1);
      router.push('/e/' + p.id);
    } catch {
      setProblem('The deck could not be saved. Try again.');
      setBuilding(-1);
    }
  };

  const create = async (p: Presentation) => {
    const s = await getStore();
    await s.save(p);
    router.push('/e/' + p.id);
  };

  const first = (user?.name || '').split(' ')[0];

  return (
    <section className="pc" aria-label="Create a presentation">
      {plan ? (
        <Outline
          plan={plan}
          approach={approach}
          building={building}
          problem={problem}
          onChange={setPlan}
          onBack={() => {
            setPlan(null);
            setApproach(null);
          }}
          onCreate={() => build(plan)}
        />
      ) : (
        <>
          <h1 className="pc-title">
            {first && first !== 'Administrator' ? `What are we presenting, ${first}?` : 'What are we presenting?'}
          </h1>

          <div
            className={'pc-box' + (dragOver ? ' over' : '') + (busy ? ' busy' : '')}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes('Files')) return;
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) add(e.dataTransfer.files);
            }}
          >
            {files.length ? (
              <ul className="pc-files" aria-label="Attached">
                {files.map((f) => (
                  <li key={f.key} className={'pc-file ' + f.state} title={f.problem || f.name}>
                    {f.kind === 'photo' && f.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.preview} alt="" />
                    ) : (
                      <span className="pc-ficon">{f.kind === 'pdf' ? 'PDF' : 'TXT'}</span>
                    )}
                    <span className="pc-fname">
                      {f.name}
                      <em>
                        {f.state === 'working'
                          ? f.kind === 'photo'
                            ? 'Adding to library…'
                            : 'Reading…'
                          : f.state === 'failed'
                            ? f.problem
                            : f.kind === 'photo'
                              ? 'In the library'
                              : 'Ready'}
                      </em>
                    </span>
                    <button aria-label={'Remove ' + f.name} disabled={busy} onClick={() => setFiles((fs) => fs.filter((x) => x.key !== f.key))}>
                      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <textarea
              ref={area}
              aria-label="Describe the presentation"
              value={brief}
              disabled={busy}
              onChange={(e) => setBrief(e.target.value)}
              onPaste={(e) => {
                const imgs = Array.from(e.clipboardData.files || []).filter((f) => /^image\//.test(f.type));
                if (imgs.length) {
                  e.preventDefault();
                  add(imgs);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  generate();
                }
              }}
              placeholder="A 12-slide pitch to a regional grocery buyer for our premium Italian range: heritage, how it's made, the products that sell, and what a partnership looks like."
            />

            {step >= 0 ? (
              <ol className="pc-steps" aria-live="polite">
                {STEPS.map((s, i) => (
                  <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>
                    <i aria-hidden />
                    {s}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="pc-bar">
                <button className="pc-tool" onClick={() => picker.current?.click()} disabled={busy} title="Add photos, a PDF or notes">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 7.6 8 12.8a3.2 3.2 0 0 1-4.6-4.5l5.5-5.5a2.1 2.1 0 0 1 3 3L6.4 11.3a1 1 0 0 1-1.5-1.5L10 4.8" /></svg>
                  Attach
                </button>
                <input
                  ref={picker}
                  type="file"
                  multiple
                  hidden
                  accept="image/*,application/pdf,.pdf,.txt,.md,.csv,text/plain"
                  onChange={(e) => {
                    if (e.target.files?.length) add(e.target.files);
                    e.target.value = '';
                  }}
                />
                {initialBrand ? (
                  <span className="pc-brand static">
                    <span className="sw" style={{ background: brandLook(brand || '').swatch }} />
                    {current?.name || brand}
                  </span>
                ) : (
                  <span className="pc-brandwrap">
                    <button
                      className="pc-brand"
                      aria-haspopup="listbox"
                      aria-expanded={brandMenu}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => setBrandMenu(!brandMenu)}
                      disabled={busy}
                    >
                      <span className="sw" style={{ background: brandLook(brand || '').swatch }} />
                      {current?.name || 'Choose a brand'}
                      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6.5 3.5 3.5 3.5-3.5" /></svg>
                    </button>
                    {brandMenu ? (
                      <div className="pc-menu" role="listbox" onMouseDown={(e) => e.stopPropagation()}>
                        {editable.map((b) => (
                          <button
                            key={b.id}
                            role="option"
                            aria-selected={b.id === brand}
                            onClick={() => {
                              setBrand(b.id);
                              setBrandMenu(false);
                            }}
                          >
                            <span className="sw" style={{ background: brandLook(b.id).swatch }} />
                            {b.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </span>
                )}
                <span className="pc-hint">{working ? 'Adding files…' : 'Enter to send, Shift+Enter for a new line'}</span>
                <button className="pc-send" onClick={generate} disabled={!brief.trim() || !brand || working} aria-label="Plan the presentation" title="Plan the presentation">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3.5M3.8 7.6 8 3.4l4.2 4.2" /></svg>
                </button>
              </div>
            )}
            {problem && (
              <p className="pc-problem" role="alert">
                {problem}
              </p>
            )}
          </div>

          <p className="pc-note">
            Built only from the brand&rsquo;s own layouts, type and colours. Figures you didn&rsquo;t give are left blank to fill in, never made up.
          </p>

          <div className="pc-others">
            <button onClick={() => setStartBlank(true)} disabled={busy}>
              Start from a layout
            </button>
            <button onClick={() => setFromPdf(true)} disabled={busy}>
              Rebuild an existing PDF
            </button>
          </div>
        </>
      )}

      {startBlank && (
        <NewPresentation brand={initialBrand} createdBy={user?.name || 'Vigo team'} onCancel={() => setStartBlank(false)} onCreate={create} />
      )}
      {fromPdf && <PdfImport createdBy={user?.name || 'Vigo team'} onCancel={() => setFromPdf(false)} onCreate={create} />}
    </section>
  );
}

/** The planned deck, slide by slide, before anything is saved. */
function Outline({
  plan,
  approach,
  building,
  problem,
  onChange,
  onBack,
  onCreate,
}: {
  plan: Presentation;
  approach: string | null;
  building: number;
  problem: string | null;
  onChange: (p: Presentation) => void;
  onBack: () => void;
  onCreate: () => void;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const headline = (pg: Presentation['pages'][number]) => {
    for (const blocks of Object.values(pg.slots || {})) {
      for (const b of blocks || []) {
        if (b.type === 'text' && b.text && ['display', 'headline'].includes(b.style?.role || '')) return b.text;
      }
    }
    for (const blocks of Object.values(pg.slots || {})) for (const b of blocks || []) if (b.text) return b.text;
    return '';
  };
  const busy = building >= 0;
  return (
    <div className="pc-outline" aria-label="Proposed outline">
      <div className="pc-ohead">
        <p className="pc-kicker">Outline</p>
        <input
          className="pc-otitle"
          value={plan.title}
          aria-label="Presentation title"
          disabled={busy}
          onChange={(e) => onChange({ ...plan, title: e.target.value })}
        />
        <p className="pc-osub">
          {approach ? approach + ' ' : ''}
          {plan.pages.length} slides. Drag to reorder and remove what you don&rsquo;t need.
        </p>
      </div>
      <ol className="pc-olist">
        {plan.pages.map((pg, i) => (
          <li
            key={pg.id}
            draggable={!busy}
            className={drag === i ? 'dragging' : ''}
            onDragStart={() => setDrag(i)}
            onDragEnd={() => setDrag(null)}
            onDragOver={(e) => {
              e.preventDefault();
              if (drag === null || drag === i) return;
              const pages = [...plan.pages];
              const [m] = pages.splice(drag, 1);
              pages.splice(i, 0, m);
              setDrag(i);
              onChange({ ...plan, pages });
            }}
          >
            <span className="n">{i + 1}</span>
            <div className="mini">
              <Thumb page={pg} brand={plan.brand} />
            </div>
            <div className="txt">
              <b>{headline(pg) || getTemplate(pg.templateId)?.name}</b>
              <span>
                {pg.sectionStart ? pg.sectionStart + ', ' : ''}
                {getTemplate(pg.templateId)?.name}
              </span>
            </div>
            <button
              className="rm"
              aria-label={'Remove slide ' + (i + 1)}
              disabled={plan.pages.length <= 1 || busy}
              onClick={() => onChange({ ...plan, pages: plan.pages.filter((x) => x.id !== pg.id) })}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7" /></svg>
            </button>
          </li>
        ))}
      </ol>
      {problem && (
        <p className="pc-problem" role="alert">
          {problem}
        </p>
      )}
      <div className="pc-ofoot">
        <button className="pc-quiet" onClick={onBack} disabled={busy}>
          Change the brief
        </button>
        {busy ? (
          <ol className="pc-steps inline" aria-live="polite">
            {BUILD.map((s, i) => (
              <li key={s} className={i < building ? 'done' : i === building ? 'now' : ''}>
                <i aria-hidden />
                {s}
              </li>
            ))}
          </ol>
        ) : (
          <button className="pc-go" onClick={onCreate}>
            Build {plan.pages.length} slides
          </button>
        )}
      </div>
    </div>
  );
}

export type { BrandId };
