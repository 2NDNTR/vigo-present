'use client';

import { useRef, useState } from 'react';
import {
  assetsFor,
  isPlaceholderLibrary,
  isSharedLibrary,
  refreshShared,
  refreshUploads,
  uploadedAssets,
  useAssetRegistry,
} from '@/lib/assets/registry';
import { deleteShared, uploadShared } from '@/lib/assets/sharedUpload';
import type { AssetRecord } from '@/lib/assets/registry';
import { addUpload, exportAll, listUploads, removeUpload } from '@/lib/assets/uploads';
import { ASSET_CATEGORIES } from '@/lib/model/types';
import type { AssetCategory } from '@/lib/model/types';
import { BRAND_ORDER, THEMES } from '@/lib/brand/themes';
import type { BrandId } from '@/lib/brand/themes';

const UPLOAD_CATEGORIES: AssetCategory[] = ASSET_CATEGORIES.filter((c) => c !== 'Logos');

export default function AssetsPanel({
  brand,
  onUse,
}: {
  brand: BrandId;
  onUse: (asset: AssetRecord) => void;
}) {
  const [b, setB] = useState<BrandId>(brand);
  const [cat, setCat] = useState<AssetCategory | 'All'>('All');
  const [uploadCat, setUploadCat] = useState<AssetCategory>('Product Photography');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useAssetRegistry();

  const all = assetsFor(b, cat);
  const items = (q ? all.filter((a) => a.name.toLowerCase().includes(q.toLowerCase())) : all).slice(0, 120);
  const placeholders = isPlaceholderLibrary();
  const shared = isSharedLibrary();
  const mine = uploadedAssets();
  const mineForBrand = mine.filter((a) => a.brand === b);

  async function ingest(files: FileList | File[]) {
    const list = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    if (!list.length) return;
    let failed = 0;
    for (let i = 0; i < list.length; i++) {
      setBusy(`${shared ? 'Uploading' : 'Adding'} ${i + 1} of ${list.length}…`);
      try {
        if (shared) await uploadShared(list[i], b, uploadCat);
        else await addUpload(list[i], b, uploadCat);
      } catch (e: any) {
        failed++;
        console.warn('upload failed', e);
      }
    }
    if (shared) await refreshShared();
    else await refreshUploads();
    setBusy(null);
    if (failed) window.alert(`${failed} file${failed === 1 ? '' : 's'} could not be uploaded.`);
  }

  async function download() {
    setBusy('Packaging…');
    const zip = await exportAll(await listUploads());
    setBusy(null);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zip);
    a.download = 'vigo-assets.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  return (
    <div>
      {/* ------------------------------------------------------- browse ---- */}
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

      {/* ------------------------------------------------------- upload ---- */}
      <div className="panel-sec">
        <div className="label" style={{ marginBottom: 6 }}>
          Add to {THEMES[b].shortName}
        </div>
        <select
          className="field"
          style={{ marginBottom: 8 }}
          value={uploadCat}
          onChange={(e) => setUploadCat(e.target.value as AssetCategory)}
        >
          {UPLOAD_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          style={{ display: 'none' }}
          onChange={async (e) => {
            if (e.target.files) await ingest(e.target.files);
            e.target.value = '';
          }}
        />

        <div
          className={'dropzone' + (dragOver ? ' over' : '')}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) await ingest(e.dataTransfer.files);
          }}
        >
          {busy ? (
            busy
          ) : (
            <>
              <b>Drop photos or video here</b>
              <span>
                Filed under {THEMES[b].shortName} → {uploadCat}
              </span>
            </>
          )}
        </div>

        {!shared && mine.length > 0 && (
          <>
            <div className="tiny" style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span>
                {mine.length} uploaded · {mineForBrand.length} in {THEMES[b].shortName}
              </span>
            </div>
            <button className="btn sm" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }} onClick={download}>
              Download for the repository
            </button>
            <p className="tiny" style={{ marginTop: 7 }}>
              Uploads work immediately for you. Unzip this over <code>public/assets/</code>, run{' '}
              <code>npm run assets</code> and commit to make them permanent and visible to everyone —
              the ids match, so nothing has to be re-pointed.
            </p>
          </>
        )}
      </div>

      {/* -------------------------------------------------------- grid ----- */}
      <div className="panel-sec">
        {items.length === 0 ? (
          <p className="tiny">Nothing in this category yet.</p>
        ) : (
          <div className="assetgrid">
            {items.map((a) => (
              <div
                key={a.id}
                className={'assetcell' + (a.local ? ' local' : '')}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-vigo-asset', a.path);
                  e.dataTransfer.setData('application/x-vigo-asset-id', a.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onUse(a)}
                style={a.kind === 'video' ? undefined : { backgroundImage: `url("${a.path}")` }}
                title={a.name + (a.local ? ' — uploaded, not yet in the repository' : '')}
              >
                {a.kind === 'video' && <video src={a.path} muted playsInline preload="metadata" />}
                {(a.local || shared) && (
                  <button
                    className="assetdel"
                    title={a.local ? 'Remove upload' : 'Remove from the library'}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (a.local) {
                        await removeUpload(a.id);
                        await refreshUploads();
                      } else {
                        if (!window.confirm(`Remove “${a.name}” from the shared library? Pages using it will fall back to whatever was stored when it was added.`)) return;
                        await deleteShared(a.id);
                        await refreshShared();
                      }
                    }}
                  >
                    ×
                  </button>
                )}
                <span>{a.name}</span>
              </div>
            ))}
          </div>
        )}

        <p className="tiny" style={{ marginTop: 12 }}>
          Drag an asset onto any image area, or click to drop it into the selected area.
        </p>

        <div className="banner" style={{ marginTop: 12, marginBottom: 0 }}>
          {shared ? (
            <>
              <b>Shared library.</b> Everything here is visible to everyone on the team, and to
              anyone opening a published link. Upload a file with the same name to replace it
              everywhere it is used.
            </>
          ) : placeholders && mine.length === 0 ? (
            <>
              <b>Placeholder library.</b> Drop real photography above, or commit it to{' '}
              <code>public/assets/</code> in the repository. Either way this panel picks it up.
            </>
          ) : (
            <>
              <b>Replace once, updates everywhere.</b> Presentations reference an asset by id, never
              a copy. Save a new file over the same name and every page using it updates — old
              versions never pile up.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
