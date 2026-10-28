'use client';

import { useEffect, useState } from 'react';

export interface LibraryAsset {
  id: string;
  brand: string;
  category: string;
  name: string;
  path: string;
  kind: 'image' | 'video' | 'logo';
  width?: number;
  height?: number;
}

export function useAssets() {
  const [assets, setAssets] = useState<LibraryAsset[] | null>(null);
  const load = async () => {
    try {
      const r = await fetch('/api/assets', { cache: 'no-store' });
      const j = await r.json();
      setAssets(j.assets || []);
    } catch {
      setAssets([]);
    }
  };
  useEffect(() => {
    load();
  }, []);
  return { assets, reload: load };
}

const label = (c: string) => (c === 'Product Photography' ? 'Products' : c);

/** Photography shown as photography: cropped to a common shape, named underneath. */
export default function MediaGrid({
  assets,
  showBrand,
  movable,
}: {
  assets: LibraryAsset[];
  showBrand?: (id: string) => string;
  /** items can be dragged onto a group or brand to re-file them */
  movable?: boolean;
}) {
  return (
    <div className="media-grid">
      {assets.map((a) => (
        <figure
          className={'media-item' + (a.category === 'Logos' ? ' logo' : '')}
          key={a.id}
          draggable={movable}
          onDragStart={(e) => {
            e.dataTransfer.setData('application/x-vigo-library-id', a.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
        >
          <div className="im">
            {a.kind === 'video' ? (
              <video
                src={a.path + '#t=0.5'}
                muted
                playsInline
                loop
                preload="metadata"
                onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                onMouseLeave={(e) => e.currentTarget.pause()}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.path} alt={a.name} loading="lazy" />
            )}
          </div>
          <figcaption title={a.name}>
            {a.name}
            <span>{showBrand ? showBrand(a.brand) + ', ' + label(a.category) : label(a.category)}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
