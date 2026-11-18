'use client';

import { useEffect, useMemo, useRef } from 'react';
import Stage from '@/components/render/Stage';
import type { Page } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';
import { alternatesFor } from '@/lib/model/alternates';

/**
 * QUICK FORMAT
 * This slide, redrawn in the layouts that hold its content best. One click
 * swaps; undo puts it back. "All layouts" opens the full gallery.
 */
export default function QuickLayout({
  page,
  brand,
  onPick,
  onBrowse,
  onClose,
}: {
  page: Page;
  brand: BrandId;
  onPick: (templateId: string) => void;
  onBrowse: () => void;
  onClose: () => void;
}) {
  const alts = useMemo(() => alternatesFor(page, 8), [page]);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const m = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('.ql-trigger')) onClose();
    };
    window.addEventListener('keydown', k);
    window.addEventListener('mousedown', m);
    return () => {
      window.removeEventListener('keydown', k);
      window.removeEventListener('mousedown', m);
    };
  }, [onClose]);

  return (
    <div className="ql" ref={box} role="dialog" aria-label="Change this slide's layout" onMouseDown={(e) => e.stopPropagation()}>
      <div className="ql-head">
        <b>Try another layout</b>
        <span>Your words and pictures carry across. Undo puts it back.</span>
      </div>
      {alts.length === 0 ? (
        <p className="ql-empty">No other layout holds this slide&rsquo;s content. Browse all layouts to pick one anyway.</p>
      ) : (
        <div className="ql-grid">
          {alts.map((a) => (
            <button key={a.templateId} className="ql-item" onClick={() => onPick(a.templateId)} title={'Switch to ' + a.name}>
              <div className="ql-thumb">
                <div className="ql-stage">
                  <Stage page={a.page} brand={brand} />
                </div>
              </div>
              <span className="ql-name">{a.name}</span>
              {a.lost ? <span className="ql-note">Leaves out {a.lost} item{a.lost > 1 ? 's' : ''}</span> : null}
            </button>
          ))}
        </div>
      )}
      <div className="ql-foot">
        <button className="ql-all" onClick={onBrowse}>
          Browse all layouts
        </button>
      </div>
    </div>
  );
}
