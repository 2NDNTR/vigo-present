'use client';

import Link from 'next/link';
import Composer from '@/components/v2/Composer';
import DeckGrid, { useDecks } from '@/components/v2/DeckGrid';
import BrandTiles from '@/components/v2/BrandTiles';
import { useApp } from '@/components/v2/Shell';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Overview() {
  const { user, brands } = useApp();
  const { decks, reload } = useDecks();
  const first = (user?.name || '').split(' ')[0];

  return (
    <>
      <p className="t-small" style={{ marginBottom: 14 }}>
        {greeting()}
        {first && first !== 'Administrator' ? ', ' + first : ''}
      </p>

      <Composer />

      <section className="v2-section" aria-labelledby="brands-h">
        <header>
          <h2 className="t-section" id="brands-h">
            Brands
          </h2>
          <Link href="/brands">All brands</Link>
        </header>
        <BrandTiles brands={brands} />
      </section>

      <section className="v2-section" aria-labelledby="recent-h">
        <header>
          <h2 className="t-section" id="recent-h">
            Recent presentations
          </h2>
          {decks && decks.length > 6 && <Link href="/presentations">See all {decks.length}</Link>}
        </header>
        {decks === null ? (
          <p className="t-small">Loading presentations…</p>
        ) : decks.length === 0 ? (
          <div className="empty2">
            <h3 className="t-section">No presentations yet</h3>
            <p>Describe your first one above and it will appear here, saved and ready to edit.</p>
          </div>
        ) : (
          <DeckGrid decks={decks.slice(0, 6)} onChanged={reload} />
        )}
      </section>
    </>
  );
}
