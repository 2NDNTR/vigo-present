'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authRequired, fetchUser } from '@/lib/auth';
import Brandmark from '@/components/ui/Brandmark';

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  last_seen: number | null;
}

export default function TeamPage() {
  const router = useRouter();
  const [users, setUsers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState('');

  const load = async () => {
    const r = await fetch('/api/team', { cache: 'no-store' });
    if (r.status === 401) return router.replace('/login');
    setUsers((await r.json()).users);
  };

  useEffect(() => {
    (async () => {
      if (!(await authRequired())) return router.replace('/dashboard');
      const u = await fetchUser();
      if (!u) return router.replace('/login');
      setMe(u);
      load();
    })();
  }, [router]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const r = await fetch('/api/team', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    if (!r.ok) return setError((await r.json())?.error || 'Could not add that person.');
    setEmail('');
    setName('');
    load();
  };

  return (
    <div>
      <header className="topbar">
        <Brandmark />
        <button className="btn ghost sm" onClick={() => router.push('/dashboard')}>
          Back to presentations
        </button>
      </header>

      <div className="wrap" style={{ maxWidth: 760 }}>
        <div className="dash-head">
          <div>
            <h1 className="dash-title">Team</h1>
            <p className="dash-sub">
              Everyone here can create and edit any presentation.
            </p>
          </div>
        </div>

        <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            className="field"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            className="field"
            type="email"
            placeholder="email@vigofoods.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1.4 }}
          />
          <button className="btn primary" type="submit">
            Add
          </button>
        </form>
        {error && (
          <div className="warn" style={{ marginBottom: 12 }}>
            <span>△</span>
            <span>{error}</span>
          </div>
        )}
        <p className="tiny" style={{ marginBottom: 26 }}>
          Adding someone does not send an email. Tell them to go to the sign-in page and enter this
          address with a password of their choosing — that becomes their password.
        </p>

        {users === null ? (
          <div className="empty-state">Loading…</div>
        ) : (
          <div style={{ paddingBottom: 80 }}>
            {users.map((u) => (
              <div
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '13px 2px',
                  borderBottom: '1px solid var(--app-line-soft)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 550 }}>{u.name || u.email}</div>
                  <div className="tiny">{u.email}</div>
                </div>
                <span className={'pill' + (u.active ? ' live' : '')}>
                  {u.active ? 'Active' : 'Not signed in yet'}
                </span>
                {u.role === 'admin' && <span className="pill">Admin</span>}
                {u.id !== me?.id && (
                  <button
                    className="btn ghost sm"
                    onClick={async () => {
                      if (!window.confirm(`Remove ${u.email}? They lose access immediately.`)) return;
                      await fetch('/api/team', {
                        method: 'DELETE',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ id: u.id }),
                      });
                      load();
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
