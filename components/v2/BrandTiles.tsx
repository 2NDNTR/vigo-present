'use client';

import Link from 'next/link';
import type { BrandSummary } from './Shell';
import { brandLook } from './brandLook';

/** Each brand dressed in its own identity: its ground, its ink, its mark. */
export default function BrandTiles({ brands }: { brands: BrandSummary[] | null }) {
  if (brands === null) return <p className="t-small">Loading brands…</p>;
  if (brands.length === 0) {
    return (
      <div className="empty2">
        <h3 className="t-section">No brands yet</h3>
        <p>An administrator gives you access to a brand. Ask whoever added you to Vigo Presents.</p>
      </div>
    );
  }
  return (
    <div className="brand-row">
      {brands.map((b) => {
        const look = brandLook(b.id);
        return (
          <Link
            key={b.id}
            href={'/brands/' + b.id}
            className="brand-tile"
            style={{ background: look.ground, color: look.ink }}
          >
            <div className="logo">
              {look.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={look.logo} alt={b.name} />
              ) : (
                <span>{look.wordmark}</span>
              )}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{b.name}</div>
              <div className="facts">
                <span>
                  <b>{b.decks}</b> {b.decks === 1 ? 'deck' : 'decks'}
                </span>
                <span>
                  <b>{b.live}</b> live
                </span>
                <span>
                  <b>{b.assets}</b> {b.assets === 1 ? 'photo' : 'photos'}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
