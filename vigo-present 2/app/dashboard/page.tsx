'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Thumb from '@/components/ui/Thumb';
import NewPresentation from '@/components/NewPresentation';
import { getStore } from '@/lib/store';
import type { Presentation } from '@/lib/model/types';
import { uid, slugify } from '@/lib/model/types';
import { BRAND_ORDER, THEMES } from '@/lib/brand/themes';
import { currentUser, signOut } from '@/lib/auth';

const FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'vigo', label: 'Vigo' },
  { id: 'alessi', label: 'Alessi' },
  { id: 'corporate', label: 'Vigo Importing Co.' },
];

function ago(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const router = useRouter();
  const [items, setItems] = useState<Presentation[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [user, setUser] = useState<ReturnType<typeof currentUser>>(null);

  useEffect(() => {
    const u = currentUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
    getStore()
      .then((s) => s.list())
      .then(setItems)
      .catch(() => setItems([]));
  }, [router]);

  const reload = async () => {
    const s = await getStore();
    setItems(await s.list());
  };

  const shown = useMemo(
    () => (items || []).filter((p) => filter === 'all' || p.brand === filter),
    [items, filter]
  );

  const act = async (p: Presentation, action: string) => {
    const s = await getStore();
    setMenu(null);
    if (action === 'open') router.push('/e/' + p.id);
    if (action === 'preview') router.push('/present/' + p.id);
    if (action === 'duplicate') {
      const copy: Presentation = JSON.parse(JSON.stringify(p));
      copy.id = uid('pres');
      copy.title = p.title + ' (copy)';
      copy.status = 'draft';
      copy.createdAt = Date.now();
      copy.updatedAt = Date.now();
      copy.share = { ...p.share, slug: slugify(copy.title) + '-' + Math.random().toString(36).slice(2, 6) };
      copy.pages = copy.pages.map((pg) => ({ ...pg, id: uid('pg') }));
      await s.save(copy);
      await reload();
      router.push('/e/' + copy.id);
    }
    if (action === 'rename') {
      const name = window.prompt('Rename presentation', p.title);
      if (name) {
        await s.save({ ...p, title: name });
        await reload();
      }
    }
    if (action === 'delete') {
      if (window.confirm('Delete “' + p.title + '”? This cannot be undone.')) {
        await s.remove(p.id);
        await reload();
      }
    }
    if (action === 'share') {
      const hashRouted = window.location.hash.startsWith('#/');
      const link = window.location.origin + (hashRouted ? '/#/p/' : '/p/') + p.share.slug;
      await navigator.clipboard?.writeText(link).catch(() => {});
      window.alert(
        p.status === 'published'
          ? 'Live link copied to your clipboard.'
          : 'Link copied. This presentation is still a draft — publish it from the editor to make the link work.'
      );
    }
  };

  return (
    <div onMouseDown={() => setMenu(null)}>
      <header className="topbar">
        <div className="brandmark">
          <i />
          Vigo Present
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="tiny">{user?.name}</span>
          <button
            className="btn ghost sm"
            onClick={() => {
              signOut();
              router.push('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="wrap">
        <div className="dash-head">
          <div>
            <h1 className="dash-title">Presentations</h1>
            <p className="dash-sub">
              {user?.org} — every deck stays on brand automatically.
            </p>
          </div>
          <button className="btn primary lg" onClick={() => setCreating(true)}>
            + New Presentation
          </button>
        </div>

        <div className="filters">
          {FILTERS.map((f) => (
            <button key={f.id} className={'chip' + (filter === f.id ? ' on' : '')} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>

        {items === null ? (
          <div className="empty-state" style={{ marginTop: 32 }}>Loading…</div>
        ) : shown.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 32 }}>
            <div style={{ fontSize: 16, marginBottom: 8, color: 'var(--app-ink)' }}>Nothing here yet</div>
            <div style={{ marginBottom: 20 }}>Create your first presentation — it takes about a minute.</div>
            <button className="btn primary" onClick={() => setCreating(true)}>
              + New Presentation
            </button>
          </div>
        ) : (
          <div className="grid-cards">
            {shown.map((p) => (
              <div className="card" key={p.id}>
                <div className="card-thumb" onClick={() => router.push('/e/' + p.id)} style={{ cursor: 'pointer' }}>
                  <Thumb page={p.pages[0]} brand={p.brand} />
                </div>
                <div className={'card-actions' + (menu === p.id ? ' open' : '')}>
                  <button
                    className="icon-btn"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setMenu(menu === p.id ? null : p.id);
                    }}
                    aria-label="Actions"
                  >
                    ⋯
                  </button>
                  {menu === p.id && (
                    <div className="menu" onMouseDown={(e) => e.stopPropagation()}>
                      <button onClick={() => act(p, 'open')}>Open</button>
                      <button onClick={() => act(p, 'preview')}>Preview</button>
                      <button onClick={() => act(p, 'duplicate')}>Duplicate</button>
                      <button onClick={() => act(p, 'rename')}>Rename</button>
                      <button onClick={() => act(p, 'share')}>Copy share link</button>
                      <button className="danger" onClick={() => act(p, 'delete')}>Delete</button>
                    </div>
                  )}
                </div>
                <div className="card-meta">
                  <h3 className="card-name">{p.title}</h3>
                  <div className="card-line">
                    <span>{THEMES[p.brand].shortName}</span>
                    <span className="dot" />
                    <span>{p.pages.length} pages</span>
                    <span className="dot" />
                    <span>{ago(p.updatedAt)}</span>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className={'pill ' + (p.status === 'published' ? 'live' : 'draft')}>
                      {p.status === 'published' ? 'Live' : p.status === 'unpublished' ? 'Unpublished' : 'Draft'}
                    </span>
                    {p.locked && <span className="pill">Locked</span>}
                    <span className="tiny">{p.createdBy}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <NewPresentation
          createdBy={user?.name || 'Vigo team'}
          onCancel={() => setCreating(false)}
          onCreate={async (p) => {
            const s = await getStore();
            await s.save(p);
            router.push('/e/' + p.id);
          }}
        />
      )}
    </div>
  );
}
