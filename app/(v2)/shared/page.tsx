'use client';

import Link from 'next/link';
import Thumb from '@/components/ui/Thumb';
import { ago, shareUrl, useDecks } from '@/components/v2/DeckGrid';
import { useApp } from '@/components/v2/Shell';

const ACCESS: Record<string, string> = {
  public: 'Anyone with the link',
  password: 'Password',
  internal: 'Team only',
  private: 'Team only',
};

export default function Shared() {
  const { toast, brands } = useApp();
  const { decks } = useDecks();
  const live = (decks || []).filter((d) => d.status === 'published');
  const name = (id: string) => brands?.find((b) => b.id === id)?.name || id;

  return (
    <>
      <div className="v2-head">
        <div>
          <h1 className="t-title">Shared links</h1>
          <p className="t-small">
            Live presentations and their links. Recipients see one view-only page; nothing else in Vigo Presents.
          </p>
        </div>
      </div>
      {decks === null ? (
        <p className="t-small">Loading…</p>
      ) : live.length === 0 ? (
        <div className="empty2">
          <h3 className="t-section">Nothing is live yet</h3>
          <p>Open a presentation and choose Share, then Publish. Its link will appear here.</p>
        </div>
      ) : (
        <div>
          {live.map((p) => (
            <div className="link-row" key={p.id}>
              <div className="mini">
                <Thumb page={p.pages[0]} brand={p.brand} />
              </div>
              <div style={{ minWidth: 0 }}>
                <Link href={'/e/' + p.id} style={{ color: 'inherit', fontWeight: 500, textDecoration: 'none' }}>
                  {p.title}
                </Link>
                <code>{shareUrl(p)}</code>
                <p className="t-small" style={{ marginTop: 2 }}>
                  {name(p.brand)}, {ACCESS[p.share.access] || 'Anyone with the link'},{' '}
                  {p.share.mode === 'horizontal' || p.share.mode === 'slide' ? 'scrolls sideways' : 'scrolls down'}, updated {ago(p.updatedAt).toLowerCase()}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a className="btn2 quiet" href={'/p/' + p.share.slug} target="_blank" rel="noreferrer">
                  View as recipient
                </a>
                <button
                  className="btn2"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(shareUrl(p)).catch(() => {});
                    toast('Link copied');
                  }}
                >
                  Copy link
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
