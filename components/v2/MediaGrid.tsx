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

/** Photography shown as photography: cropped to a common shape, named underneath. */
export default function MediaGrid({ assets, showBrand }: { assets: LibraryAsset[]; showBrand?: (id: string) => string }) {
  return (
    <div className="media-grid">
      {assets.map((a) => (
        <figure className="media-item" key={a.id}>
          <div className="im">
            {a.kind === 'video' ? (
              <video src={a.path} muted playsInline preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.path} alt={a.name} loading="lazy" />
            )}
          </div>
          <figcaption title={a.name}>
            {a.name}
            <span>{showBrand ? showBrand(a.brand) + ', ' + a.category : a.category}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
