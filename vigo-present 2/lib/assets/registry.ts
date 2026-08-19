'use client';

import { useEffect, useState } from 'react';
import type { Asset, AssetCategory, MediaRef } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';
import { assetLibrary as placeholderLibrary } from './placeholders';

/**
 * BRAND ASSET REGISTRY — "replace once, updates everywhere"
 * ---------------------------------------------------------------------------
 * Photography lives in the repository under /assets/<brand>/<category>/, and is
 * described by /assets/manifest.json. A presentation NEVER stores a copy of an
 * image — it stores the asset's id. The URL is resolved at render time.
 *
 * Consequence: drop a new file over an old one (same path) and every page in
 * every presentation that uses it updates. Old versions do not accumulate,
 * because there was only ever one reference.
 *
 * If the manifest is missing or empty, the generated placeholder library is
 * used instead so the product still works before real photography lands.
 */

export interface AssetRecord {
  id: string;
  brand: BrandId;
  category: AssetCategory;
  name: string;
  /** repo-relative path, e.g. /assets/alessi/product/balsamic-front.jpg */
  path: string;
  kind?: 'image' | 'video';
  width?: number;
  height?: number;
}

let records: AssetRecord[] | null = null;
let byId: Record<string, AssetRecord> = {};
let loading: Promise<void> | null = null;
let usingPlaceholders = false;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((fn) => fn());
}

function indexRecords(list: AssetRecord[]) {
  records = list;
  byId = {};
  list.forEach((r) => (byId[r.id] = r));
}

export function ensureManifest(): Promise<void> {
  if (records) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    try {
      const res = await fetch('/assets/manifest.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('no manifest');
      const data = await res.json();
      const list: AssetRecord[] = Array.isArray(data) ? data : data.assets || [];
      if (list.length === 0) throw new Error('empty manifest');
      indexRecords(list);
      usingPlaceholders = false;
    } catch {
      // No real library yet — fall back to the generated placeholder plates.
      indexRecords(
        placeholderLibrary().map((a: Asset) => ({
          id: a.id,
          brand: a.brand,
          category: a.category,
          name: a.name,
          path: a.url,
          kind: 'image' as const,
          width: a.width,
          height: a.height,
        }))
      );
      usingPlaceholders = true;
    }
    notify();
  })();
  return loading;
}

/** Re-renders the calling component once the manifest has loaded. */
export function useAssetRegistry(): { ready: boolean; placeholders: boolean } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    subscribers.add(fn);
    ensureManifest();
    return () => {
      subscribers.delete(fn);
    };
  }, []);
  return { ready: records !== null, placeholders: usingPlaceholders };
}

export function allAssets(): AssetRecord[] {
  return records || [];
}

export function assetsFor(brand: BrandId, category: AssetCategory | 'All'): AssetRecord[] {
  return allAssets().filter((a) => a.brand === brand && (category === 'All' || a.category === category));
}

export function assetPath(id?: string): string | undefined {
  if (!id) return undefined;
  return byId[id]?.path;
}

export function isPlaceholderLibrary(): boolean {
  return usingPlaceholders;
}

/**
 * The single place a media URL is resolved.
 * An asset id always wins over a stored url, so replacing the file in the
 * repository is enough to update every presentation.
 */
export function mediaUrl(media?: MediaRef): string {
  if (!media) return '';
  const fromRegistry = assetPath(media.assetId);
  return fromRegistry || media.url || '';
}
