'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/components/v2/Shell';
import V1Import from '@/components/v2/V1Import';

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  last_seen: number | null;
}

/** Your account, and — for administrators — the people who can sign in. */
export default function Settings() {
  const { user, toast } = useApp();
  const isAdmin = user?.role === 'admin';
  const [people, setPeople] = useState<Member[] | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  const load = () =>
    fetch('/api/team', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setPeople(j.users || []))
      .catch(() => setPeople([]));
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    const r = await fetch('/api/team', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toast(j.error || 'Could not add that person.');
    setEmail('');
    setName('');
    toast('Added. Their first sign-in sets their password.');
    load();
  };

  const reset = async (m: Member) => {
    if (!confirm(`Clear ${m.email}'s password? Their next sign-in sets a new one.`)) return;
    const r = await fetch('/api/team', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: m.id }),
    });
    toast(r.ok ? 'Password cleared' : 'Could not clear that password.');
    load();
  };

  return (
    <>
      <div className="v2-head">
        <div>
          <h1 className="t-title">Settings</h1>
          <p className="t-small">Signed in as {user?.email}.</p>
        </div>
      </div>

      <section>
        <h2 className="t-section" style={{ marginBottom: 6 }}>
          People
        </h2>
        <p className="t-small" style={{ marginBottom: 18 }}>
          New people can edit every brand until an administrator narrows it. No invitation email is sent: tell them to
          sign in with their email, and the password they choose becomes theirs.
        </p>

        {isAdmin && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
            <input className="search" placeholder="Name" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ minWidth: 200 }} />
            <input
              className="search"
              placeholder="Email address"
              aria-label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn2 primary" onClick={add} disabled={!email.includes('@')}>
              Add person
            </button>
          </div>
        )}

        {people === null ? (
          <p className="t-small">Loading…</p>
        ) : (
          <div>
            {people.map((m) => (
              <div className="link-row" key={m.id} style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{m.name || m.email}</div>
                  <code>{m.email}</code>
                </div>
                <span className="t-small">
                  {m.role === 'admin' ? 'Administrator' : 'Editor'}, {m.active ? 'signed in before' : 'not signed in yet'}
                </span>
                {isAdmin && m.id !== user?.id ? (
                  <button className="btn2 quiet" onClick={() => reset(m)}>
                    Clear password
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      {isAdmin && <V1Import />}
    </>
  );
}
