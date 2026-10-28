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

const viaUs = (src: string) =>
  /^https?:\/\//.test(src) && !src.startsWith(location.origin) ? '/api/media/proxy?u=' + encodeURIComponent(src) : src;

/**
 * Pictures from the media library live on another site, and a browser will not
 * copy another site's pixels into a render: they came out black. Every picture
 * in the off-screen page is pointed at the same picture served from our own
 * address first, and a video is replaced by a still of its first frame.
 */
async function bringHome(el: HTMLElement) {
  el.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    const next = viaUs(src);
    if (next !== src) {
      img.removeAttribute('srcset');
      img.setAttribute('src', next);
    }
  });
  el.querySelectorAll<HTMLElement>('[style*="background-image"]').forEach((n) => {
    n.style.backgroundImage = n.style.backgroundImage.replace(/url\(["']?([^"')]+)["']?\)/g, (_m, u) => `url("${viaUs(u)}")`);
  });
  await Promise.all(
    Array.from(el.querySelectorAll('video')).map(
      (v) =>
        new Promise<void>((done) => {
          const src = v.currentSrc || v.getAttribute('src') || '';
          if (!src) return done();
          const probe = document.createElement('video');
          probe.muted = true;
          probe.crossOrigin = 'anonymous';
          probe.preload = 'auto';
          const finish = () => done();
          const timer = setTimeout(finish, 4000);
          probe.onloadeddata = () => {
            try {
              const c = document.createElement('canvas');
              c.width = probe.videoWidth;
              c.height = probe.videoHeight;
              c.getContext('2d')!.drawImage(probe, 0, 0);
              const still = document.createElement('img');
              still.src = c.toDataURL('image/jpeg', 0.8);
              still.className = v.className;
              still.setAttribute('style', v.getAttribute('style') || '');
              Object.assign(still.style, { width: '100%', height: '100%', objectFit: 'cover' });
              v.replaceWith(still);
            } catch {
              /* leave the video; it renders dark */
            }
            clearTimeout(timer);
            finish();
          };
          probe.onerror = () => (clearTimeout(timer), finish());
          probe.src = viaUs(src);
        })
    )
  );
}

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
      await new Promise((ok) => setTimeout(ok, 80));
      await bringHome(box);
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
