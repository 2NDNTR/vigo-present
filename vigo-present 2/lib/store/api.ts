'use client';

import type { Presentation, PresentationVersion } from '@/lib/model/types';
import type { Store } from './types';

async function j(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } });
  if (!r.ok) throw new Error(await r.text());
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
    return (await j('/api/public/' + slug)).presentation as Presentation;
  },
  async save(p) {
    await j('/api/presentations', { method: 'POST', body: JSON.stringify(p) });
  },
  async remove(id) {
    await j('/api/presentations/' + id, { method: 'DELETE' });
  },
  async versions(): Promise<PresentationVersion[]> {
    return [];
  },
  async snapshot() {
    /* server-side version history is P1 */
  },
  async restore() {
    return null;
  },
};
