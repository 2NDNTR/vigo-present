'use client';

import { useEffect, useState } from 'react';
import Stage from '@/components/render/Stage';
import { getStore } from '@/lib/store';
import type { Presentation } from '@/lib/model/types';

/**
 * EXPORT AS PDF
 * ---------------------------------------------------------------------------
 * The browser makes the PDF, and that is a decision rather than a shortcut.
 *
 * The alternative — headless Chromium in a serverless function — means a
 * hundred-megabyte dependency, cold starts measured in seconds, a second copy
 * of the rendering stack to keep in step with this one, and a screenshot of
 * every page. Printing from the page the deck already renders gives:
 *
 *   - REAL TEXT. Selectable, searchable, and sharp at any zoom, because the
 *     type is vector in the PDF rather than pixels in a JPEG.
 *   - EXACT FIDELITY, permanently. There is one renderer, so a PDF cannot
 *     drift from the deck the way a second implementation always does.
 *   - Charts as vectors too, since they are SVG on the page.
 *
 * What it costs is one extra step for the person: the browser's print dialog,
 * where they choose "Save as PDF". Worth it, and the dialog opens by itself.
 *
 * Every page is laid out at exactly 13.333 x 7.5 inches — 16:9 at 96dpi, the
 * same shape as the slide — so a page break falls between slides and never
 * through one.
 */
export default function PrintClient({ id }: { id: string }) {
  const [p, setP] = useState<Presentation | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    getStore()
      .then((s) => s.get(id))
      .then((res) => {
        if (!res) return setState('missing');
        setP(res);
        setState('ready');
      })
      .catch(() => setState('missing'));
  }, [id]);

  /**
   * Waiting matters more here than anywhere else in the product: a print
   * dialog opened one frame too early produces a PDF of half-loaded
   * photographs and fallback type, and nobody notices until it is in front of
   * a buyer. So: fonts settled, every image decoded, then two frames for
   * layout, and only then the dialog.
   */
  useEffect(() => {
    if (state !== 'ready') return;
    let cancelled = false;

    const ready = async () => {
      try {
        await (document as any).fonts?.ready;
      } catch {
        /* a browser without the font API still prints; it just may not wait */
      }
      const images = Array.from(document.images);
      await Promise.all(
        images.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((done) => {
                img.addEventListener('load', () => done(), { once: true });
                img.addEventListener('error', () => done(), { once: true });
              })
        )
      );
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (!cancelled) window.print();
    };

    const t = window.setTimeout(ready, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [state]);

  if (state === 'missing') return <div style={{ padding: 60 }}>Not found.</div>;
  if (!p) return <div style={{ padding: 60, color: '#888' }}>Preparing the PDF…</div>;

  return (
    <div className="printroot">
      {/* On screen this bar explains what is about to happen; it is the first
          thing @media print removes. */}
      <div className="printbar">
        <b>{p.title}</b>
        <span>
          The print dialog opens on its own. Choose <b>Save as PDF</b>, keep <b>Landscape</b>, and turn on{' '}
          <b>Background graphics</b> so the colours print.
        </span>
        <button className="btn sm primary" onClick={() => window.print()}>Open print dialog</button>
      </div>

      {p.pages.map((page) => (
        <section className="printpage" key={page.id}>
          <Stage page={page} brand={p.brand} retailer={p.retailer} mode="fixed" />
        </section>
      ))}
    </div>
  );
}
