'use client';

import { useEffect, useState } from 'react';
import Presenter from '@/components/present/Presenter';
import { getStore } from '@/lib/store';
import type { Presentation } from '@/lib/model/types';
import type { PublicDeck, SharedResult } from '@/lib/server/shared';

/**
 * A view-only page: the deck and nothing else. No navigation, no links, no
 * way into the app. Everything about who may see it was settled on the server.
 */
export default function PublicClient({ slug, initial = null }: { slug: string; initial?: SharedResult | null }) {
  const [local, setLocal] = useState<Presentation | null | 'loading'>(initial ? null : 'loading');

  // No database: a local copy of the app keeps decks in this browser.
  useEffect(() => {
    if (initial) return;
    getStore()
      .then((s) => s.getBySlug(slug))
      .then((p) => setLocal(p && p.status === 'published' ? p : null))
      .catch(() => setLocal(null));
  }, [initial, slug]);

  if (!initial) {
    if (local === 'loading') return <Shell>Loading…</Shell>;
    if (!local) return <Missing />;
    return <Presenter presentation={local} />;
  }
  if (initial.state === 'password') return <PasswordGate slug={slug} />;
  if (initial.state === 'missing') return <Missing />;
  return <Presenter presentation={asPresentation(initial.deck)} />;
}

/** The presenter's shape, built only from what the server chose to send. */
function asPresentation(d: PublicDeck): Presentation {
  return {
    id: 'shared',
    orgId: '',
    title: d.title,
    brand: d.brand as Presentation['brand'],
    retailer: d.retailer as Presentation['retailer'],
    status: 'published',
    share: { slug: '', access: 'public', mode: d.layout === 'horizontal' ? 'horizontal' : 'scroll' },
    pages: d.pages as Presentation['pages'],
    createdBy: '',
    createdAt: 0,
    updatedAt: 0,
  };
}

function PasswordGate({ slug }: { slug: string }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Shell>
      <b style={{ display: 'block', marginBottom: 14 }}>This presentation is password protected.</b>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          const r = await fetch('/api/public/' + encodeURIComponent(slug), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ password: pw }),
          });
          if (r.ok) return window.location.reload();
          const j = await r.json().catch(() => ({}));
          setBusy(false);
          setError(j.error || 'That password is not right.');
        }}
        style={{ display: 'flex', gap: 8 }}
      >
        <input
          className="field"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          type="password"
          autoFocus
          aria-label="Password"
        />
        <button className="btn primary" type="submit" disabled={busy || !pw}>
          {busy ? '…' : 'Open'}
        </button>
      </form>
      {error && (
        <div role="alert" style={{ marginTop: 10, color: '#ffb4a6' }}>
          {error}
        </div>
      )}
    </Shell>
  );
}

function Missing() {
  return (
    <Shell>
      <b style={{ display: 'block', marginBottom: 8 }}>This link isn&rsquo;t available.</b>
      It may have been unpublished or replaced. Ask the person who sent it for a new one.
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0b0b0d', color: '#e9e7e3', padding: 30 }}>
      <div style={{ maxWidth: 420, textAlign: 'center', fontSize: 14.5, lineHeight: 1.6, opacity: 0.85 }}>{children}</div>
    </div>
  );
}
