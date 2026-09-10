'use client';

/**
 * READING A PDF
 * ---------------------------------------------------------------------------
 * This module does no interpretation. Its only job is to turn a PDF into an
 * honest description of what is physically on each page — runs of text with
 * their position and size, and the pictures — so that `interpret.ts` can make
 * design decisions from evidence rather than guesswork.
 *
 * It runs in the browser on purpose. PDF.js needs a canvas to decode embedded
 * images, the browser has one, and a sixty-page deck parsed server-side would
 * sit against the serverless time limit for no benefit. Nothing is uploaded
 * until the user has seen what the deck is going to be.
 *
 * Coordinates are normalised to 0..1 of the page box, so a run's position means
 * the same thing whether the source was US Letter, A4 or 16:9 slides. Font size
 * is normalised the same way — against page height, not points — because "the
 * biggest thing on this page" is the signal that matters, and a 44pt title on a
 * slide and a 24pt title on a letter page play the same role.
 */

export interface TextRun {
  text: string;
  /** left edge, 0..1 across the page */
  x: number;
  /** baseline, 0..1 down the page (0 = top) */
  y: number;
  /** rendered width, 0..1 of page width */
  w: number;
  /** cap height as a fraction of page height — the size signal */
  size: number;
  bold: boolean;
  italic: boolean;
}

export interface ExtractedImage {
  /** PNG bytes, ready to upload */
  blob: Blob;
  width: number;
  height: number;
  /** where it sat on the page, 0..1 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** fraction of the page this image covers */
  coverage: number;
}

export interface ExtractedPage {
  index: number;
  /** page aspect ratio, width / height */
  aspect: number;
  runs: TextRun[];
  images: ExtractedImage[];
  /**
   * True when the page carries essentially no selectable text. Almost always
   * means the slide was flattened to a picture before export, and there is
   * nothing to rebuild from — the caller should say so rather than emit an
   * empty page.
   */
  flattened: boolean;
}

export interface ExtractProgress {
  page: number;
  pages: number;
  stage: 'text' | 'images';
}

type PdfjsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfjsModule> | null = null;

/**
 * PDF.js prefers a worker so parsing does not freeze the tab. Bundlers resolve
 * `new URL(..., import.meta.url)` into a real asset; if that fails for any
 * reason we fall through to the main thread rather than refusing the file —
 * slower, but the user gets their deck.
 */
async function pdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const mod = await import('pdfjs-dist');
      try {
        mod.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();
      } catch {
        /* main thread it is */
      }
      return mod;
    })();
  }
  return pdfjsPromise;
}

const isBold = (font: string) => /bold|black|heavy|semibold|demi/i.test(font);
const isItalic = (font: string) => /italic|oblique/i.test(font);

export async function extractPdf(
  file: File,
  onProgress?: (p: ExtractProgress) => void
): Promise<ExtractedPage[]> {
  const pdfjsLib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;

  const out: ExtractedPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress?.({ page: i, pages: doc.numPages, stage: 'text' });
    const page = await doc.getPage(i);
    const view = page.getViewport({ scale: 1 });
    const pw = view.width;
    const ph = view.height;

    /* ------------------------------------------------------------- text -- */
    const content = await page.getTextContent();
    const runs: TextRun[] = [];
    for (const item of content.items as any[]) {
      const text: string = (item.str || '').replace(/\s+/g, ' ');
      if (!text.trim()) continue;
      const tr = item.transform as number[];
      // transform is [a,b,c,d,e,f]; d carries the vertical scale, which is the
      // font's rendered size. e,f are the baseline origin in PDF space, whose
      // origin is bottom-left — hence the flip.
      const size = Math.abs(tr[3]) || Math.abs(tr[0]) || 0;
      const font: string = item.fontName || '';
      const styles = (content as any).styles || {};
      const fontName: string = styles[font]?.fontFamily || font;
      runs.push({
        text,
        x: tr[4] / pw,
        y: 1 - tr[5] / ph,
        w: (item.width || 0) / pw,
        size: size / ph,
        bold: isBold(fontName),
        italic: isItalic(fontName),
      });
    }

    /* ----------------------------------------------------------- images -- */
    onProgress?.({ page: i, pages: doc.numPages, stage: 'images' });
    let images: ExtractedImage[] = [];
    try {
      images = await pageImages(page, pw, ph);
    } catch {
      images = [];
    }

    const typed = runs.reduce((n, r) => n + r.text.trim().length, 0);
    out.push({
      index: i,
      aspect: pw / ph,
      runs,
      images,
      // Raw signal only: a page with no text objects at all. The judgement that
      // matters — a page whose only text was the running footer — needs the
      // whole document in view and is made in interpret.ts.
      flattened: typed === 0,
    });
    page.cleanup();
  }

  doc.destroy();
  return out;
}

