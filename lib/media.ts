'use client';

export interface ProcessedMedia {
  url: string;
  kind: 'image' | 'video';
  width: number;
  height: number;
  lowRes: boolean;
  tooLarge: boolean;
}

const MAX_EDGE = 1800;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

/** Images are downscaled before they are stored so presentations stay light. */
export async function processFile(file: File): Promise<ProcessedMedia> {
  if (file.type.startsWith('video/')) {
    const url = await readAsDataUrl(file);
    return { url, kind: 'video', width: 0, height: 0, lowRes: false, tooLarge: file.size > 12 * 1024 * 1024 };
  }
  const raw = await readAsDataUrl(file);
  const img = document.createElement('img');
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = raw;
  });
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const lowRes = Math.max(w, h) < 900;
  if (Math.max(w, h) <= MAX_EDGE && file.size < 900 * 1024) {
    return { url: raw, kind: 'image', width: w, height: h, lowRes, tooLarge: false };
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, cw, ch);
  const url = c.toDataURL('image/jpeg', 0.84);
  return { url, kind: 'image', width: cw, height: ch, lowRes, tooLarge: url.length > 3_000_000 };
}

export function readDropped(e: React.DragEvent): { assetUrl?: string; file?: File } {
  const assetUrl = e.dataTransfer.getData('application/x-vigo-asset');
  if (assetUrl) return { assetUrl };
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  return { file: file || undefined };
}
