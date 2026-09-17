'use client';

import type { AssetCategory } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';
import { CATEGORY_FOLDER, prettyName, slug } from './uploads';

/**
 * Uploads a file to the company's shared asset library.
 *
 * The browser sends the file straight to Blob storage rather than through the
 * app, so a 40 MB photograph or a video is not squeezed through a serverless
 * request. Once stored, the app records it in the database and it appears in
 * everyone's Assets panel.
 *
 * The asset id is derived from brand + category + filename. Re-uploading the
 * same filename REPLACES the picture everywhere it is used — which is the whole
 * point of the library.
 */
export interface StoredAsset {
  id: string;
  url: string;
  kind: 'image' | 'video';
  width?: number;
  height?: number;
}

export async function uploadShared(
  file: File,
  brand: BrandId,
  category: AssetCategory
): Promise<StoredAsset> {
  const { upload } = await import('@vercel/blob/client');

  const folder = CATEGORY_FOLDER[category] || 'misc';
  const base = slug(file.name);
  const ext = (file.name.match(/\.[^.]+$/) || ['.jpg'])[0].toLowerCase();
  const fileName = `${base}${ext}`;
  const pathname = `assets/${brand}/${folder}/${fileName}`;

  const dims = await measure(file);

  const blob = await upload(pathname, file, {
    access: 'public',
    handleUploadUrl: '/api/assets/upload',
    contentType: file.type || undefined,
  });

  const id = `${brand}-${folder}-${base}`;
  const kind: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';

  const res = await fetch('/api/assets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id,
      brand,
      category,
      name: prettyName(file.name),
      fileName,
      url: blob.url,
      kind,
      size: file.size,
      ...dims,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Could not save the asset record.');
  }
  return { id, url: blob.url, kind, ...dims };
}

/**
 * Lift a file that only exists in this browser into the shared library.
 *
 * The ids line up on purpose — both are derived from brand + folder + file
 * name — so publishing does not just add a copy: every page in every deck that
 * already points at that id starts resolving to the stored URL instead of to
 * something only this browser could see. A picture that was missing for
 * everyone else comes back for everyone at once, with nothing re-pointed.
 */
export async function publishUpload(a: {
  blob: Blob;
  fileName: string;
  type?: string;
  brand: BrandId;
  category: AssetCategory;
}): Promise<void> {
  const file = new File([a.blob], a.fileName, { type: a.type || a.blob.type || 'image/jpeg' });
  await uploadShared(file, a.brand, a.category);
}

export async function deleteShared(id: string): Promise<void> {
  const res = await fetch('/api/assets/' + encodeURIComponent(id), { method: 'DELETE' });
  if (!res.ok) throw new Error('Could not remove that asset.');
}

async function measure(file: File): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith('image/')) return {};
  try {
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    const out = { width: img.naturalWidth, height: img.naturalHeight };
    URL.revokeObjectURL(url);
    return out;
  } catch {
    return {};
  }
}
