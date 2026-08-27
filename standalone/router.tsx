'use client';

import React, { useEffect, useState } from 'react';

/**
 * Minimal hash router used by the standalone single-file build.
 * It stands in for next/navigation so the exact same components run
 * unchanged in the Next.js app and in the portable bundle.
 */

type Listener = (path: string) => void;
const listeners: Listener[] = [];

export function currentPath(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h || '/dashboard';
}

export function navigate(path: string, replace = false) {
  if (replace) window.location.replace('#' + path);
  else window.location.hash = path;
}

/** Stable identity, exactly like next/navigation's router. */
const ROUTER = {
  push: (p: string) => navigate(p),
  replace: (p: string) => navigate(p, true),
  back: () => window.history.back(),
  forward: () => window.history.forward(),
  refresh: () => {},
  prefetch: () => {},
};

export function useRouter() {
  return ROUTER;
}

export function usePathname() {
  const [p, setP] = useState(typeof window === 'undefined' ? '/dashboard' : currentPath());
  useEffect(() => {
    const on = () => setP(currentPath());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return p;
}

export function redirect(p: string) {
  navigate(p, true);
}

export function useRoute() {
  const [path, setPath] = useState(typeof window === 'undefined' ? '/dashboard' : currentPath());
  useEffect(() => {
    const on = () => {
      setPath(currentPath());
      listeners.forEach((l) => l(currentPath()));
    };
    window.addEventListener('hashchange', on);
    if (!window.location.hash) window.location.replace('#/dashboard');
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
}
