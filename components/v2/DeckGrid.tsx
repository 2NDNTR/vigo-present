'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Thumb from '@/components/ui/Thumb';
import { getStore } from '@/lib/store';
import type { Presentation } from '@/lib/model/types';
import { uid, slugify } from '@/lib/model/types';
import { useApp } from './Shell';

export function ago(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 86400 * 7) return Math.floor(s / 86400) + ' days ago';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Every deck the person can see, loaded once per screen. */
export function useDecks(archived = false) {
  const [decks, setDecks] = useState<Presentation[] | null>(null);
  const load = async () => {
    try {
      const r = await fetch('/api/presentations' + (archived ? '?archived=1' : ''), { cache: 'no-store' });
      const j = await r.json();
      setDecks(j.presentations || []);
    } catch {
      setDecks([]);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archived]);
  return { decks, reload: load };
}

export const shareUrl = (p: Presentation) =>
  (typeof window !== 'undefined' ? window.location.origin : '') + '/p/' + p.share.slug;

/**
 * Presentations as their own first slide — the thing people recognise a deck
 * by — with the title underneath and nothing boxed around it.
 */
export default function DeckGrid({
  decks,
  onChanged,
  showBrand = true,
  archived = false,
}: {
  decks: Presentation[];
  onChanged: () => void;
  showBrand?: boolean;
  archived?: boolean;
}) {
  const router = useRouter();
  const { brands, toast } = useApp();
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const brandName = (id: string) => brands?.find((b) => b.id === id)?.name || id;

  const act = async (p: Presentation, action: string) => {
    setOpen(null);
    const s = await getStore();
    if (action === 'preview') router.push('/present/' + p.id);
    if (action === 'duplicate') {
      const copy: Presentation = JSON.parse(JSON.stringify(p));
      copy.id = uid('pres');
      copy.title = p.title + ' (copy)';
      copy.status = 'draft';
      copy.createdAt = Date.now();
      copy.updatedAt = Date.now();
      delete (copy as any).version;
      copy.share = { ...p.share, slug: slugify(copy.title) + '-' + Math.random().toString(36).slice(2, 6) };
      copy.pages = copy.pages.map((pg) => ({ ...pg, id: uid('pg') }));
      await s.save(copy);
      router.push('/e/' + copy.id);
    }
    if (action === 'rename') {
      const name = window.prompt('Rename presentation', p.title);
      if (name && name.trim()) {
        await s.save({ ...p, title: name.trim() });
        toast('Renamed');
        onChanged();
      }
    }
    if (action === 'copy') {
      await navigator.clipboard?.writeText(shareUrl(p)).catch(() => {});
      toast(p.status === 'published' ? 'Link copied' : 'Link copied. Publish the deck before sending it.');
    }
    if (action === 'archive') {
      await fetch('/api/presentations/' + p.id, { method: 'DELETE' });
      toast('Moved to archive. Restore it from Presentations.');
      onChanged();
    }
    if (action === 'restore') {
      await fetch('/api/presentations/' + p.id, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ restore: true }),
      });
      toast('Restored');
      onChanged();
    }
  };

  return (
    <div className="deck-grid">
      {decks.map((p) => (
        <div className="deck" key={p.id}>
          <Link href={archived ? '#' : '/e/' + p.id} onClick={(e) => archived && e.preventDefault()} aria-label={'Open ' + p.title}>
            <div className="shot">
              <Thumb page={p.pages[0]} brand={p.brand} />
            </div>
            <p className="name">{p.title}</p>
          </Link>
          <div className="line">
            <span className={'status' + (p.status === 'published' ? ' live' : '')}>
              <i />
              {p.status === 'published' ? 'Live' : p.status === 'unpublished' ? 'Unpublished' : 'Draft'}
            </span>
            {showBrand && <span>{brandName(p.brand)}</span>}
            <span>{ago(p.updatedAt)}</span>
          </div>
          <button
            className="menu-btn"
            aria-label={'Actions for ' + p.title}
            aria-expanded={open === p.id}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setOpen(open === p.id ? null : p.id)}
          >
            ⋯
          </button>
          {open === p.id && (
            <div className="pop" onMouseDown={(e) => e.stopPropagation()} role="menu">
              {archived ? (
                <button role="menuitem" onClick={() => act(p, 'restore')}>Restore</button>
              ) : (
                <>
                  <button role="menuitem" onClick={() => act(p, 'preview')}>Preview</button>
                  <button role="menuitem" onClick={() => act(p, 'copy')}>Copy share link</button>
                  <button role="menuitem" onClick={() => act(p, 'duplicate')}>Duplicate</button>
                  <button role="menuitem" onClick={() => act(p, 'rename')}>Rename</button>
                  <button role="menuitem" className="danger" onClick={() => act(p, 'archive')}>Archive</button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
