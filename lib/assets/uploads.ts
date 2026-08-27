'use client';

import type { AssetCategory } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';

/**
 * UPLOADED ASSETS
 * ---------------------------------------------------------------------------
 * Photography and video dropped into the app from a person's desktop, filed by
 * brand and category exactly like the repository library.
 *
 * Stored as real files in IndexedDB — not as base64 inside the presentation —
 * so the reference rule still holds: a page points at an asset id, and the
 * picture it shows is whatever that id currently resolves to.
 *
 * IndexedDB is per-browser. Uploads are immediately usable by the person who
 * made them; `exportAll()` packages them for the repository so they become
 * permanent and visible to everyone. When a shared backend exists this module
 * is the only thing that changes.
 */

export interface UploadedAsset {
  id: string;
  brand: BrandId;
  category: AssetCategory;
  name: string;
  fileName: string;
  type: string;
  kind: 'image' | 'video';
  size: number;
  width?: number;
  height?: number;
  createdAt: number;
  blob: Blob;
}

const DB = 'vigo.assets';
const STORE = 'uploads';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((res, rej) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => res(req.result as T);
    req.onerror = () => rej(req.error);
  });
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'asset';

export const prettyName = (s: string) =>
  s
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Folder a file belongs in, matching the repository layout. */
export const CATEGORY_FOLDER: Record<string, string> = {
  'Product Photography': 'product',
  Lifestyle: 'lifestyle',
  Recipes: 'recipes',
  Retail: 'retail',
  Social: 'social',
  Packaging: 'packaging',
  Backgrounds: 'backgrounds',
  Logos: 'logos',
  Icons: 'icons',
};

export function assetPathFor(a: { brand: string; category: string; fileName: string }): string {
  return `/assets/${a.brand}/${CATEGORY_FOLDER[a.category] || 'misc'}/${a.fileName}`;
}

export async function listUploads(): Promise<UploadedAsset[]> {
  try {
    const all = await tx<UploadedAsset[]>('readonly', (s) => s.getAll());
    return (all || []).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
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

export async function addUpload(
  file: File,
  brand: BrandId,
  category: AssetCategory
): Promise<UploadedAsset> {
  const ext = (file.name.match(/\.[^.]+$/) || ['.jpg'])[0].toLowerCase();
  const base = slug(file.name);
  const folder = CATEGORY_FOLDER[category] || 'misc';
  const dims = await measure(file);
  const asset: UploadedAsset = {
    // The id encodes brand + folder + filename, so an upload and the same file
    // committed to the repository resolve to the SAME id — replacing one with
    // the other updates every page automatically.
    id: `${brand}-${folder}-${base}`,
    brand,
    category,
    name: prettyName(file.name),
    fileName: `${base}${ext}`,
    type: file.type,
    kind: file.type.startsWith('video/') ? 'video' : 'image',
    size: file.size,
    ...dims,
    createdAt: Date.now(),
    blob: file,
  };
  await tx('readwrite', (s) => s.put(asset));
  return asset;
}

export async function removeUpload(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

/* --------------------------------------------------------------------- zip */

function crc32(buf: Uint8Array): number {
  let c: number;
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Minimal store-only ZIP. No dependency, and the folder structure inside is
 * exactly what the repository expects, so the archive unzips straight over
 * public/assets/.
 */
export async function exportAll(assets: UploadedAsset[]): Promise<Blob> {
  const enc = new TextEncoder();
  const files: { name: Uint8Array; data: Uint8Array; crc: number; offset: number }[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;

  const push = (u: Uint8Array) => {
    chunks.push(u);
    offset += u.length;
  };
  const u16 = (n: number) => new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
  const u32 = (n: number) =>
    new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);

  for (const a of assets) {
    const folder = CATEGORY_FOLDER[a.category] || 'misc';
    const name = enc.encode(`assets/${a.brand}/${folder}/${a.fileName}`);
    const data = new Uint8Array(await a.blob.arrayBuffer());
    const crc = crc32(data);
    const start = offset;
    push(u32(0x04034b50));
    push(u16(20));
    push(u16(0));
    push(u16(0));
    push(u16(0));
    push(u16(0));
    push(u32(crc));
    push(u32(data.length));
    push(u32(data.length));
    push(u16(name.length));
    push(u16(0));
    push(name);
    push(data);
    files.push({ name, data, crc, offset: start });
  }

  const centralStart = offset;
  for (const f of files) {
    push(u32(0x02014b50));
    push(u16(20));
    push(u16(20));
    push(u16(0));
    push(u16(0));
    push(u16(0));
    push(u16(0));
    push(u32(f.crc));
    push(u32(f.data.length));
    push(u32(f.data.length));
    push(u16(f.name.length));
    push(u16(0));
    push(u16(0));
    push(u16(0));
    push(u16(0));
    push(u32(0));
    push(u32(f.offset));
    push(f.name);
  }
  const centralSize = offset - centralStart;

  push(u32(0x06054b50));
  push(u16(0));
  push(u16(0));
  push(u16(files.length));
  push(u16(files.length));
  push(u32(centralSize));
  push(u32(centralStart));
  push(u16(0));

  return new Blob(chunks as BlobPart[], { type: 'application/zip' });
}

/** The manifest entries for a set of uploads, ready to paste or commit. */
export function manifestFor(assets: UploadedAsset[]) {
  return assets.map((a) => ({
    id: a.id,
    brand: a.brand,
    category: a.category,
    name: a.name,
    path: assetPathFor(a),
    kind: a.kind,
    width: a.width,
    height: a.height,
  }));
}