/**
 * Pulls the bitmaps a page paints. PDF.js exposes them through the operator
 * list: every `paintImageXObject` names an object we can fetch and draw.
 *
 * Tiny images are dropped. A deck exported from PowerPoint is full of 20px
 * bullet glyphs, rule fragments and gradient swatches, and letting those into
 * the asset library would bury the photography the user actually wants.
 */
async function pageImages(page: any, pw: number, ph: number): Promise<ExtractedImage[]> {
  const ops = await page.getOperatorList();
  const pdfjsLib = await pdfjs();
  const OPS = (pdfjsLib as any).OPS;

  const found: ExtractedImage[] = [];
  const seen = new Set<string>();
  // The transform stack tells us where on the page each bitmap lands.
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];

  const mul = (a: number[], b: number[]) => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm.slice());
    else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
      const name = args[0];
      if (seen.has(name)) continue;
      seen.add(name);
      const obj = await new Promise<any>((res) => {
        try {
          page.objs.get(name, res);
        } catch {
          res(null);
        }
      }).catch(() => null);
      if (!obj) continue;

      const blob = await bitmapToPng(obj);
      if (!blob) continue;

      // A painted image occupies the unit square under the current transform.
      const w = Math.abs(ctm[0]) / pw;
      const h = Math.abs(ctm[3]) / ph;
      const x = ctm[4] / pw;
      const y = 1 - (ctm[5] + Math.abs(ctm[3])) / ph;
      const width = obj.width || 0;
      const height = obj.height || 0;

      // Below roughly 160px in either direction it is furniture, not a picture.
      if (width < 160 || height < 160) continue;

      found.push({
        blob,
        width,
        height,
        x,
        y,
        w,
        h,
        coverage: Math.max(0, Math.min(1, w)) * Math.max(0, Math.min(1, h)),
      });
    }
  }

  return found.sort((a, b) => b.coverage - a.coverage);
}

/** Draws whatever PDF.js handed back onto a canvas and encodes it as PNG. */
async function bitmapToPng(obj: any): Promise<Blob | null> {
  const width: number = obj.width;
  const height: number = obj.height;
  if (!width || !height) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (typeof ImageBitmap !== 'undefined' && obj.bitmap instanceof ImageBitmap) {
    ctx.drawImage(obj.bitmap, 0, 0);
  } else if (obj.data) {
    // PDF.js hands back either RGBA or RGB depending on the source image.
    const src: Uint8ClampedArray = obj.data;
    const out = ctx.createImageData(width, height);
    const channels = src.length / (width * height);
    if (channels === 4) {
      out.data.set(src.subarray(0, out.data.length));
    } else if (channels === 3) {
      for (let i = 0, j = 0; i < src.length; i += 3, j += 4) {
        out.data[j] = src[i];
        out.data[j + 1] = src[i + 1];
        out.data[j + 2] = src[i + 2];
        out.data[j + 3] = 255;
      }
    } else {
      return null;
    }
    ctx.putImageData(out, 0, 0);
  } else {
    return null;
  }

  return new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
}
