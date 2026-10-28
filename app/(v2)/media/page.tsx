'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAssets, type LibraryAsset } from '@/components/v2/MediaGrid';
import { useApp } from '@/components/v2/Shell';
import { uploadShared } from '@/lib/assets/sharedUpload';
import type { BrandId } from '@/lib/brand/themes';
import type { AssetCategory } from '@/lib/model/types';

/**
 * MEDIA LIBRARY
 * ---------------------------------------------------------------------------
 * Folders down the left, everything in the chosen folder on the right.
 *  - Drag files in from the computer anywhere on the page: a drop box appears
 *    and they go into the open folder (or straight onto any folder in the list).
 *  - Drag a picture — or a selection of them — onto a folder to move it.
 *  - Add a folder whenever one is needed; rename by double-clicking it.
 * Moving changes only the record: the file keeps its address, so decks that
 * use it are untouched.
 */

interface Folder {
  id: string;
  name: string;
  core: boolean;
}

const INBOX = 'New uploads';
const label = (name: string) => (name === 'Product Photography' ? 'Products' : name);
const ITEM = 'application/x-vigo-library-ids';
const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
const hasItems = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes(ITEM);

export default function MediaLibrary() {
  const { brands, toast } = useApp();
  const { assets, reload } = useAssets();
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [brand, setBrand] = useState('all');
  const [folder, setFolder] = useState<string>('all'); // folder name, or 'all'
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [fileDrag, setFileDrag] = useState(false);
  const [itemDrag, setItemDrag] = useState(false);
  const [over, setOver] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ done: number; total: number; label: string } | null>(null);
  const depth = useRef(0);

  const loadFolders = useCallback(
    () =>
      fetch('/api/media/folders', { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => setFolders(j.folders || []))
        .catch(() => setFolders([])),
    []
  );
  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const brandName = (id: string) => brands?.find((b) => b.id === id)?.name || id;
  const dropBrand = brand === 'all' ? 'corporate' : brand;

  const inBrand = useMemo(() => (assets || []).filter((a) => brand === 'all' || a.brand === brand), [assets, brand]);
  const count = (name: string) => inBrand.filter((a) => a.category === name).length;
  const used = (name: string) => (assets || []).some((a) => a.category === name);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inBrand.filter((a) => (folder === 'all' || a.category === folder) && (!q || a.name.toLowerCase().includes(q)));
  }, [inBrand, folder, query]);

  // a selection only means something for what is on screen
  useEffect(() => setSelected(new Set()), [brand, folder]);

  /* ------------------------------------------------------------ folders */
  const ensureFolder = async (name: string) => {
    if (folders?.some((f) => f.name.toLowerCase() === name.toLowerCase())) return;
    await fetch('/api/media/folders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) }).catch(() => {});
    await loadFolders();
  };

  const addFolder = async () => {
    const name = newName.trim();
    if (!name) return setAdding(false);
    const r = await fetch('/api/media/folders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toast(j.error || 'That folder could not be added.');
    setNewName('');
    setAdding(false);
    await loadFolders();
    setFolder(j.folder.name);
    toast(`Added “${name}”. Drag pictures onto it.`);
  };

  const renameFolder = async (f: Folder, name: string) => {
    setRenaming(null);
    name = name.trim();
    if (!name || name === f.name || name === label(f.name)) return;
    const r = await fetch('/api/media/folders', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: f.id, name }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toast(j.error || 'That folder could not be renamed.');
    if (folder === f.name) setFolder(name);
    await Promise.all([loadFolders(), reload()]);
  };

  const deleteFolder = async (f: Folder) => {
    if (!confirm(`Delete the folder “${label(f.name)}”?`)) return;
    const r = await fetch('/api/media/folders?id=' + encodeURIComponent(f.id), { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toast(j.error || 'That folder could not be deleted.');
    if (folder === f.name) setFolder('all');
    loadFolders();
  };

  /* --------------------------------------------------------- uploading */
  const upload = async (files: File[], into: string | null) => {
    const ok = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (!ok.length) return toast('Only pictures and video can go in the library.');
    // no folder chosen: video goes to Video, the rest wait in New uploads to be filed
    const target = (f: File) => into || (f.type.startsWith('video/') ? 'Video' : INBOX);
    if (ok.some((f) => target(f) === INBOX)) await ensureFolder(INBOX);
    const where = into ? label(into) : 'the library';
    let done = 0;
    const failed: string[] = [];
    setBusy({ done, total: ok.length, label: 'Adding to ' + where });
    for (const f of ok) {
      try {
        await uploadShared(f, dropBrand as BrandId, target(f) as AssetCategory);
      } catch {
        failed.push(f.name);
      }
      setBusy({ done: ++done, total: ok.length, label: 'Adding to ' + where });
    }
    setBusy(null);
    await reload();
    toast(failed.length ? `Added ${ok.length - failed.length}; ${failed.length} could not be uploaded` : `Added ${ok.length} to ${where}`);
  };

  /* ------------------------------------------------------------ moving */
  const move = async (ids: string[], to: string) => {
    const moving = ids.filter((id) => assets?.find((a) => a.id === id)?.category !== to);
    if (!moving.length) return;
    let done = 0;
    let failed = 0;
    setBusy({ done, total: moving.length, label: 'Moving to ' + label(to) });
    for (const id of moving) {
      const r = await fetch('/api/assets/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: to }),
      }).catch(() => null);
      if (!r?.ok) failed++;
      setBusy({ done: ++done, total: moving.length, label: 'Moving to ' + label(to) });
    }
    setBusy(null);
    setSelected(new Set());
    await reload();
    toast(failed ? `Moved ${moving.length - failed}; ${failed} could not be moved` : `Moved ${moving.length} to ${label(to)}`);
  };

  /* ------------------------------------------------------ drag handling */
  const resetDrag = () => {
    depth.current = 0;
    setFileDrag(false);
    setItemDrag(false);
    setOver(null);
  };

  /** Anything that can receive files or pictures: a folder, or the drop box. */
  const dropTarget = (key: string, into: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!hasFiles(e) && !hasItems(e)) return;
      if (hasItems(e) && !into) return; // pictures move into a folder, not "all"
      e.preventDefault();
      e.dataTransfer.dropEffect = hasFiles(e) ? 'copy' : 'move';
      if (over !== key) setOver(key);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOver((o) => (o === key ? null : o));
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const ids = (e.dataTransfer.getData(ITEM) || '').split('\n').filter(Boolean);
      const files = Array.from(e.dataTransfer.files || []);
      resetDrag();
      if (ids.length && into) move(ids, into);
      else if (files.length) upload(files, into);
    },
  });

  const clickItem = (e: React.MouseEvent, a: LibraryAsset) => {
    const next = new Set(selected);
    if (e.shiftKey && anchor) {
      const ids = shown.map((x) => x.id);
      const [i, j] = [ids.indexOf(anchor), ids.indexOf(a.id)].sort((x, y) => x - y);
      ids.slice(i, j + 1).forEach((id) => next.add(id));
    } else if (next.has(a.id)) next.delete(a.id);
    else next.add(a.id);
    setAnchor(a.id);
    setSelected(next);
  };

  const openFolder = folder === 'all' ? null : folder;

  return (
    <div
      className="ml"
      onDragEnter={(e) => {
        if (hasFiles(e)) {
          depth.current++;
          setFileDrag(true);
        }
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) resetDrag();
      }}
      onDragOver={(e) => hasFiles(e) && e.preventDefault()}
      onDrop={(e) => {
        // a file let go anywhere on the page still lands in the library
        if (!hasFiles(e)) return;
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files || []);
        resetDrag();
        if (files.length) upload(files, openFolder);
      }}
    >
      <div className="v2-head">
        <div>
          <h1 className="t-title">Media library</h1>
          <p className="t-small">Drag pictures or video in from your computer. Click to select, then drag onto a folder to move.</p>
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
        <input className="search" type="search" placeholder="Search by name" aria-label="Search media" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="ml-body">
        {/* ------------------------------------------------ folder rail */}
        <nav className={'ml-rail' + (fileDrag || itemDrag ? ' receiving' : '')} aria-label="Folders">
          <button className={'ml-folder' + (folder === 'all' ? ' on' : '')} onClick={() => setFolder('all')}>
            <span className="ml-icon all" aria-hidden="true" />
            <span className="ml-name">All media</span>
            <span className="ml-count">{inBrand.length}</span>
          </button>
          {(folders || []).map((f) => (
            <div
              key={f.id}
              className={'ml-folder' + (folder === f.name ? ' on' : '') + (over === 'f:' + f.id ? ' over' : '')}
              role="button"
              tabIndex={0}
              onClick={() => setFolder(f.name)}
              onKeyDown={(e) => e.key === 'Enter' && setFolder(f.name)}
              onDoubleClick={() => setRenaming(f.id)}
              title="Double-click to rename"
              {...dropTarget('f:' + f.id, f.name)}
            >
              <span className="ml-icon" aria-hidden="true" />
              {renaming === f.id ? (
                <input
                  className="ml-rename"
                  autoFocus
                  defaultValue={label(f.name)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => renameFolder(f, e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                />
              ) : (
                <span className="ml-name">{label(f.name)}</span>
              )}
              <span className="ml-count">{count(f.name)}</span>
              {!f.core && !used(f.name) && (
                <button
                  className="ml-del"
                  aria-label={`Delete ${label(f.name)}`}
                  title="Delete this empty folder"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFolder(f);
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {adding ? (
            <div className="ml-folder ml-new-input">
              <span className="ml-icon" aria-hidden="true" />
              <input
                autoFocus
                placeholder="Folder name"
                value={newName}
                maxLength={40}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={addFolder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addFolder();
                  if (e.key === 'Escape') {
                    setNewName('');
                    setAdding(false);
                  }
                }}
              />
            </div>
          ) : (
            <button className="ml-add" onClick={() => setAdding(true)}>
              + New folder
            </button>
          )}
        </nav>

        {/* ------------------------------------------------ the grid */}
        <section className="ml-main">
          {busy && (
            <div className="ml-progress" role="status">
              <i style={{ width: (busy.done / busy.total) * 100 + '%' }} />
              <span>
                {busy.label}: {busy.done} of {busy.total}
              </span>
            </div>
          )}

          {selected.size > 0 && (
            <div className="ml-selbar">
              <b>{selected.size} selected</b>
              <span>Drag onto a folder, or</span>
              <select aria-label="Move to folder" value="" onChange={(e) => e.target.value && move([...selected], e.target.value)}>
                <option value="">Move to…</option>
                {(folders || []).map((f) => (
                  <option key={f.id} value={f.name}>
                    {label(f.name)}
                  </option>
                ))}
              </select>
              <button onClick={() => setSelected(new Set(shown.map((a) => a.id)))}>Select all {shown.length}</button>
              <button onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}

          {fileDrag && (
            <div className={'ml-dropbox' + (over === 'box' ? ' over' : '')} {...dropTarget('box', openFolder)}>
              <b>Drop to add to {openFolder ? label(openFolder) : 'the library'}</b>
              <span>
                Filed under {brandName(dropBrand)}
                {brand === 'all' ? ' (pick a brand above to file under another)' : ''}.
                {openFolder ? '' : ' Video goes to Video; pictures wait in New uploads for you to file.'}
              </span>
              <em>Or drop straight onto a folder on the left.</em>
            </div>
          )}

          {assets === null ? (
            <p className="t-small">Loading…</p>
          ) : shown.length === 0 && !fileDrag ? (
            <div className="empty2">
              <h3 className="t-section">{query ? 'Nothing matches that search' : 'This folder is empty'}</h3>
              <p>{query ? 'Try another name.' : 'Drag pictures or video here from your computer, or drag them in from another folder.'}</p>
            </div>
          ) : (
            <div className={'ml-grid' + (fileDrag ? ' dim' : '')}>
              {shown.map((a) => {
                const isSel = selected.has(a.id);
                return (
                  <figure
                    key={a.id}
                    className={'ml-item' + (a.category === 'Logos' ? ' logo' : '') + (isSel ? ' sel' : '')}
                    draggable
                    onDragStart={(e) => {
                      const ids = isSel ? [...selected] : [a.id];
                      e.dataTransfer.setData(ITEM, ids.join('\n'));
                      e.dataTransfer.effectAllowed = 'move';
                      if (ids.length > 1) {
                        const ghost = document.createElement('div');
                        ghost.className = 'ml-ghost';
                        ghost.textContent = `${ids.length} items`;
                        document.body.appendChild(ghost);
                        e.dataTransfer.setDragImage(ghost, 20, 20);
                        setTimeout(() => ghost.remove(), 0);
                      }
                      setItemDrag(true);
                    }}
                    onDragEnd={resetDrag}
                    onClick={(e) => clickItem(e, a)}
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
                        <img src={a.path} alt={a.name} loading="lazy" draggable={false} />
                      )}
                      <span className="ml-check" aria-hidden="true" />
                    </div>
                    <figcaption title={a.name}>
                      {a.name}
                      <span>
                        {brand === 'all' ? brandName(a.brand) + ', ' : ''}
                        {label(a.category)}
                      </span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
