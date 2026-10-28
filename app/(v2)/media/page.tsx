'use client';

import { useMemo, useRef, useState } from 'react';
import MediaGrid, { useAssets, type LibraryAsset } from '@/components/v2/MediaGrid';
import { useApp } from '@/components/v2/Shell';
import { uploadShared } from '@/lib/assets/sharedUpload';
import type { BrandId } from '@/lib/brand/themes';
import type { AssetCategory } from '@/lib/model/types';

/** The four groups the team files media under, and the category each stores as. */
const GROUPS: { id: string; label: string; category?: AssetCategory; hint?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'logos', label: 'Logos', category: 'Logos', hint: 'Brand, partner and retailer marks' },
  { id: 'products', label: 'Products', category: 'Product Photography', hint: 'Packshots and product photography' },
  { id: 'lifestyle', label: 'Lifestyle', category: 'Lifestyle', hint: 'People, food and settings' },
  { id: 'video', label: 'Video', category: 'Video', hint: 'Reels and clips' },
];
const FILE_GROUPS = GROUPS.filter((g) => g.category);

function groupOf(a: LibraryAsset): string {
  if (a.kind === 'video' || a.category === 'Video') return 'video';
  if (a.category === 'Logos') return 'logos';
  if (a.category === 'Product Photography' || a.category === 'Packaging') return 'products';
  return 'lifestyle';
}

const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
const hasItem = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('application/x-vigo-library-id');

