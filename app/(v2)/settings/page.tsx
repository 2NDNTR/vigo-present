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
  invited?: boolean;
  last_seen: number | null;
}

/** Your account, and — for administrators — the people who can sign in. */
export default function Settings() {
  const { user, toast } = useApp();
  const isAdmin = user?.role === 'admin';
  const [people, setPeople] = useState<Member[] | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  /* the invite link just made, shown once so it can be copied and sent */
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);

  const share = async (who: string, url: string) => {
    setLink({ email: who, url });
    try {
      await navigator.clipboard.writeText(url);
      toast('Invite link copied. Send it to ' + who + '.');
    } catch {
      toast('Copy the invite link below and send it to ' + who + '.');
    }
  };

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
    const who = email;
    setEmail('');
    setName('');
    if (j.invite) await share(who, j.invite);
    else toast('They already have an account.');
    load();
  };

  const reset = async (m: Member) => {
    if (!confirm(`Reset ${m.email}'s password? Their current password stops working, and you get a link for them to set a new one.`)) return;
    const r = await fetch('/api/team', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: m.id }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) toast(j.error || 'Could not reset that password.');
    else await share(m.email, j.invite);
    load();
  };

  const reinvite = async (m: Member) => {
    const r = await fetch('/api/team', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: m.id, invite: true }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) toast(j.error || 'Could not make an invite link.');
    else await share(m.email, j.invite);
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
          Add someone and you get an invite link to send them. It works once and expires after 7 days. New people can
          edit every brand until an administrator narrows it.
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

        {link && (
          <div className="banner" style={{ marginBottom: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Invite link for {link.email}:</span>
            <code style={{ wordBreak: 'break-all', flex: '1 1 320px' }}>{link.url}</code>
            <button className="btn2 quiet" onClick={() => share(link.email, link.url)}>Copy</button>
            <button className="btn2 quiet" onClick={() => setLink(null)}>Done</button>
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
                  {m.role === 'admin' ? 'Administrator' : 'Editor'},{' '}
                  {m.active ? 'joined' : m.invited ? 'invited, not joined yet' : 'not invited yet'}
                </span>
                {isAdmin && m.id !== user?.id ? (
                  m.active ? (
                    <button className="btn2 quiet" onClick={() => reset(m)}>
                      Reset password
                    </button>
                  ) : (
                    <button className="btn2 quiet" onClick={() => reinvite(m)}>
                      Copy invite link
                    </button>
                  )
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
