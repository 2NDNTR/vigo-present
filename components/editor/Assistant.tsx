'use client';

import { useEffect, useRef, useState } from 'react';
import type { MediaRef, Page, Presentation } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';
import type { Applied } from '@/lib/ingest/sidekick';
import { allAssets, storableUrl } from '@/lib/assets/registry';
import { uploadShared } from '@/lib/assets/sharedUpload';

/**
 * THE ASSISTANT PANEL
 * ---------------------------------------------------------------------------
 * The whole right-hand side of the editor. There are no design controls in V2:
 * a page changes because somebody asked for it here. Each request is answered
 * by applying the edits straight away, listing exactly what changed (each line
 * takes you to its page), and offering Undo — and the deck as it stood before
 * is kept in History, so nothing the assistant does is final.
 *
 * Images can be attached (button, paste or drop). The assistant looks at them
 * as reference — a slide or a chart to rebuild — or uses them as photos.
 */

interface Attachment {
  id: string;
  file: File;
  preview: string;
  /** downscaled copy the model reads */
  dataUrl: string;
}

interface Turn {
  id: number;
  role: 'you' | 'ai';
  text: string;
  images?: string[];
  pending?: boolean;
  failed?: boolean;
  result?: Applied;
  /** what the agent did on the way, shown as it happens */
  steps?: string[];
  /** the deck as it was before this turn's edits, for Undo */
  before?: Presentation;
  undone?: boolean;
}

let seq = 0;

/** Swaps the agent's attachment placeholders for stored pictures; drops any that could not be stored. */
function resolveAttachments(pages: Page[], urls: Record<string, MediaRef>): Page[] {
  const fix = (m?: MediaRef) => {
    if (!m?.url?.startsWith('attachment:')) return m;
    const got = urls[m.url.slice('attachment:'.length)];
    return got ? { ...m, ...got } : undefined;
  };
  return pages.map((p) => {
    const np: Page = { ...p, slots: {} };
    Object.entries(p.slots).forEach(([k, list]) => {
      np.slots[k] = list
        .map((b) => (b.media ? { ...b, media: fix(b.media) } : b))
        .filter((b) => !(b.type === 'image' && b.media === undefined && p.slots[k].find((x) => x.id === b.id)?.media));
    });
    const bg: any = p.background;
    if (bg?.kind === 'image' && bg.media?.url?.startsWith('attachment:')) {
      const m = fix(bg.media);
      np.background = m ? { ...bg, media: m } : ({ kind: 'theme' } as Page['background']);
    }
    return np;
  });
}

async function downscale(file: File, max = 1568): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = bad;
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function suggestionsFor(page: Page | undefined, warnings: string[]): string[] {
  const out = warnings.slice(0, 1).map((w) => 'Fix this: ' + w.replace(/\.$/, '').toLowerCase());
  const has = (t: string) => page && Object.values(page.slots).flat().some((b) => b.type === t);
  if (has('metric')) out.push('Update the figures on this page.');
  out.push('Make the headline on this page sharper.');
  out.push('Add a page after this one about…');
  if (!has('image')) out.push('Rebuild this page from the image I attach.');
  return out.slice(0, 4);
}