export default function MediaLibrary() {
  const { brands, toast } = useApp();
  const { assets, reload } = useAssets();
  const [brand, setBrand] = useState('all');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string>('all');
  const [dragging, setDragging] = useState<'files' | 'item' | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number; label: string } | null>(null);
  const depth = useRef(0);
  const name = (id: string) => brands?.find((b) => b.id === id)?.name || id;

  const inBrand = (assets || []).filter((a) => brand === 'all' || a.brand === brand);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inBrand.filter(
      (a) => (group === 'all' || groupOf(a) === group) && (!q || a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, brand, query, group]);

  /* -------------------------------------------------------------- upload */
  const upload = async (files: File[], toBrand: string, category: AssetCategory, label: string) => {
    const ok = files.filter((f) =>
      category === 'Video' ? f.type.startsWith('video/') : f.type.startsWith('image/') || (category !== 'Logos' && f.type.startsWith('video/'))
    );
    if (!ok.length) return toast(category === 'Video' ? 'Only video files go in Video.' : 'Only images go there.');
    let done = 0;
    setUploading({ done, total: ok.length, label });
    const failed: string[] = [];
    for (const f of ok) {
      try {
        // a video dropped anywhere is filed as video
        await uploadShared(f, toBrand as BrandId, f.type.startsWith('video/') ? 'Video' : category);
      } catch {
        failed.push(f.name);
      }
      done++;
      setUploading({ done, total: ok.length, label });
    }
    setUploading(null);
    await reload();
    toast(failed.length ? `Added ${ok.length - failed.length}; ${failed.length} failed` : `Added ${ok.length} to ${label}`);
  };

  /* -------------------------------------------------------------- re-file */
  const refile = async (id: string, patch: { category?: AssetCategory; brand?: string }, label: string) => {
    const a = assets?.find((x) => x.id === id);
    if (!a) return;
    if ((patch.category && patch.category === a.category) || (patch.brand && patch.brand === a.brand)) return;
    const r = await fetch('/api/assets/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toast(j.error || 'That could not be moved.');
    await reload();
    toast(`Moved “${a.name}” to ${label}`);
  };

  /* ---------------------------------------------------------- page-level drag */
  const onEnter = (e: React.DragEvent) => {
    if (!hasFiles(e) && !hasItem(e)) return;
    depth.current++;
    setDragging(hasFiles(e) ? 'files' : 'item');
  };
  const onLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (!depth.current) {
      setDragging(null);
      setOver(null);
    }
  };
  const end = () => {
    depth.current = 0;
    setDragging(null);
    setOver(null);
  };

  /** A drop target: a group (and brand) for files, or a group/brand for a library item. */
  const target = (key: string, to: { brand?: string; category?: AssetCategory }, label: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!hasFiles(e) && !hasItem(e)) return;
      if (hasFiles(e) && !(to.category && (to.brand || brand !== 'all'))) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = hasFiles(e) ? 'copy' : 'move';
      setOver(key);
    },
    onDragLeave: () => setOver((o) => (o === key ? null : o)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const id = e.dataTransfer.getData('application/x-vigo-library-id');
      const files = Array.from(e.dataTransfer.files || []);
      end();
      if (id) refile(id, to, label);
      else if (files.length && to.category) upload(files, to.brand || brand, to.category, label);
    },
  });

  return (
    <div
      className={'media-page' + (dragging ? ' dragging-' + dragging : '')}
      onDragEnter={onEnter}
      onDragLeave={onLeave}
      onDragOver={(e) => (hasFiles(e) || hasItem(e)) && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        end();
      }}
      onDragEnd={end}
    >
      <div className="v2-head">
        <div>
          <h1 className="t-title">Media library</h1>
          <p className="t-small">
            Logos, product photography, lifestyle and video for every brand you can see. Drag files in from your computer to
            add them; drag a picture onto a group or a brand to re-file it.
          </p>
        </div>
      </div>
      <div className="toolbar">
        <div className="seg2" role="group" aria-label="Brand">
          <button aria-pressed={brand === 'all'} onClick={() => setBrand('all')}>
            All brands
          </button>
          {(brands || []).map((b) => (
            <button
              key={b.id}
              aria-pressed={brand === b.id}
              onClick={() => setBrand(b.id)}
              className={over === 'brand:' + b.id ? 'drop-over' : ''}
              {...(dragging === 'item' ? target('brand:' + b.id, { brand: b.id }, b.name) : {})}
            >
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
        {GROUPS.map((g) => (
          <button
            key={g.id}
            aria-pressed={group === g.id}
            onClick={() => setGroup(g.id)}
            className={over === 'group:' + g.id ? 'drop-over' : ''}
            {...(g.category && dragging === 'item' ? target('group:' + g.id, { category: g.category }, g.label) : {})}
          >
            {g.label}
            <span>{g.id === 'all' ? inBrand.length : inBrand.filter((a) => groupOf(a) === g.id).length}</span>
          </button>
        ))}
      </div>

      {uploading && (
        <div className="media-uploading" role="status">
          <i style={{ width: (uploading.done / uploading.total) * 100 + '%' }} />
          <span>
            Adding to {uploading.label}: {uploading.done} of {uploading.total}
          </span>
        </div>
      )}

      {/* dragging files in: one target per group (per brand, when no brand is chosen) */}
      {dragging === 'files' && (
        <div className="media-drop" aria-hidden="true">
          {(brand === 'all' ? brands || [] : (brands || []).filter((b) => b.id === brand)).map((b) => (
            <div key={b.id} className="media-drop-row">
              <h3>{b.name}</h3>
              <div className="media-drop-zones">
                {FILE_GROUPS.map((g) => {
                  const key = 'drop:' + b.id + ':' + g.id;
                  return (
                    <div key={g.id} className={'media-drop-zone' + (over === key ? ' over' : '')} {...target(key, { brand: b.id, category: g.category }, `${b.name}, ${g.label}`)}>
                      <b>{g.label}</b>
                      <span>{g.hint}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {assets === null ? (
        <p className="t-small">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="empty2">
          <h3 className="t-section">{query ? 'Nothing matches that search' : 'Nothing here yet'}</h3>
          <p>{query ? 'Try a product name or a group like Lifestyle.' : 'Drag photographs, logos or video here from your computer.'}</p>
        </div>
      ) : (
        <>
          <p className="t-small" style={{ marginBottom: 14 }}>
            {shown.length} {shown.length === 1 ? 'item' : 'items'}
          </p>
          <MediaGrid assets={shown} showBrand={name} movable />
        </>
      )}
    </div>
  );
}
