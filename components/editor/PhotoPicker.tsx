'use client';

import { useEffect, useMemo, useState } from 'react';
import Portal from '@/components/ui/Portal';
import { useAssets, type LibraryAsset } from '@/components/v2/MediaGrid';
import type { BrandId } from '@/lib/brand/themes';
import { getTheme } from '@/lib/brand/themes';

/**
 * Choose a photo from the team library for the item on the slide. Opens on the
 * deck's brand, because that is almost always the answer; "All brands" is one
 * click away for the times it is not.
 */
export default function PhotoPicker({
  brand,
  allowVideo,
  onClose,
  onPick,
}: {
  brand: BrandId;
  allowVideo?: boolean;
  onClose: () => void;
  onPick: (a: LibraryAsset) => void;
}) {
  const { assets } = useAssets();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'brand' | 'all'>('brand');
  const [folder, setFolder] = useState<string>('All');

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const usable = useMemo(
    () =>
      (assets || []).filter(
        (a) => a.category !== 'Logos' && a.kind !== 'logo' && (allowVideo || a.kind !== 'video') && (scope === 'all' || a.brand === brand)
      ),
    [assets, scope, brand, allowVideo]
  );
  const folders = useMemo(() => ['All', ...Array.from(new Set(usable.map((a) => a.category))).sort()], [usable]);
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return usable.filter(
      (a) =>
        (folder === 'All' || a.category === folder) &&
        words.every((w) => (a.name + ' ' + a.category).toLowerCase().includes(w))
    );
  }, [usable, folder, q]);

  const label = (c: string) => (c === 'Product Photography' ? 'Products' : c);

  return (
    <Portal>
      <div className="scrim-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal wide picker" role="dialog" aria-label="Choose a photo">
          <div className="picker-head">
            <h2>Choose a photo</h2>
            <input
              autoFocus
              className="picker-search"
              placeholder="Search the library"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="picker-x" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
            </button>
          </div>
          <div className="picker-filters">
            <div className="seg">
              <button aria-pressed={scope === 'brand'} onClick={() => setScope('brand')}>{getTheme(brand).name}</button>
              <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>All brands</button>
            </div>
            <div className="picker-folders">
              {folders.map((f) => (
                <button key={f} aria-pressed={folder === f} onClick={() => setFolder(f)}>
                  {label(f)}
                </button>
              ))}
            </div>
          </div>
          <div className="picker-grid">
            {assets === null ? (
              <p className="muted picker-empty">Loading the library…</p>
            ) : shown.length === 0 ? (
              <p className="muted picker-empty">
                Nothing matches. {scope === 'brand' ? 'Try All brands, or ' : 'Try '}a shorter search.
              </p>
            ) : (
              shown.map((a) => (
                <button key={a.id} className="picker-item" onClick={() => onPick(a)} title={a.name}>
                  {a.kind === 'video' ? (
                    <video src={a.path + '#t=0.5'} muted playsInline preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.path} alt="" loading="lazy" />
                  )}
                  <span>{a.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
