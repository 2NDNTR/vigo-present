'use client';

import { useRef, useState } from 'react';
import {
  assetsFor,
  isPlaceholderLibrary,
  isSharedLibrary,
  refreshShared,
  libraryState,
  refreshUploads,
  storableUrl,
  uploadedAssets,
  useAssetRegistry,
} from '@/lib/assets/registry';
import { deleteShared, publishUpload, uploadShared } from '@/lib/assets/sharedUpload';
import type { AssetRecord } from '@/lib/assets/registry';
import { listUploads, removeUpload } from '@/lib/assets/uploads';
import { ASSET_CATEGORIES } from '@/lib/model/types';
import type { AssetCategory } from '@/lib/model/types';
import { BRAND_ORDER, THEMES } from '@/lib/brand/themes';
import Select from '@/components/ui/Select';
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

  // A search should find the picture wherever it happens to be filed. Nobody
  // remembers whether the chili crisp shot went into Product Photography or
  // Packaging, so once there is a query the category filter steps aside and the
  // whole brand is searched — including the category name itself.
  const searching = q.trim().length > 0;
  const needle = q.trim().toLowerCase();
  const pool = assetsFor(b, searching ? 'All' : cat);
  const matched = searching
    ? pool.filter(
        (a) => a.name.toLowerCase().includes(needle) || a.category.toLowerCase().includes(needle)
      )
    : pool;
  const items = matched.slice(0, 120);
  const placeholders = isPlaceholderLibrary();
  const shared = isSharedLibrary();
  const mine = uploadedAssets();
  const lib = libraryState();
  const mineForBrand = mine.filter((a) => a.brand === b);

  async function ingest(files: FileList | File[]) {
    const list = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    if (!list.length) return;
    /* One destination. A picture kept in this browser is a picture nobody
     * else can see and one cleared cache away from gone, so there is no local
     * path any more — if the upload cannot reach storage the file is refused,
     * with the reason, rather than quietly landing somewhere private. */
    let failed = 0;
    let reason = '';
    for (let i = 0; i < list.length; i++) {
      setBusy(`Uploading ${i + 1} of ${list.length}…`);
      try {
        await uploadShared(list[i], b, uploadCat);
      } catch (e: any) {
        failed++;
        reason = reason || String(e?.message || e);
        console.warn('upload failed', e);
      }
    }
    await refreshShared();
    setBusy(null);
    if (failed) {
      window.alert(
        `${failed} file${failed === 1 ? '' : 's'} could not be uploaded, so ${failed === 1 ? 'it was' : 'they were'} not added.\n\n${reason}`
      );
    }
  }

  /* The repair path for anything uploaded before there was a shared library.
   * Same id either side, so every deck pointing at these starts resolving the
   * moment they land — nothing has to be re-pointed and nothing re-dropped. */
  async function publishMine() {
    const all = await listUploads();
    if (!all.length) return;
    let failed = 0;
    let reason = '';
    for (let i = 0; i < all.length; i++) {
      setBusy(`Publishing ${i + 1} of ${all.length}…`);
      try {
        await publishUpload(all[i]);
        await removeUpload(all[i].id);
      } catch (e: any) {
        failed++;
        reason = reason || String(e?.message || e);
      }
    }
    await refreshShared();
    await refreshUploads();
    setBusy(null);
    window.alert(
      failed
        ? `${all.length - failed} of ${all.length} published. ${failed} failed.\n\n${reason}`
        : `${all.length} picture${all.length === 1 ? '' : 's'} published. Every deck using them now reads from the library.`
    );
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
        <Select
          style={{ marginBottom: 8 }}
          ariaLabel="Filter by category"
          value={cat}
          onChange={(v) => setCat(v as any)}
          options={[
            { value: 'All', label: 'All categories' },
            ...ASSET_CATEGORIES.map((c) => ({ value: c, label: c })),
          ]}
        />
        <input
          className="field"
          placeholder="Search by product name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {searching && (
          <p className="tiny" style={{ marginTop: 6 }}>
            {matched.length === 0
              ? `Nothing matches “${q.trim()}” in ${THEMES[b].shortName}.`
              : `${matched.length} match${matched.length === 1 ? '' : 'es'} across every category${
                  matched.length > 120 ? ' — showing the first 120' : ''
                }.`}
          </p>
        )}
      </div>

      {/* ------------------------------------------------------- upload ---- */}
      <div className="panel-sec">
        <div className="label" style={{ marginBottom: 6 }}>
          Add to {THEMES[b].shortName}
        </div>
        <Select
          style={{ marginBottom: 8 }}
          ariaLabel="Upload category"
          value={uploadCat}
          onChange={(v) => setUploadCat(v as AssetCategory)}
          options={UPLOAD_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />

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

        {mine.length > 0 && (
          <div className="warn" style={{ marginTop: 12 }}>
            <span>△</span>
            <span>
              <b>
                {mine.length} picture{mine.length === 1 ? '' : 's'}{mine.length === 1 ? ' is' : ' are'} only
                on this computer.
              </b>{' '}
              Nobody else can see {mine.length === 1 ? 'it' : 'them'}, and clearing this browser would
              lose {mine.length === 1 ? 'it' : 'them'}. Publishing puts {mine.length === 1 ? 'it' : 'them'} in
              the library — every deck already using {mine.length === 1 ? 'it' : 'them'} starts working
              again straight away.
              <button
                className="btn sm"
                style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
                disabled={!!busy || !lib.reachable}
                onClick={publishMine}
              >
                {busy || `Publish ${mine.length} to the library`}
              </button>
            </span>
          </div>
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
                  e.dataTransfer.setData('application/x-vigo-asset', storableUrl(a));
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
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 7h16" />
                      <path d="M10 4h4a1 1 0 0 1 1 1v2H9V5a1 1 0 0 1 1-1z" />
                      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
                    </svg>
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
          {!lib.reachable ? (
            <>
              <b>The library cannot be reached.</b> Pictures are stored on the server, so until this
              comes back nothing can be uploaded and pictures already placed may not appear. Nothing
              has been lost — this is a connection to storage, not the pictures themselves.
            </>
          ) : (
            <>
              <b>Shared library — {lib.count} file{lib.count === 1 ? '' : 's'}.</b> Everything here is
              stored online and visible to everyone on the team and to anyone opening a published
              link. Upload a file with the same name to replace it everywhere it is used.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
