'use client';

export interface User {
  name: string;
  email: string;
  org: string;
}

const KEY = 'vigo.user.v1';

export function currentUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function signIn(u: User) {
  window.localStorage.setItem(KEY, JSON.stringify(u));
}

export function signOut() {
  window.localStorage.removeItem(KEY);
}
