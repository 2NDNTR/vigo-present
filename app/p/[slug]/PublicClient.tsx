'use client';

import { useEffect, useState } from 'react';
import Presenter from '@/components/present/Presenter';
import { getStore } from '@/lib/store';
import type { Presentation } from '@/lib/model/types';

export default function PublicClient({ slug }: { slug: string }) {
  const [p, setP] = useState<Presentation | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'locked' | 'unpublished'>('loading');
  const [pw, setPw] = useState('');

  useEffect(() => {
    getStore()
      .then((s) => s.getBySlug(slug))
      .then((res) => {
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
          onSubmit={(e) => {
            e.preventDefault();
            if (pw === p?.share.password) setState('ok');
          }}
          style={{ display: 'flex', gap: 8 }}
        >
          <input className="field" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" type="password" />
          <button className="btn primary" type="submit">Enter</button>
        </form>
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
