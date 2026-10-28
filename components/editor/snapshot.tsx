'use client';

import { createRoot } from 'react-dom/client';
import { toJpeg } from 'html-to-image';
import Stage from '@/components/render/Stage';
import type { Page } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';

/**
 * Renders pages off screen with the real renderer and photographs them, so
 * the assistant can look at what it made — overflowing type, mismatched
 * pictures — rather than reason about it from words alone.
 */
const W = 1200;

async function settle(el: HTMLElement) {
  try {
    await (document as any).fonts?.ready;
  } catch {
    /* fine */
  }
  const imgs = Array.from(el.querySelectorAll('img'));
  await Promise.race([
    Promise.all(imgs.map((i) => (i.complete ? null : new Promise((ok) => ((i.onload = ok), (i.onerror = ok)))))),
    new Promise((ok) => setTimeout(ok, 4000)),
  ]);
  await new Promise((ok) => setTimeout(ok, 250));
}

export async function snapshotPages(
  pages: Page[],
  brand: BrandId,
  retailer?: string
): Promise<{ pageId: string; dataUrl: string }[]> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, { position: 'fixed', left: '-20000px', top: '0', width: W + 'px', pointerEvents: 'none' });
  document.body.appendChild(host);
  const out: { pageId: string; dataUrl: string }[] = [];
  try {
    for (const p of pages) {
      const box = document.createElement('div');
      box.style.width = W + 'px';
      host.appendChild(box);
      const root = createRoot(box);
      root.render(<Stage page={p} brand={brand} retailer={retailer as any} mode="fixed" />);
      await new Promise((ok) => setTimeout(ok, 50));
      await settle(box);
      try {
        const dataUrl = await toJpeg(box, { quality: 0.78, pixelRatio: 0.8, backgroundColor: '#ffffff', cacheBust: false });
        if (dataUrl.length > 1000) out.push({ pageId: p.id, dataUrl });
      } catch {
        /* a page that cannot be photographed is simply not reviewed */
      }
      root.unmount();
      box.remove();
    }
  } finally {
    host.remove();
  }
  return out;
}
