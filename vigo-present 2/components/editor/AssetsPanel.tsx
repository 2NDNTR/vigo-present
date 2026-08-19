'use client';

import { useState } from 'react';
import { assetsFor, useAssetRegistry, isPlaceholderLibrary } from '@/lib/assets/registry';
import type { AssetRecord } from '@/lib/assets/registry';
import { ASSET_CATEGORIES } from '@/lib/model/types';
import type { AssetCategory } from '@/lib/model/types';
import { BRAND_ORDER, THEMES } from '@/lib/brand/themes';
import type { BrandId } from '@/lib/brand/themes';

export default function AssetsPanel({
  brand,
  onUse,
}: {
  brand: BrandId;
  onUse: (asset: AssetRecord) => void;
}) {
  const [b, setB] = useState<BrandId>(brand);
  const [cat, setCat] = useState<AssetCategory | 'All'>('All');
  const [q, setQ] = useState('');
  useAssetRegistry();

  const all = assetsFor(b, cat);
  const items = (q ? all.filter((a) => a.name.toLowerCase().includes(q.toLowerCase())) : all).slice(0, 90);
  const placeholders = isPlaceholderLibrary();

  return (
    <div>
      <div className="panel-sec" style={{ paddingTop: 0 }}>
        <h4 className="panel-h">Assets</h4>
        <div className="seg" style={{ marginBottom: 10 }}>
          {BRAND_ORDER.map((x) => (
            <button key={x} className={b === x ? 'on' : ''} onClick={() => setB(x)}>
              {THEMES[x].shortName}
            </button>
          ))}
        </div>
        <select className="field" style={{ marginBottom: 8 }} value={cat} onChange={(e) => setCat(e.target.value as any)}>
          <option value="All">All categories</option>
          {ASSET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input className="field" placeholder="Search assets" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="panel-sec">
        {items.length === 0 ? (
          <p className="tiny">Nothing in this category yet.</p>
        ) : (
          <div className="assetgrid">
            {items.map((a) => (
              <div
                key={a.id}
                className="assetcell"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-vigo-asset', a.path);
                  e.dataTransfer.setData('application/x-vigo-asset-id', a.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onUse(a)}
                style={{ backgroundImage: `url("${a.path}")` }}
                title={a.name + ' — drag onto the page'}
              >
                <span>{a.name}</span>
              </div>
            ))}
          </div>
        )}

        <p className="tiny" style={{ marginTop: 12 }}>
          Drag an asset onto any image area, or click to drop it into the selected area.
        </p>

        <div className="banner" style={{ marginTop: 12, marginBottom: 0 }}>
          {placeholders ? (
            <>
              <b>Placeholder library.</b> Real photography goes in the repository under{' '}
              <code>public/assets/</code> with an entry in <code>manifest.json</code>. Once it&rsquo;s
              there this panel switches over automatically.
            </>
          ) : (
            <>
              <b>Replace once, updates everywhere.</b> Presentations reference an asset by id, never
              a copy. Save a new file over the same path in the repository and every page using it
              updates — old versions never pile up.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
