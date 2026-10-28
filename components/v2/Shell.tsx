'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authRequired, fetchUser, logout, type User } from '@/lib/auth';
import { brandLook } from './brandLook';

export interface BrandSummary {
  id: string;
  name: string;
  short_name: string;
  description: string;
  decks: number;
  live: number;
  assets: number;
  last_activity: number | null;
  role?: string;
}

interface AppState {
  user: User | null;
  brands: BrandSummary[] | null;
  refreshBrands: () => Promise<void>;
  toast: (msg: string) => void;
}

const Ctx = createContext<AppState>({
  user: null,
  brands: null,
  refreshBrands: async () => {},
  toast: () => {},
});
export const useApp = () => useContext(Ctx);

const NAV: { href: string; label: string; icon: React.ReactNode; match: (p: string) => boolean }[] = [
  { href: '/', label: 'Overview', icon: <IconHome />, match: (p) => p === '/' },
  { href: '/brands', label: 'Brands', icon: <IconBrands />, match: (p) => p.startsWith('/brands') },
  { href: '/presentations', label: 'Presentations', icon: <IconDecks />, match: (p) => p.startsWith('/presentations') },
  { href: '/media', label: 'Media library', icon: <IconMedia />, match: (p) => p.startsWith('/media') },
  { href: '/shared', label: 'Shared links', icon: <IconLink />, match: (p) => p.startsWith('/shared') },
  { href: '/framework', label: 'Design framework', icon: <IconFramework />, match: (p) => p.startsWith('/framework') },
  { href: '/settings', label: 'Settings', icon: <IconSettings />, match: (p) => p.startsWith('/settings') },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname() || '/';
  const [user, setUser] = useState<User | null>(null);
  const [brands, setBrands] = useState<BrandSummary[] | null>(null);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refreshBrands = useCallback(async () => {
    try {
      const r = await fetch('/api/brands', { cache: 'no-store' });
      if (r.status === 401) return router.replace('/login');
      const j = await r.json();
      setBrands(j.brands || []);
    } catch {
      setBrands([]);
    }
  }, [router]);

  useEffect(() => {
    (async () => {
      const gated = await authRequired();
      const u = await fetchUser();
      if (!u && gated) return router.replace('/login');
      setUser(u);
      setReady(true);
      if (gated) refreshBrands();
      else setBrands([]);
    })();
  }, [router, refreshBrands]);

  const toast = useCallback((msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote(null), 2600);
  }, []);

  const initials = (user?.name || user?.email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <Ctx.Provider value={{ user, brands, refreshBrands, toast }}>
      <div className="v2">
        <nav className="v2-nav" aria-label="Main">
          <Link href="/" className="mark">
            <i aria-hidden />
            Vigo Presents
          </Link>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="item" aria-current={n.match(path) ? 'page' : undefined}>
              {n.icon}
              <span>{n.label}</span>
            </Link>
          ))}
          {brands && brands.length > 0 && (
            <>
              <div className="brands-label">Your brands</div>
              {brands.map((b) => (
                <Link
                  key={b.id}
                  href={'/brands/' + b.id}
                  className="brand"
                  aria-current={path === '/brands/' + b.id ? 'page' : undefined}
                >
                  <span className="sw" style={{ background: brandLook(b.id).swatch }} />
                  {b.name}
                </Link>
              ))}
            </>
          )}
          <div className="navfoot">
            <div className="avatar" aria-hidden>
              {initials || '·'}
            </div>
            <div className="who">
              <b>{user?.name || user?.email || ' '}</b>
              <button
                onClick={async () => {
                  await logout();
                  router.push('/login');
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </nav>
        <main className="v2-main">{ready ? <div className="v2-page">{children}</div> : null}</main>
        {note && (
          <div className="toast" role="status">
            {note}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

/* Icons: 18px line glyphs, drawn here so the shell carries no icon library. */
function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
function IconHome() {
  return <Svg><path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></Svg>;
}
function IconBrands() {
  return <Svg><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><circle cx="17" cy="17" r="3.5" /></Svg>;
}
function IconDecks() {
  return <Svg><rect x="3" y="6" width="14" height="10" rx="2" /><path d="M7 19h12a2 2 0 0 0 2-2V9" /></Svg>;
}
function IconMedia() {
  return <Svg><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></Svg>;
}
function IconLink() {
  return <Svg><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></Svg>;
}
function IconFramework() {
  return <Svg><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></Svg>;
}
function IconSettings() {
  return <Svg><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Svg>;
}
