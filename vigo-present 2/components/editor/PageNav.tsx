'use client';

import { useState } from 'react';
import Stage from '@/components/render/Stage';
import type { Page } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';
import { getTemplate } from '@/lib/templates/registry';

export default function PageNav({
  pages,
  brand,
  currentId,
  onSelect,
  onReorder,
  onDuplicate,
  onDelete,
  onAddAfter,
  onRenameSection,
}: {
  pages: Page[];
  brand: BrandId;
  currentId: string;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onDuplicate: (i: number) => void;
  onDelete: (i: number) => void;
  onAddAfter: (i: number) => void;
  onRenameSection: (i: number, name: string) => void;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<{ i: number; half: 'top' | 'bottom' } | null>(null);
  const [menu, setMenu] = useState<number | null>(null);

  return (
    <div>
      {pages.map((p, i) => {
        const t = getTemplate(p.templateId);
        return (
          <div key={p.id}>
            {p.sectionStart !== undefined && (
              <div className="navsection">
                <input
                  value={p.sectionStart}
                  onChange={(e) => onRenameSection(i, e.target.value)}
                  placeholder="Section"
                />
              </div>
            )}
            <div
              className={
                'navpage' +
                (p.id === currentId ? ' on' : '') +
                (drag === i ? ' dragging' : '') +
                (over && over.i === i ? ' dragover-' + over.half : '')
              }
              draggable
              onDragStart={() => setDrag(i)}
              onDragEnd={() => {
                setDrag(null);
                setOver(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setOver({ i, half: e.clientY < r.top + r.height / 2 ? 'top' : 'bottom' });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (drag === null || !over) return;
                let to = over.half === 'top' ? over.i : over.i + 1;
                if (drag < to) to -= 1;
                onReorder(drag, to);
                setDrag(null);
                setOver(null);
              }}
              onClick={() => onSelect(p.id)}
            >
              <div className="thumb">
                <div style={{ pointerEvents: 'none' }}>
                  <Stage page={p} brand={brand} />
                </div>
              </div>
              <div className="rowline">
                <span className="pname">
                  {i + 1}. {t.name}
                </span>
                <button
                  className="icon-btn"
                  style={{ width: 20, height: 20, borderColor: 'transparent', background: 'transparent', fontSize: 12 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenu(menu === i ? null : i);
                  }}
                >
                  ⋯
                </button>
              </div>
              {menu === i && (
                <div className="menu" style={{ top: 'auto', right: 0 }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { onDuplicate(i); setMenu(null); }}>Duplicate</button>
                  <button onClick={() => { onAddAfter(i); setMenu(null); }}>Add page after</button>
                  <button
                    onClick={() => {
                      onRenameSection(i, p.sectionStart === undefined ? 'New section' : undefined as any);
                      setMenu(null);
                    }}
                  >
                    {p.sectionStart === undefined ? 'Start a section here' : 'Remove section break'}
                  </button>
                  <button className="danger" onClick={() => { onDelete(i); setMenu(null); }}>Delete</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <button className="addpage" onClick={() => onAddAfter(pages.length - 1)}>
        + Add page
      </button>
    </div>
  );
}
