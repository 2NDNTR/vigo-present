'use client';

import { useRef, useState } from 'react';
import { BRAND_ORDER, THEMES } from '@/lib/brand/themes';
import type { BrandId } from '@/lib/brand/themes';
import type { Presentation } from '@/lib/model/types';
import { slugify, uid } from '@/lib/model/types';
import { extractPdf } from '@/lib/pdf/extract';
import type { ExtractedImage } from '@/lib/pdf/extract';
import { interpret } from '@/lib/pdf/interpret';
import type { PageReading } from '@/lib/pdf/interpret';
import { compose } from '@/lib/pdf/compose';
import type { ComposedPage } from '@/lib/pdf/compose';
import { uploadShared } from '@/lib/assets/sharedUpload';
import { refreshShared } from '@/lib/assets/registry';
import { getTemplate } from '@/lib/templates/registry';

/**
 * BUILDING A DECK FROM A PDF
 * ---------------------------------------------------------------------------
 * Three steps, and the middle one is the point: the user sees what each page
 * was judged to be BEFORE anything is created. A tool that silently produces
 * thirty pages is impossible to trust; a tool that says "page 7 looked like
 * three figures, so it is a metric layout" can be corrected in a glance.
 *
 * Nothing leaves the browser until the user presses create. The PDF itself is
 * never uploaded — only the pictures pulled out of it, and only once the user
 * has agreed to the deck.
 */

type Phase = 'pick' | 'reading' | 'review' | 'building';

