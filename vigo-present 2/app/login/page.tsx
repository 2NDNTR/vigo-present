'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signIn } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const go = (n: string, e: string) => {
    signIn({ name: n, email: e, org: 'Vigo Importing Company' });
    router.push('/dashboard');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div className="brandmark" style={{ marginBottom: 34 }}>
          <i />
          Vigo Present
        </div>
        <h1 style={{ fontSize: 30, letterSpacing: '-0.03em', margin: '0 0 8px', fontWeight: 600 }}>
          Sign in
        </h1>
        <p className="muted" style={{ margin: '0 0 26px', fontSize: 14.5, lineHeight: 1.5 }}>
          Internal tool for Vigo Importing Company. Single sign-on replaces this screen once the
          backend is connected.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            go(name.trim(), email.trim() || 'user@vigofoods.com');
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <div className="label" style={{ marginBottom: 6 }}>Name</div>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div className="label" style={{ marginBottom: 6 }}>Email</div>
            <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@vigofoods.com" />
          </div>
          <button className="btn primary lg" style={{ width: '100%', justifyContent: 'center' }} type="submit">
            Continue
          </button>
        </form>
        <button
          className="btn ghost sm"
          style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}
          onClick={() => go('Frank DiPinto', 'dipintofrank@gmail.com')}
        >
          Continue as Frank DiPinto
        </button>
      </div>
    </div>
  );
}
