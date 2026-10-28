'use client';

import { useEffect, useState } from 'react';
import Presenter from '@/components/present/Presenter';
import { getStore } from '@/lib/store';
import type { Presentation } from '@/lib/model/types';

export default function PublicClient({ slug }: { slug: string }) {
  const [p, setP] = useState<Presentation | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'locked' | 'unpublished'>('loading');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      // The server is asked first, whatever this browser thinks the backend
      // is: it alone decides what a viewer may see. Only when it has no such
      // deck does a local copy of the app (no database) look in this browser.
      const r = await fetch('/api/public/' + encodeURIComponent(slug), { cache: 'no-store' }).catch(() => null);
      if (r && r.status === 401) {
        setState('locked');
        return undefined;
      }
      if (r && r.ok) return (await r.json()).presentation as Presentation;
      const s = await getStore();
      return s.kind === 'api' ? null : s.getBySlug(slug);
    })()
      .then((res) => {
        if (res === undefined) return;
        if (!res) return setState('missing');
        setP(res);
        if (res.status !== 'published') return setState('unpublished');
        if (res.share.access === 'password' && res.share.password) return setState('locked');
        setState('ok');
      })
      .catch(() => setState('missing'));
  }, [slug]);

  if (state === 'loading') return <Shell>Loading…</Shell>;
  if (state === 'missing')
    return (
      <Shell>
        <b style={{ display: 'block', marginBottom: 8 }}>This link isn&rsquo;t available.</b>
        It may have been unpublished, or it lives in a different workspace.
      </Shell>
    );
  if (state === 'unpublished')
    return (
      <Shell>
        <b style={{ display: 'block', marginBottom: 8 }}>Not published yet.</b>
        The owner needs to publish this presentation before the link goes live.
      </Shell>
    );
  if (state === 'locked')
    return (
      <Shell>
        <b style={{ display: 'block', marginBottom: 14 }}>This presentation is password protected.</b>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            // Local copies of the app (no backend) keep the old in-browser check.
            if (p?.share.password) {
              if (pw === p.share.password) setState('ok');
              else setError('That password is not right.');
              return;
            }
            setBusy(true);
            setError('');
            const r = await fetch('/api/public/' + encodeURIComponent(slug), {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ password: pw }),
            });
            const j = await r.json().catch(() => ({}));
            setBusy(false);
            if (r.ok && j.presentation) {
              setP(j.presentation);
              setState('ok');
            } else setError(j.error || 'That password is not right.');
          }}
          style={{ display: 'flex', gap: 8 }}
        >
          <input className="field" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" type="password" />
          <button className="btn primary" type="submit" disabled={busy || !pw}>
            {busy ? '…' : 'Enter'}
          </button>
        </form>
        {error && (
          <div role="alert" style={{ marginTop: 10, color: '#ffb4a6' }}>
            {error}
          </div>
        )}
      </Shell>
    );

  return <Presenter presentation={p!} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0b0b0d', color: '#e9e7e3', padding: 30 }}>
      <div style={{ maxWidth: 420, textAlign: 'center', fontSize: 14.5, lineHeight: 1.6, opacity: 0.85 }}>{children}</div>
    </div>
  );
}
