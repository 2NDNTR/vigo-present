'use client';

import { useState } from 'react';
import Portal from '@/components/ui/Portal';
import type { Presentation } from '@/lib/model/types';

export default function SharePanel({
  presentation,
  onChange,
  onClose,
  backend,
  onSetLocked,
}: {
  presentation: Presentation;
  onChange: (patch: Partial<Presentation>) => void;
  onClose: () => void;
  backend: 'local' | 'api' | 'unknown';
  onSetLocked?: (v: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [pw, setPw] = useState('');
  const [pwState, setPwState] = useState<'' | 'saving' | 'saved' | string>('');
  const [revoking, setRevoking] = useState(false);
  const locked = !!presentation.locked;
  // the static build is hash-routed; the Next app uses real paths
  const hashRouted = typeof window !== 'undefined' && window.location.hash.startsWith('#/');
  const publicPath = (hashRouted ? '/#/p/' : '/p/') + presentation.share.slug;
  const url = typeof window !== 'undefined' ? window.location.origin + publicPath : '';
  const share = presentation.share;

  const setShare = (patch: any) => onChange({ share: { ...share, ...patch } });

  return (
    <Portal>
    <div className="scrim-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <h2>Share</h2>
          <p className="sub">One link. Always current. No attachments, no re-sending.</p>
        </div>
        <div className="modal-body">
          <div className="label" style={{ marginBottom: 6 }}>Presentation link</div>
          <div className="sharefield" style={{ marginBottom: 6 }}>
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
            <button
              className="btn sm primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                } catch {}
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <p className="tiny" style={{ marginBottom: 18 }}>
            Edit a page and the live link updates. You never resend a deck for a typo.
          </p>

          <div className="label" style={{ marginBottom: 6 }}>Lock</div>
          <div className="seg" style={{ marginBottom: 6 }}>
            <button className={!locked ? 'on' : ''} onClick={() => onSetLocked && onSetLocked(false)}>
              Editable
            </button>
            <button className={locked ? 'on' : ''} onClick={() => onSetLocked && onSetLocked(true)}>
              Locked
            </button>
          </div>
          <p className="tiny" style={{ marginBottom: 18 }}>
            Locking makes the presentation read-only and freezes these settings, so a finished deck
            can&rsquo;t be edited or re-shared by accident. Anyone with access can unlock it again.
          </p>

          <div className="label" style={{ marginBottom: 6 }}>Status</div>
          <div className="seg" style={{ marginBottom: 18 }}>
            {(['draft', 'published', 'unpublished'] as const).map((s) => (
              <button key={s} disabled={locked} className={presentation.status === s ? 'on' : ''} onClick={() => onChange({ status: s })}>
                {s === 'draft' ? 'Draft' : s === 'published' ? 'Published' : 'Unpublished'}
              </button>
            ))}
          </div>

          <div className="label" style={{ marginBottom: 6 }}>Access</div>
          <div className="seg" style={{ marginBottom: 10 }}>
            {(['public', 'password', 'internal'] as const).map((a) => (
              <button key={a} disabled={locked} className={share.access === a ? 'on' : ''} onClick={() => setShare({ access: a })}>
                {a === 'public' ? 'Anyone with the link' : a === 'password' ? 'Password' : 'Team only'}
              </button>
            ))}
          </div>
          {share.access === 'password' && backend === 'api' && (
            <div style={{ marginBottom: 18 }}>
              {/* The password goes to the server once, is hashed there, and is
                  never stored in the deck or shown again. */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="field"
                  type="password"
                  placeholder="Set a new password (6+ characters)"
                  value={pw}
                  disabled={locked}
                  onChange={(e) => {
                    setPw(e.target.value);
                    setPwState('');
                  }}
                />
                <button
                  className="btn sm"
                  disabled={locked || pw.length < 6 || pwState === 'saving'}
                  onClick={async () => {
                    setPwState('saving');
                    const r = await fetch(`/api/presentations/${presentation.id}/share`, {
                      method: 'PUT',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ access: 'password', password: pw }),
                    });
                    const j = await r.json().catch(() => ({}));
                    if (r.ok) {
                      setPw('');
                      setPwState('saved');
                    } else setPwState(j.error || 'Could not save the password.');
                  }}
                >
                  Set
                </button>
              </div>
              <p className="tiny" style={{ marginTop: 6 }}>
                {pwState === 'saved'
                  ? 'Password set. Send it separately from the link.'
                  : pwState && pwState !== 'saving'
                    ? pwState
                    : 'Until a password is set, this link stays closed to everyone.'}
              </p>
            </div>
          )}
          {share.access === 'password' && backend !== 'api' && (
            <input
              className="field"
              style={{ marginBottom: 18 }}
              placeholder="Set a password"
              value={share.password || ''}
              onChange={(e) => setShare({ password: e.target.value })}
            />
          )}

          <div className="label" style={{ margin: '8px 0 6px' }}>How it scrolls</div>
          <div className="seg">
            {(['scroll', 'horizontal'] as const).map((m) => (
              <button
                key={m}
                disabled={locked}
                // V1 "slide" decks are shown as horizontal: the sideways one
                className={(share.mode === 'slide' ? 'horizontal' : share.mode) === m ? 'on' : ''}
                onClick={() => setShare({ mode: m })}
              >
                {m === 'scroll' ? 'Vertical' : 'Horizontal'}
              </button>
            ))}
          </div>
          <p className="tiny" style={{ marginTop: 8 }}>
            The link opens one page that scrolls through the deck. Nothing else: no menus, no way into
            Vigo Presents. On phones every deck stacks vertically.
          </p>

          {backend === 'api' && (
            <>
              <div className="label" style={{ margin: '18px 0 6px' }}>Revoke</div>
              <button
                className="btn sm ghost"
                disabled={locked || revoking}
                onClick={async () => {
                  if (!confirm('The current link will stop working for everyone, immediately. A new link replaces it. Continue?')) return;
                  setRevoking(true);
                  const r = await fetch(`/api/presentations/${presentation.id}/share`, { method: 'DELETE' });
                  const j = await r.json().catch(() => ({}));
                  setRevoking(false);
                  // the server bumped the deck's version; reloading picks up the new slug cleanly
                  if (r.ok && j.slug) window.location.reload();
                }}
              >
                {revoking ? 'Revoking…' : 'Revoke this link and make a new one'}
              </button>
            </>
          )}

          {backend !== 'api' && (
            <div className="banner" style={{ marginTop: 18, marginBottom: 0 }}>
              <b>This workspace is running without a shared database.</b> Presentations are saved in
              this browser, so a share link opens for you but not yet for other people. Add a{' '}
              <code>DATABASE_URL</code> environment variable and links become live for everyone —
              nothing else changes.
            </div>
          )}
        </div>
        <div className="modal-foot">
          <a className="btn ghost" href={publicPath} target="_blank" rel="noreferrer">
            Open live page
          </a>
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
