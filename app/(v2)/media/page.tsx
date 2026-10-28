'use client';

import { useMemo, useState } from 'react';
import MediaGrid, { useAssets } from '@/components/v2/MediaGrid';
import { useApp } from '@/components/v2/Shell';

export default function MediaLibrary() {
  const { brands } = useApp();
  const { assets } = useAssets();
  const [brand, setBrand] = useState('all');
  const [query, setQuery] = useState('');
  const name = (id: string) => brands?.find((b) => b.id === id)?.name || id;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (assets || []).filter(
      (a) =>
        (brand === 'all' || a.brand === brand) &&
        (!q || a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q))
    );
  }, [assets, brand, query]);

  return (
    <>
      <div className="v2-head">
        <div>
          <h1 className="t-title">Media library</h1>
          <p className="t-small">
            Approved photography and video for every brand you can see. Upload into a brand from its Media tab.
          </p>
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
          placeholder="Search by name or category"
          aria-label="Search media"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {assets === null ? (
        <p className="t-small">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="empty2">
          <h3 className="t-section">{query ? 'Nothing matches that search' : 'The library is empty'}</h3>
          <p>{query ? 'Try a product name or a category like Lifestyle.' : 'Open a brand and use its Media tab to upload photography.'}</p>
        </div>
      ) : (
        <>
          <p className="t-small" style={{ marginBottom: 14 }}>
            {shown.length} {shown.length === 1 ? 'item' : 'items'}
          </p>
          <MediaGrid assets={shown} showBrand={name} />
        </>
      )}
    </>
  );
}
