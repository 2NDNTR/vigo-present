'use client';

import { useMemo, useState } from 'react';
import DeckGrid, { useDecks } from '@/components/v2/DeckGrid';
import { useApp } from '@/components/v2/Shell';

export default function Presentations() {
  const { brands } = useApp();
  const [archived, setArchived] = useState(false);
  const { decks, reload } = useDecks(archived);
  const [brand, setBrand] = useState('all');
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (decks || []).filter((d) => (brand === 'all' || d.brand === brand) && (!q || d.title.toLowerCase().includes(q)));
  }, [decks, brand, query]);

  return (
    <>
      <div className="v2-head">
        <div>
          <h1 className="t-title">Presentations</h1>
          <p className="t-small">Every deck you can open, newest first.</p>
        </div>
        <div className="seg2" role="group" aria-label="Show">
          <button aria-pressed={!archived} onClick={() => setArchived(false)}>
            Active
          </button>
          <button aria-pressed={archived} onClick={() => setArchived(true)}>
            Archived
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="seg2" role="group" aria-label="Brand">
          <button aria-pressed={brand === 'all'} onClick={() => setBrand('all')}>
            All brands
          </button>
          {(brands || []).map((b) => (
            <button key={b.id} aria-pressed={brand === b.id} onClick={() => setBrand(b.id)}>
              {b.name}
            </button>
          ))}
        </div>
        <input
          className="search"
          type="search"
          placeholder="Find a presentation"
          aria-label="Find a presentation"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {decks === null ? (
        <p className="t-small">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="empty2">
          <h3 className="t-section">{archived ? 'Nothing archived' : query ? 'No presentation matches that' : 'No presentations yet'}</h3>
          <p>
            {archived
              ? 'Archived decks land here and can be restored, share links and all.'
              : query
                ? 'Check the spelling, or clear the search to see everything.'
                : 'Create one from Overview.'}
          </p>
        </div>
      ) : (
        <DeckGrid decks={shown} onChanged={reload} archived={archived} />
      )}
    </>
  );
}
