'use client';

import { useEffect, useRef, useState } from 'react';
import type { MediaRef, Page, Presentation } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';
import { deckForModel, layoutsForModel, type Applied, type DeckOp, type DeckReply, type Material } from '@/lib/ingest/sidekick';
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
  /** the deck as it was before this turn's edits, for Undo */
  before?: Presentation;
  undone?: boolean;
}

let seq = 0;

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
  onApply,
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
  /** applies the operations to the deck through the editor's normal update (undo stack, autosave) */
  onApply: (ops: DeckOp[], m: Material) => Applied | undefined;
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
    try {
      const r = await fetch('/api/assist/deck', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          presentationId: presentation.id,
          request,
          deck: deckForModel(presentation, page?.id || ''),
          layouts: layoutsForModel(),
          assets: library
            .slice(0, 120)
            .map((a) => `${a.id} — ${a.name}, ${a.category}`)
            .join('\n'),
          images: sent.map((a) => ({ id: a.id, dataUrl: a.dataUrl })),
          history: feed.filter((t) => !t.pending && !t.failed).map((t) => ({ role: t.role, text: t.text })),
        }),
      });
      const j: DeckReply & { error?: string } = await r.json().catch(() => ({ error: 'The reply could not be read.' }));
      if (!r.ok) {
        patch(aiId, { pending: false, failed: true, text: j.error || 'That could not be finished. Your deck is unchanged.' });
        return;
      }
      const ops = j.ops || [];
      if (!ops.length) {
        patch(aiId, { pending: false, text: j.reply || 'Nothing needed changing.' });
        return;
      }

      // attachments the assistant chose to place are stored in the brand's library first
      const placed = new Set<string>();
      ops.forEach((o) => {
        if (o.image) placed.add(o.image);
        (o.fills || []).forEach((f) => f.image && placed.add(f.image));
      });
      const uploaded: Record<string, MediaRef> = {};
      for (const a of sent) {
        if (!placed.has(a.id)) continue;
        try {
          const s = await uploadShared(a.file, deckBrand, 'Product Photography');
          uploaded[a.id] = { url: s.url, assetId: s.id, width: s.width, height: s.height, alt: a.file.name, focalX: 0.5, focalY: 0.5, zoom: 1 };
        } catch {
          /* storage unavailable: the words still apply, the picture is skipped */
        }
      }
      const media = (id: string): MediaRef | undefined => {
        if (uploaded[id]) return uploaded[id];
        const a = library.find((x) => x.id === id);
        if (!a) return undefined;
        const url = storableUrl(a);
        return url ? { url, assetId: a.id, width: a.width, height: a.height, alt: a.name, focalX: 0.5, focalY: 0.5, zoom: 1 } : undefined;
      };

      const before = JSON.parse(JSON.stringify(presentation)) as Presentation;
      await beforeEdit('Before: ' + (request || 'image request').slice(0, 70));
      const said = [...feed.filter((t) => t.role === 'you').map((t) => t.text), request].join('\n');
      const result = onApply(ops, { media, said, sawImage: sent.length > 0 });
      if (!result || !result.lines.length) {
        patch(aiId, {
          pending: false,
          text:
            (j.reply ? j.reply + ' ' : '') +
            'But nothing could be applied — it pointed at something that is not in this deck. Try naming the page.',
        });
        return;
      }
      if (result.focus) onFocusPage(result.focus);
      patch(aiId, { pending: false, text: j.reply || 'Done.', result, before });
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
