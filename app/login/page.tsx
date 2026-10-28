'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authRequired, backendStatus, fetchUser, login } from '@/lib/auth';
import './login.css';
import { THEMES } from '@/lib/brand/themes';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  /* Recovery is folded away rather than absent: a reset link in plain sight on
   * a sign-in page is the thing people click instead of remembering, and this
   * one is only for the day somebody genuinely cannot get in. */
  const [stuck, setStuck] = useState(false);
  const [key, setKey] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    (async () => {
      if (!(await authRequired())) return router.replace('/');
      const s = await backendStatus();
      setMissing(s.missing || []);
      if (await fetchUser()) router.replace('/');
    })();
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await login(email.trim(), password);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.push('/');
  };

  const recover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNote('');
    setBusy(true);
    try {
      const r = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), key }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setError(j.error || 'That did not work.');
      else {
        setKey('');
        setPassword('');
        setStuck(false);
        setNote('Password cleared. Type the password you want from now on and sign in.');
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <aside className="signin-side">
        <div className="signin-mark">
          <i aria-hidden />
          Vigo Presents
        </div>
        <div>
          <p className="signin-line">Brand in. Story out.</p>
          <p className="signin-sub">
            Presentations for Vigo Importing Co., Vigo Foods and Alessi Foods, built on each brand&rsquo;s own
            layouts, type and photography.
          </p>
          <div className="signin-brands" aria-hidden>
            {(['corporate', 'vigo', 'alessi'] as const).map((b) => {
              const t = THEMES[b];
              const ground = b === 'vigo' ? t.colors.brandYellow : t.colors.cream;
              return (
                <span key={b} style={{ background: ground }}>
                  {t.logo.files?.primary ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logo.files.primary} alt="" />
                  ) : (
                    t.logo.text
                  )}
                </span>
              );
            })}
          </div>
        </div>
      </aside>
      <main className="signin-main">
      <div className="signin-form">
        <h1>Sign in</h1>
        <p className="signin-help">
          Use your work email. The first time you sign in, the password you choose becomes your password.
        </p>

        {missing.length > 0 && (
          <div className="banner" style={{ marginBottom: 18 }}>
            <b>Not configured yet.</b> Missing on the server: {missing.join(', ')}.
          </div>
        )}

        <form onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <div className="label" style={{ marginBottom: 6 }}>Email</div>
            <input
              className="field"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@vigofoods.com"
              autoFocus
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <div className="label" style={{ marginBottom: 6 }}>Password</div>
            <input
              className="field"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          {error && (
            <div className="warn" style={{ marginBottom: 14 }}>
              <span>△</span>
              <span>{error}</span>
            </div>
          )}

          {note && (
            <div className="banner" style={{ marginBottom: 14 }}>
              {note}
            </div>
          )}

          <button
            className="btn primary lg"
            style={{ width: '100%', justifyContent: 'center' }}
            type="submit"
            disabled={busy}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {stuck ? (
          <form onSubmit={recover} style={{ marginTop: 22 }}>
            <div className="label" style={{ marginBottom: 6 }}>Recovery key</div>
            <input
              className="field"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="The key set on the server"
            />
            <p className="tiny" style={{ margin: '8px 0 10px' }}>
              This clears the password on the account above so you can choose a new one — it never
              sets a password and never signs anyone in. The key is <code>ADMIN_RESET_KEY</code> in
              the project settings on the server; whoever runs this can add one.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" type="button" onClick={() => { setStuck(false); setError(''); }}>
                Back
              </button>
              <button
                className="btn primary"
                type="submit"
                disabled={busy || !email.trim() || !key}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {busy ? 'Working…' : 'Clear my password'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="tiny" style={{ marginTop: 16 }}>
              No account? Ask whoever set this up to add your email — it takes a moment and needs no
              invitation email.
            </p>
            <button
              className="btn ghost sm"
              style={{ marginTop: 10, padding: 0 }}
              onClick={() => { setStuck(true); setNote(''); setError(''); }}
            >
              Can&rsquo;t sign in?
            </button>
          </>
        )}
      </div>
      </main>
    </div>
  );
}
