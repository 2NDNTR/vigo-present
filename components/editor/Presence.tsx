'use client';

import { useEffect, useState } from 'react';

/**
 * WHO IS IN THE FILE
 * ---------------------------------------------------------------------------
 * The avatars in the corner answer one question — am I about to edit the same
 * slide as someone else — and the answer is only useful if it is roughly live,
 * not exactly live. So this is a heartbeat on a timer rather than a socket:
 * cheap, survives a sleeping laptop, and reconnects by simply beating again.
 *
 * Initials rather than photographs. There are no avatars in this product yet,
 * and a row of identical grey circles tells you nothing; two letters and a
 * colour derived from the person's own name tells you who.
 */

const BEAT = 12_000;

export interface Present {
  id: string;
  name: string;
  email: string;
  pageId?: string | null;
  me?: boolean;
}

export default function Presence({
  presentationId,
  pageId,
  pageTitleFor,
}: {
  presentationId: string;
  pageId?: string;
  pageTitleFor?: (pageId: string) => string | undefined;
}) {
  const [here, setHere] = useState<Present[]>([]);

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;

    const beat = async () => {
      try {
        const r = await fetch('/api/presence', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ presentationId, pageId }),
        });
        if (r.ok && alive) {
          const j = await r.json();
          setHere(j.here || []);
        }
      } catch {
        /* A missed beat is not worth telling anyone about; the next one is in
         * twelve seconds and the window is long enough to cover it. */
      }
      if (alive) timer = window.setTimeout(beat, BEAT);
    };

    beat();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [presentationId, pageId]);

  const others = here.filter((p) => !p.me);
  if (!others.length) return null;

  return (
    <div className="presence" aria-label={others.length + ' other people in this deck'}>
      {others.slice(0, 5).map((p) => {
        const where = p.pageId && pageTitleFor ? pageTitleFor(p.pageId) : undefined;
        return (
          <span
            key={p.id}
            className={'pres-dot' + (p.pageId && p.pageId === pageId ? ' same' : '')}
            style={{ background: tint(p.name || p.email) }}
            title={p.name + (where ? ' — on ' + where : '') + (p.pageId === pageId ? ' (this page)' : '')}
          >
            {initials(p.name || p.email)}
          </span>
        );
      })}
      {others.length > 5 ? <span className="pres-dot more">+{others.length - 5}</span> : null}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

/** A stable colour per person, so the same face keeps the same badge. */
function tint(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h} 42% 38%)`;
}
