'use client';

export interface User {
  id?: string;
  name: string;
  email: string;
  org: string;
  role?: string;
}

export interface Backend {
  backend: 'postgres' | 'none';
  database: boolean;
  blob: boolean;
  secret: boolean;
  missing: string[];
}

const KEY = 'vigo.user.v1';

export const DEFAULT_USER: User = {
  name: 'Vigo Team',
  email: '',
  org: 'Vigo Importing Company',
};

let backendCache: Backend | null = null;

/**
 * Sign-in is required exactly when a shared backend is configured. Running
 * without one (a local review copy) keeps the open dashboard.
 */
export async function backendStatus(): Promise<Backend> {
  if (backendCache) return backendCache;
  try {
    const r = await fetch('/api/health', { cache: 'no-store' });
    backendCache = await r.json();
  } catch {
    backendCache = { backend: 'none', database: false, blob: false, secret: false, missing: [] };
  }
  return backendCache!;
}

export const authRequired = async () => (await backendStatus()).backend === 'postgres';

/** The signed-in user. Asks the server when there is one; otherwise local. */
export async function fetchUser(): Promise<User | null> {
  if (!(await authRequired())) return localUser() || DEFAULT_USER;
  try {
    const r = await fetch('/api/auth/me', { cache: 'no-store' });
    const data = await r.json();
    if (!data?.user) return null;
    return { ...data.user, org: 'Vigo Importing Company' };
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<{ user?: User; error?: string; firstTime?: boolean }> {
  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) return { error: data?.error || 'Sign-in failed.' };
    return { user: { ...data.user, org: 'Vigo Importing Company' }, firstTime: data.firstTime };
  } catch {
    return { error: 'Could not reach the server.' };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/* ---- local-only fallback, used when no backend is configured ----------- */

function localUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function currentUser(): User | null {
  return localUser() || DEFAULT_USER;
}

export function signIn(u: User) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(u));
  } catch {
    /* ignore */
  }
}

export function signOut() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
