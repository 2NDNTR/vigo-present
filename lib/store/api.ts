'use client';

import type { Presentation, PresentationVersion } from '@/lib/model/types';
import type { Store } from './types';

/** Raised when someone else saved the same deck first. */
export class ConflictError extends Error {
  latest: Presentation;
  constructor(message: string, latest: Presentation) {
    super(message);
    this.name = 'ConflictError';
    this.latest = latest;
  }
}

async function j(url: string, init?: RequestInit) {
  const r = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  });
  if (r.status === 401) throw new Error('SIGNED_OUT');
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    if (r.status === 409) throw new ConflictError(data.message || 'Changed elsewhere', data.presentation);
    throw new Error(data?.error || 'Request failed');
  }
  return r.json();
}

export const apiStore: Store = {
  kind: 'api',
  async list() {
    return (await j('/api/presentations')).presentations as Presentation[];
  },
  async get(id) {
    return (await j('/api/presentations/' + id)).presentation as Presentation;
  },
  async getBySlug(slug) {
    const r = await fetch('/api/public/' + slug, { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()).presentation as Presentation;
  },
  async save(p) {
    const res = await j('/api/presentations', { method: 'POST', body: JSON.stringify(p) });
    // hand the new version back so the next save is checked against it
    (p as any).version = res.version;
  },
  async remove(id) {
    await j('/api/presentations/' + id, { method: 'DELETE' });
  },
  async versions(): Promise<PresentationVersion[]> {
    return [];
  },
  async snapshot() {
    /* server-side history is a later step */
  },
  async restore() {
    return null;
  },
};