export default function PdfImport({
  createdBy,
  onCancel,
  onCreate,
}: {
  createdBy: string;
  onCancel: () => void;
  onCreate: (p: Presentation) => void;
}) {
  const [phase, setPhase] = useState<Phase>('pick');
  const [brand, setBrand] = useState<BrandId>('alessi');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<ComposedPage[]>([]);
  const [readings, setReadings] = useState<PageReading[]>([]);
  const [pictures, setPictures] = useState<ExtractedImage[]>([]);
  const [keepImages, setKeepImages] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const unreadable = pages.filter((p) => p.unreadable).length;

  async function read(file: File) {
    setError(null);
    setPhase('reading');
    try {
      setStatus('Opening the document…');
      const extracted = await extractPdf(file, (p) =>
        setStatus(`Reading page ${p.page} of ${p.pages}${p.stage === 'images' ? ' — pictures' : ''}…`)
      );
      if (!extracted.length) throw new Error('That PDF has no pages.');

      setStatus('Working out what each page is…');
      const readings = interpret(extracted);
      const composed = compose(readings, { brand });

      // Deduplicate: a logo or a background repeats on every page, and the
      // library does not want thirty copies of it.
      const unique = new Map<string, ExtractedImage>();
      for (const r of readings) {
        for (const img of r.images) {
          const key = `${img.width}x${img.height}:${img.blob.size}`;
          if (!unique.has(key)) unique.set(key, img);
        }
      }

      setPages(composed);
      setReadings(readings);
      setPictures(Array.from(unique.values()));
      if (!title.trim()) {
        const guess = readings.find((r) => r.display || r.headline);
        setTitle((guess?.display || guess?.headline || file.name.replace(/\.pdf$/i, '')).slice(0, 80));
      }
      setPhase('review');
    } catch (e: any) {
      setError(e?.message || 'That file could not be read.');
      setPhase('pick');
    }
  }

  async function build() {
    setPhase('building');
    setError(null);
    try {
      const resolved = new Map<ExtractedImage, { url: string; width?: number; height?: number }>();

      if (keepImages && pictures.length) {
        const base = slugify(title || 'import');
        const ids = new Map<ExtractedImage, string>();

        for (let i = 0; i < pictures.length; i++) {
          setStatus(`Filing picture ${i + 1} of ${pictures.length} in the library…`);
          const img = pictures[i];
          const name = `${base}-${i + 1}`;
          try {
            await uploadShared(new File([img.blob], `${name}.png`, { type: 'image/png' }), brand, 'Lifestyle');
            // uploadShared derives the id from brand + folder + filename, so we
            // can find each picture again without it having to tell us.
            ids.set(img, `${brand}-lifestyle-${name}`);
          } catch {
            /* one picture failing must not cost the user the whole deck */
          }
        }

        // One lookup for the whole batch, not one per picture.
        const urls = await assetUrls();
        ids.forEach((id, img) => {
          const url = urls.get(id);
          if (url) resolved.set(img, { url, width: img.width, height: img.height });
        });
        await refreshShared();
      }

      setStatus('Building the deck…');
      const composed = compose(readings, { brand, resolve: (img) => resolved.get(img) || null });

      const now = Date.now();
      onCreate({
        id: uid('pres'),
        orgId: 'vigo-importing',
        title: title.trim() || 'Imported Presentation',
        brand,
        status: 'draft',
        share: {
          slug: slugify(title || 'imported') + '-' + Math.random().toString(36).slice(2, 6),
          access: 'public',
          mode: 'scroll',
        },
        pages: composed.map((c) => c.page),
        createdBy,
        createdAt: now,
        updatedAt: now,
      });
    } catch (e: any) {
      setError(e?.message || 'The deck could not be built.');
      setPhase('review');
    }
  }

  return (
    <div className="scrim-modal" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-head">
          <div className="steps" style={{ marginBottom: 14 }}>
            {phase === 'review' ? 'Step 2 of 2' : 'Step 1 of 2'}
          </div>
          {phase !== 'review' ? (
            <>
              <h2>Build a deck from a PDF</h2>
              <p className="sub">
                Drop in a deck or a document. Every page is read, judged, and rebuilt in your
                templates — so what comes out is on brand, not a picture of someone else&rsquo;s slides.
              </p>
            </>
          ) : (
            <>
              <h2>Here&rsquo;s what I found</h2>
              <p className="sub">
                {pages.length} page{pages.length === 1 ? '' : 's'}. Check the reading before anything is
                created — you can change any layout afterwards.
              </p>
            </>
          )}
        </div>

        <div className="modal-body">
          {error && (
            <div className="banner" style={{ marginBottom: 12 }}>
              <b>That didn&rsquo;t work.</b> {error}
            </div>
          )}

          {phase === 'pick' && (
            <>
              <div className="label" style={{ marginBottom: 6 }}>
                Brand
              </div>
              {BRAND_ORDER.map((b) => {
                const t = THEMES[b];
                return (
                  <button key={b} className={'choice' + (brand === b ? ' on' : '')} onClick={() => setBrand(b)}>
                    <span
                      className="choice-swatch"
                      style={{
                        background: `linear-gradient(135deg, ${t.colors.brandPrimary} 0 50%, ${t.colors.cream} 50% 100%)`,
                      }}
                    />
                    <span>
                      <span className="choice-name" style={{ fontFamily: t.fonts.display }}>
                        {t.name}
                      </span>
                      <span className="choice-desc">{t.description}</span>
                    </span>
                  </button>
                );
              })}

              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) await read(f);
                }}
              />
              <div className="dropzone" style={{ marginTop: 14 }} onClick={() => fileRef.current?.click()}>
                <b>Choose a PDF</b>
                <span>Read in your browser — the file itself is never uploaded</span>
              </div>
            </>
          )}

          {(phase === 'reading' || phase === 'building') && (
            <div className="dropzone" style={{ minHeight: 160 }}>
              <b>{status}</b>
              <span>This can take a moment on a long document.</span>
            </div>
          )}

          {phase === 'review' && (
            <>
              <div className="label" style={{ marginBottom: 6 }}>
                Title
              </div>
              <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />

              {unreadable > 0 && (
                <div className="banner" style={{ marginTop: 12 }}>
                  <b>
                    {unreadable} page{unreadable === 1 ? '' : 's'} had no readable text.
                  </b>{' '}
                  Those slides were flattened to pictures before the PDF was made, so there is nothing
                  to rebuild from. They come through as full-bleed image pages — replace them by hand,
                  or ask for the original file.
                </div>
              )}

              {pictures.length > 0 && (
                <label
                  className="banner"
                  style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={keepImages}
                    onChange={(e) => setKeepImages(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <b>
                      Keep the {pictures.length} picture{pictures.length === 1 ? '' : 's'} in the library.
                    </b>{' '}
                    Filed under {THEMES[brand].shortName} → Lifestyle, so they are reusable in every
                    future deck. Untick to place them on the pages only.
                  </span>
                </label>
              )}

              <div style={{ marginTop: 14 }}>
                {pages.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '9px 0',
                      borderTop: i ? '1px solid rgba(0,0,0,.07)' : 'none',
                      alignItems: 'baseline',
                    }}
                  >
                    <span className="tiny" style={{ width: 28, flex: '0 0 auto', opacity: 0.6 }}>
                      {i + 1}
                    </span>
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        {getTemplate(p.templateId).name}
                      </span>
                      <span className="tiny" style={{ display: 'block', opacity: 0.7 }}>
                        {p.reason}
                        {p.notes.map((n) => ' · ' + n).join('')}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn ghost" onClick={onCancel} disabled={phase === 'building'}>
            Cancel
          </button>
          {phase === 'review' && (
            <button className="btn primary" onClick={build}>
              Create {pages.length} page{pages.length === 1 ? '' : 's'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Every asset id mapped to its stored URL, fetched once for the whole batch. */
async function assetUrls(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const res = await fetch('/api/assets', { cache: 'no-store' });
    if (!res.ok) return out;
    const data = await res.json();
    const list: any[] = data.assets || data || [];
    for (const a of list) if (a?.id && a?.url) out.set(a.id, a.url);
  } catch {
    /* the deck is still worth building without pictures */
  }
  return out;
}