export default function Assistant({
  presentation,
  page,
  warnings,
  prefill,
  onPrefillUsed,
  onApplyPages,
  onRestore,
  onFocusPage,
  beforeEdit,
  locked,
}: {
  presentation: Presentation;
  page: Page | undefined;
  warnings: string[];
  prefill?: string | null;
  onPrefillUsed: () => void;
  /** replaces the deck's pages through the editor's normal update (undo stack, autosave) */
  onApplyPages: (pages: Page[]) => void;
  onRestore: (snapshot: Presentation) => void;
  onFocusPage: (id: string) => void;
  /** flushes pending saves and records a version before a change */
  beforeEdit: (label: string) => Promise<void>;
  locked?: boolean;
}) {
  const [feed, setFeed] = useState<Turn[]>([]);
  const [ask, setAsk] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [feed]);

  useEffect(() => {
    if (!prefill) return;
    setAsk(prefill);
    onPrefillUsed();
    setTimeout(() => {
      const el = input.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      grow(el);
    }, 0);
  }, [prefill, onPrefillUsed]);

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const attach = async (list: FileList | File[]) => {
    const imgs = Array.from(list).filter((f) => f.type.startsWith('image/'));
    for (const f of imgs) {
      if (files.length >= 4) break;
      try {
        const dataUrl = await downscale(f);
        setFiles((cur) =>
          cur.length >= 4 ? cur : [...cur, { id: 'att' + (cur.length + 1), file: f, preview: URL.createObjectURL(f), dataUrl }]
        );
      } catch {
        /* not an image the browser can read */
      }
    }
  };

  const patch = (id: number, p: Partial<Turn>) => setFeed((f) => f.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const send = async (raw: string) => {
    const request = raw.trim();
    if ((!request && !files.length) || busy || locked) return;
    const sent = files;
    const youId = ++seq;
    const aiId = ++seq;
    setFeed((f) => [
      ...f,
      { id: youId, role: 'you', text: request, images: sent.map((a) => a.preview) },
      { id: aiId, role: 'ai', text: sent.length ? 'Looking at your image…' : 'Working on it…', pending: true },
    ]);
    setAsk('');
    setFiles([]);
    if (input.current) input.current.style.height = 'auto';
    setBusy(true);

    const deckBrand = presentation.brand as BrandId;
    const library = allAssets().filter((a) => a.brand === deckBrand && (a.kind || 'image') === 'image' && !a.local);
    const photos = library
      .map((a) => ({ id: a.id, name: a.name, category: a.category, url: storableUrl(a), width: a.width, height: a.height }))
      .filter((p) => p.url);
    const steps: string[] = [];
    try {
      const r = await fetch('/api/assist/deck', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          presentation,
          openPageId: page?.id || '',
          request,
          photos,
          images: sent.map((a) => ({ id: a.id, dataUrl: a.dataUrl })),
          history: feed.filter((t) => !t.pending && !t.failed).map((t) => ({ role: t.role, text: t.text })),
        }),
      });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}));
        patch(aiId, { pending: false, failed: true, text: j.error || 'That could not be finished. Your deck is unchanged.' });
        return;
      }

      // the agent's steps arrive one JSON line at a time
      let done: any = null;
      let failed = '';
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done: end } = await reader.read();
        if (value) buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === 'step') {
              steps.push(ev.text);
              patch(aiId, { steps: [...steps], text: ev.text + '…' });
            } else if (ev.type === 'done') done = ev;
            else if (ev.type === 'error') failed = ev.error;
          } catch {
            /* a partial line; the rest arrives next */
          }
        }
        if (end) break;
      }
      if (failed || !done) {
        patch(aiId, { pending: false, failed: true, steps, text: failed || 'The connection dropped. Your deck is unchanged.' });
        return;
      }
      if (!done.lines?.length) {
        patch(aiId, { pending: false, steps, text: done.reply || 'Nothing needed changing.' });
        return;
      }

      // attachments the agent placed on a page are stored in the brand library; the rest are only references
      const urls: Record<string, MediaRef> = {};
      for (const id of (done.placed || []) as string[]) {
        const a = sent.find((x) => x.id === id);
        if (!a) continue;
        try {
          const st = await uploadShared(a.file, deckBrand, 'Product Photography');
          urls[id] = { url: st.url, assetId: st.id, width: st.width, height: st.height, alt: a.file.name, focalX: 0.5, focalY: 0.5, zoom: 1 };
        } catch {
          /* storage unavailable: the picture is left out, the words still apply */
        }
      }
      const pages = resolveAttachments(done.pages as Page[], urls);

      const before = JSON.parse(JSON.stringify(presentation)) as Presentation;
      await beforeEdit('Before: ' + (request || 'image request').slice(0, 70));
      onApplyPages(pages);
      if (done.focus) onFocusPage(done.focus);
      patch(aiId, {
        pending: false,
        steps,
        text: done.reply || 'Done.',
        result: { lines: done.lines, skipped: done.skipped || 0, focus: done.focus },
        before,
      });
    } catch {
      patch(aiId, { pending: false, failed: true, text: 'The connection dropped. Your deck is unchanged.' });
    } finally {
      setBusy(false);
    }
  };

  const lastApplied = [...feed].reverse().find((t) => t.result && !t.undone)?.id;
  const chips = suggestionsFor(page, warnings);

  return (
    <section
      className={'asst' + (drag ? ' drag' : '')}
      aria-label="Assistant"
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes('Files')) {
          e.preventDefault();
          setDrag(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDrag(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files?.length) return;
        e.preventDefault();
        setDrag(false);
        attach(e.dataTransfer.files);
      }}
    >
      <div className="asst-feed" ref={feedRef}>
        {feed.length === 0 ? (
          <div className="asst-empty">
            <h3>What should change?</h3>
            <p>
              Say it the way you would to a colleague. The brand&rsquo;s layouts, type and colours are applied for you.
              Attach a screenshot or photo and the page is built from it.
            </p>
            <ul>
              <li>Engagement is at +55%.</li>
              <li>Add a page on the olive oil range after page 8.</li>
              <li>Rebuild page 6 from this screenshot.</li>
              <li>Use the kitchen counter photo on the hero page.</li>
            </ul>
          </div>
        ) : (
          feed.map((t) => (
            <div key={t.id} className={'asst-turn ' + t.role + (t.failed ? ' failed' : '')}>
              {t.images && t.images.length > 0 && (
                <div className="asst-thumbs">
                  {t.images.map((src, i) => (
                    <img key={i} src={src} alt="" />
                  ))}
                </div>
              )}
              {t.role === 'ai' && t.steps && t.steps.length > 0 && !t.pending && (
                <details className="asst-steps">
                  <summary>
                    {t.steps.length} {t.steps.length === 1 ? 'step' : 'steps'}
                  </summary>
                  <ol>
                    {t.steps.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ol>
                </details>
              )}
              {t.role === 'ai' && t.pending && t.steps && t.steps.length > 1 && (
                <ol className="asst-live">
                  {t.steps.slice(0, -1).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ol>
              )}
              {t.text && <div className={'asst-bubble' + (t.pending ? ' pending' : '')}>{t.text}</div>}
              {t.result && (
                <div className={'asst-changes' + (t.undone ? ' undone' : '')}>
                  <ul>
                    {t.result.lines.map((l, i) => (
                      <li key={i} className={l.caution ? 'caution' : ''}>
                        {l.pageId && !t.undone ? (
                          <button onClick={() => onFocusPage(l.pageId!)}>{l.text}</button>
                        ) : (
                          <span>{l.text}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {t.result.skipped > 0 && !t.undone && (
                    <p className="asst-note">
                      {t.result.skipped === 1 ? 'One change was' : t.result.skipped + ' changes were'} left out: a figure you
                      didn&rsquo;t give, or something not in this deck.
                    </p>
                  )}
                  {t.undone ? (
                    <p className="asst-note">Undone.</p>
                  ) : t.id === lastApplied && t.before ? (
                    <button
                      className="asst-undo"
                      onClick={() => {
                        onRestore(t.before!);
                        patch(t.id, { undone: true });
                      }}
                    >
                      Undo this
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="asst-foot">
        {!busy && feed.length < 2 && !ask && (
          <div className="asst-chips">
            {chips.map((c) => (
              <button
                key={c}
                onClick={() =>
                  c.endsWith('…') ? (setAsk(c.slice(0, -1)), setTimeout(() => input.current?.focus(), 0)) : send(c)
                }
              >
                {c}
              </button>
            ))}
          </div>
        )}
        <div className="asst-compose">
          {files.length > 0 && (
            <div className="asst-attached">
              {files.map((a) => (
                <span key={a.id}>
                  <img src={a.preview} alt="" />
                  <button
                    aria-label="Remove attachment"
                    onClick={() =>
                      setFiles((cur) => cur.filter((x) => x.id !== a.id).map((x, i) => ({ ...x, id: 'att' + (i + 1) })))
                    }
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            ref={input}
            rows={2}
            value={ask}
            disabled={busy || locked}
            placeholder={locked ? 'This presentation is locked.' : 'Ask for a change, or attach an image to build from'}
            onChange={(e) => {
              setAsk(e.target.value);
              grow(e.currentTarget);
            }}
            onPaste={(e) => {
              const imgs = Array.from(e.clipboardData.files || []).filter((f) => f.type.startsWith('image/'));
              if (imgs.length) {
                e.preventDefault();
                attach(imgs);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(ask);
              }
            }}
          />
          <div className="asst-actions">
            <button className="asst-attach" onClick={() => picker.current?.click()} disabled={busy || files.length >= 4} title="Attach an image">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M13.5 7.5 8 13a3.5 3.5 0 0 1-5-5l6-6a2.3 2.3 0 0 1 3.3 3.3L6.5 11.1a1.2 1.2 0 0 1-1.7-1.7L10 4.2" />
              </svg>
              Image
            </button>
            <input
              ref={picker}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) attach(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              className="asst-send"
              disabled={busy || locked || (!ask.trim() && !files.length)}
              onClick={() => send(ask)}
              aria-label="Send"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
