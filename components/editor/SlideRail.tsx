'use client';

import { useEffect, useRef, useState } from 'react';
import Stage from '@/components/render/Stage';
import type { Page } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';

/**
 * The slides, down the left like every slide tool people already know. Real
 * Stages, so a thumbnail is never stale. Drag to reorder; the small menu on a
 * slide duplicates or deletes it; "New slide" opens the layout gallery.
 */
export default function SlideRail({
  pages,
  brand,
  currentId,
  onSelect,
  onReorder,
  onDuplicate,
  onDelete,
  onAdd,
  onLayout,
}: {
  pages: Page[];
  brand: BrandId;
  currentId: string;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onDuplicate: (i: number) => void;
  onDelete: (i: number) => void;
  onAdd: (afterIndex: number) => void;
  onLayout?: (id: string) => void;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<{ i: number; half: 'top' | 'bottom' } | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const currentEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    currentEl.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentId]);

  useEffect(() => {
    if (menu === null) return;
    const shut = () => setMenu(null);
    window.addEventListener('mousedown', shut);
    return () => window.removeEventListener('mousedown', shut);
  }, [menu]);

  const idx = pages.findIndex((p) => p.id === currentId);

  return (
    <nav
      className="rail"
      aria-label="Slides"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown' && idx < pages.length - 1) {
          e.preventDefault();
          onSelect(pages[idx + 1].id);
        } else if (e.key === 'ArrowUp' && idx > 0) {
          e.preventDefault();
          onSelect(pages[idx - 1].id);
        }
      }}
    >
      <div className="rail-list">
        {pages.map((p, i) => {
          const on = p.id === currentId;
          return (
            <div
              key={p.id}
              ref={on ? currentEl : undefined}
              className={
                'rail-item' +
                (on ? ' on' : '') +
                (drag === i ? ' dragging' : '') +
                (over && over.i === i ? ' over-' + over.half : '')
              }
              draggable
              onDragStart={(e) => {
                setDrag(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                setDrag(null);
                setOver(null);
              }}
              onDragOver={(e) => {
                if (drag === null) return;
                e.preventDefault();
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setOver({ i, half: e.clientY < r.top + r.height / 2 ? 'top' : 'bottom' });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (drag === null || !over) return;
                let to = over.half === 'top' ? over.i : over.i + 1;
                if (drag < to) to -= 1;
                if (to !== drag) onReorder(drag, to);
                setDrag(null);
                setOver(null);
              }}
              onClick={() => onSelect(p.id)}
            >
              <span className="rail-num">{i + 1}</span>
              <div className="rail-thumb">
                <div className="rail-stage">
                  <Stage page={p} brand={brand} />
                </div>
                <button
                  className="rail-more"
                  aria-label={`Slide ${i + 1} actions`}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenu(menu === i ? null : i);
                  }}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="12.5" cy="8" r="1.2" /></svg>
                </button>
                {menu === i ? (
                  <div className="menu rail-menu" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { onAdd(i); setMenu(null); }}>New slide after</button>
                    {onLayout ? <button onClick={() => { onLayout(p.id); setMenu(null); }}>Change layout</button> : null}
                    <button onClick={() => { onDuplicate(i); setMenu(null); }}>Duplicate</button>
                    {pages.length > 1 ? (
                      <button className="danger" onClick={() => { onDelete(i); setMenu(null); }}>Delete</button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <button className="rail-new" onClick={() => onAdd(Math.max(0, idx))}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
        New slide
      </button>
    </nav>
  );
}
