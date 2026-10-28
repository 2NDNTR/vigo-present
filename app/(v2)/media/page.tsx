'use client';

import { useMemo, useState } from 'react';
import MediaGrid, { useAssets, type LibraryAsset } from '@/components/v2/MediaGrid';
import { useApp } from '@/components/v2/Shell';

/** The four groups the team files media under. */
const GROUPS: [string, string][] = [
  ['all', 'All'],
  ['logos', 'Logos'],
  ['products', 'Products'],
  ['lifestyle', 'Lifestyle'],
  ['video', 'Video'],
];
function groupOf(a: LibraryAsset): string {
  if (a.kind === 'video' || a.category === 'Video') return 'video';
  if (a.category === 'Logos') return 'logos';
  if (a.category === 'Product Photography' || a.category === 'Packaging') return 'products';
  return 'lifestyle';
}

export default function MediaLibrary() {
  const { brands } = useApp();
  const { assets } = useAssets();
  const [brand, setBrand] = useState('all');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string>('all');
  const name = (id: string) => brands?.find((b) => b.id === id)?.name || id;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (assets || []).filter(
      (a) =>
        (brand === 'all' || a.brand === brand) &&
        (group === 'all' || groupOf(a) === group) &&
        (!q || a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q))
    );
  }, [assets, brand, query, group]);
  const inBrand = (assets || []).filter((a) => brand === 'all' || a.brand === brand);

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
      <div className="seg2 groups" role="group" aria-label="Kind of media">
        {GROUPS.map(([id, label]) => (
          <button key={id} aria-pressed={group === id} onClick={() => setGroup(id)}>
            {label}
            <span>{id === 'all' ? inBrand.length : inBrand.filter((a) => groupOf(a) === id).length}</span>
          </button>
        ))}
      </div>
      {assets === null ? (
        <p className="t-small">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="empty2">
          <h3 className="t-section">{query ? 'Nothing matches that search' : 'The library is empty'}</h3>
          <p>{query ? 'Try a product name or a category like Lifestyle.' : 'Bring in the live site\'s library from Settings, or upload into a brand from its Media tab.'}</p>
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
