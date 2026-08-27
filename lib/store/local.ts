'use client';

import type { Presentation, PresentationVersion } from '@/lib/model/types';
import { uid } from '@/lib/model/types';
import type { Store } from './types';
import { buildPresentation } from '@/lib/templates/starters';

/** localStorage is not always available (file:// origins, private mode). */
const mem: Record<string, string> = {};
const LS = {
  get(k: string): string | null {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return k in mem ? mem[k] : null;
    }
  },
  set(k: string, v: string) {
    try {
      window.localStorage.setItem(k, v);
    } catch (e: any) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) throw e;
      mem[k] = v;
    }
  },
  remove(k: string) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      delete mem[k];
    }
  },
};

const KEY = 'vigo.presentations.v1';
const VKEY = 'vigo.versions.v1';
const SEEDED = 'vigo.seeded.v1';

function readAll(): Record<string, Presentation> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(LS.get(KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, Presentation>) {
  try {
    LS.set(KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Storage full — trim large images.', e);
    throw new Error('STORAGE_FULL');
  }
}

function readVersions(): PresentationVersion[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(LS.get(VKEY) || '[]');
  } catch {
    return [];
  }
}

function seedIfEmpty() {
  if (typeof window === 'undefined') return;
  if (LS.get(SEEDED)) return;
  const map = readAll();
  if (Object.keys(map).length === 0) {
    const a = buildPresentation({
      title: '2027 Publix Sales Presentation',
      brand: 'alessi',
      starterId: 'retail',
      createdBy: 'Frank DiPinto',
    });
    a.status = 'published';
    a.updatedAt = Date.now() - 1000 * 60 * 60 * 6;
    const b = buildPresentation({
      title: 'Summer of Sauce — Campaign Recap',
      brand: 'vigo',
      starterId: 'recap',
      createdBy: 'Frank DiPinto',
    });
    b.updatedAt = Date.now() - 1000 * 60 * 60 * 30;
    const c = buildPresentation({
      title: 'Vigo Importing Co. — Company Overview',
      brand: 'corporate',
      starterId: 'brand',
      createdBy: 'Frank DiPinto',
    });
    c.updatedAt = Date.now() - 1000 * 60 * 60 * 24 * 5;
    map[a.id] = a;
    map[b.id] = b;
    map[c.id] = c;
    try {
      writeAll(map);
    } catch {
      /* ignore */
    }
  }
  LS.set(SEEDED, '1');
}

export const localStore: Store = {
  kind: 'local',
  async list() {
    seedIfEmpty();
    return Object.values(readAll()).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async get(id) {
    seedIfEmpty();
    return readAll()[id] || null;
  },
  async getBySlug(slug) {
    seedIfEmpty();
    return Object.values(readAll()).find((p) => p.share?.slug === slug) || null;
  },
  async save(p) {
    const map = readAll();
    map[p.id] = { ...p, updatedAt: Date.now() };
    writeAll(map);
  },
  async remove(id) {
    const map = readAll();
    delete map[id];
    writeAll(map);
  },
  async versions(id) {
    return readVersions()
      .filter((v) => v.presentationId === id)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  async snapshot(p, label) {
    const all = readVersions();
    all.push({
      id: uid('ver'),
      presentationId: p.id,
      createdAt: Date.now(),
      label,
      snapshot: JSON.parse(JSON.stringify(p)),
    });
    // keep the last 20 per presentation
    const trimmed: PresentationVersion[] = [];
    const counts: Record<string, number> = {};
    all
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach((v) => {
        counts[v.presentationId] = (counts[v.presentationId] || 0) + 1;
        if (counts[v.presentationId] <= 20) trimmed.push(v);
      });
    try {
      LS.set(VKEY, JSON.stringify(trimmed));
    } catch {
      /* versions are best-effort */
    }
  },
  async restore(versionId) {
    const v = readVersions().find((x) => x.id === versionId);
    if (!v) return null;
    const map = readAll();
    map[v.snapshot.id] = { ...v.snapshot, updatedAt: Date.now() };
    writeAll(map);
    return map[v.snapshot.id];
  },
};
