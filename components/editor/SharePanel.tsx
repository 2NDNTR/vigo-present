'use client';

import { useState } from 'react';
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
  const locked = !!presentation.locked;
  // the static build is hash-routed; the Next app uses real paths
  const hashRouted = typeof window !== 'undefined' && window.location.hash.startsWith('#/');
  const publicPath = (hashRouted ? '/#/p/' : '/p/') + presentation.share.slug;
  const url = typeof window !== 'undefined' ? window.location.origin + publicPath : '';
  const share = presentation.share;

  const setShare = (patch: any) => onChange({ share: { ...share, ...patch } });

  return (
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
                {a === 'public' ? 'Public' : a === 'password' ? 'Password' : 'Internal'}
              </button>
            ))}
          </div>
          {share.access === 'password' && (
            <input
              className="field"
              style={{ marginBottom: 18 }}
              placeholder="Set a password"
              value={share.password || ''}
              onChange={(e) => setShare({ password: e.target.value })}
            />
          )}

          <div className="label" style={{ margin: '8px 0 6px' }}>Presentation mode</div>
          <div className="seg">
            {(['scroll', 'slide'] as const).map((m) => (
              <button key={m} disabled={locked} className={share.mode === m ? 'on' : ''} onClick={() => setShare({ mode: m })}>
                {m === 'scroll' ? 'Scroll' : 'Slides'}
              </button>
            ))}
          </div>
          <p className="tiny" style={{ marginTop: 8 }}>
            Scroll reads like a premium web story. Slides behave like a traditional deck. Both are
            fully responsive on phones.
          </p>

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
  );
}
