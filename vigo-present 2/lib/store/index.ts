'use client';

import type { Store } from './types';
import { localStore } from './local';
import { apiStore } from './api';

let resolved: Store | null = null;
let pending: Promise<Store> | null = null;

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
      resolved = data?.backend === 'postgres' ? apiStore : localStore;
    } catch {
      resolved = localStore;
    }
    return resolved;
  })();
  return pending;
}

export function storeKindSync(): 'local' | 'api' | 'unknown' {
  return resolved ? resolved.kind : 'unknown';
}
