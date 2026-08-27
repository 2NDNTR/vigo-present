'use client';

import type { Store } from './types';
import type { Presentation } from '@/lib/model/types';
import { localStore } from './local';
import { apiStore } from './api';
import { hydratePage } from '@/lib/templates/registry';

let resolved: Store | null = null;
let pending: Promise<Store> | null = null;

/**
 * Every presentation is brought up to date with the current templates on the
 * way out of storage. When a template gains a slot — a brand mark on the
 * closing pages, say — decks made before that change pick it up without anyone
 * rebuilding a page. This is the same principle as the brand tokens: change the
 * system, and everything ever made inherits the change.
 */
function hydrate(p: Presentation | null): Presentation | null {
  if (!p || !Array.isArray(p.pages)) return p;
  return { ...p, pages: p.pages.map(hydratePage) };
}

function wrap(store: Store): Store {
  return {
    ...store,
    kind: store.kind,
    async list() {
      return (await store.list()).map((p) => hydrate(p)!);
    },
    async get(id) {
      return hydrate(await store.get(id));
    },
    async getBySlug(slug) {
      return hydrate(await store.getBySlug(slug));
    },
  };
}

/**
 * Picks the persistence driver at runtime.
 *  - a Postgres connection configured on the server  -> shared backend
 *  - otherwise                                        -> browser-local storage
 * The rest of the application never knows the difference.
 */
export async function getStore(): Promise<Store> {
  if (resolved) return resolved;
  if (pending) return pending;
  pending = (async () => {
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      const data = await r.json();
      resolved = wrap(data?.backend === 'postgres' ? apiStore : localStore);
    } catch {
      resolved = wrap(localStore);
    }
    return resolved;
  })();
  return pending;
}

export function storeKindSync(): 'local' | 'api' | 'unknown' {
  return resolved ? resolved.kind : 'unknown';
}
