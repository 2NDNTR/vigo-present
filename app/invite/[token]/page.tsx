'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import '../../login/login.css';

/** Accepting an invite: choose a password, and you are in. */
export default function InvitePage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [who, setWho] = useState<{ email: string; name: string } | null>(null);
  const [problem, setProblem] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/invite?token=' + encodeURIComponent(token), { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) setProblem(j.error || 'This invite link does not work.');
        else {
          setWho(j);
          setName(j.name || '');
        }
      })
      .catch(() => setProblem('Could not reach the server. Try again in a moment.'));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Choose a password of at least 8 characters.');
    if (password !== confirm) return setError('The two passwords are different.');
    setBusy(true);
    const r = await fetch('/api/auth/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, password, name }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(j.error || 'That did not work.');
    router.replace('/');
  };

  return (
    <main className="signin-main" style={{ minHeight: '100vh' }}>
      <div className="signin-form">
        {problem ? (
          <>
            <h1>Invite link</h1>
            <p className="signin-help">{problem}</p>
            <a className="btn" href="/login">Go to sign in</a>
          </>
        ) : !who ? (
          <p className="signin-help">Checking your invite…</p>
        ) : (
          <>
            <h1>Join Vigo Presents</h1>
            <p className="signin-help">
              Choose a password for <b>{who.email}</b>. You&rsquo;ll use it to sign in from now on.
            </p>
            <form onSubmit={submit}>
              <div style={{ marginBottom: 12 }}>
                <div className="label" style={{ marginBottom: 6 }}>Your name</div>
                <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              <input type="email" value={who.email} autoComplete="username" readOnly hidden />
              <div style={{ marginBottom: 12 }}>
                <div className="label" style={{ marginBottom: 6 }}>Password</div>
                <input
                  className="field"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <div className="label" style={{ marginBottom: 6 }}>Password again</div>
                <input className="field" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              {error && (
                <div className="warn" style={{ marginBottom: 14 }}>
                  <span>△</span>
                  <span>{error}</span>
                </div>
              )}
              <button className="btn primary lg" style={{ width: '100%', justifyContent: 'center' }} type="submit" disabled={busy}>
                {busy ? 'Setting up…' : 'Set password and continue'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
