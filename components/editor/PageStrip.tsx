'use client';

import { useEffect, useRef, useState } from 'react';
import Stage from '@/components/render/Stage';
import type { Page } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';
import { getTemplate } from '@/lib/templates/registry';

/**
 * THE PAGE STRIP
 * ---------------------------------------------------------------------------
 * The pages used to run down a rail on the left, where a 216px column showed
 * five of sixteen and took 216px of canvas to do it. A deck is a SEQUENCE, and
 * a sequence reads left to right: laid along the bottom, the same strip shows
 * eight to fourteen pages in the space a caption used to need, and the canvas
 * gets the width back.
 *
 * Small, medium, large is one control doing two jobs. Large is for arranging —
 * you can see which page is the chart one. Small is for a long deck, where
 * what you want is the shape of the whole thing at once. Nobody needs both at
 * the same moment, so it is a toggle rather than a scrollbar you fight.
 *
 * The thumbnails are real Stages, not pictures of them: a page that changes is
 * already correct down here, with no render step and nothing to go stale.
 */

const SIZES = { s: 92, m: 132, l: 188 } as const;
type Size = keyof typeof SIZES;

/* A preference, not data — it belongs to this person's screen, so it stays in
 * this browser and never rides along with the deck. */
const KEY = 'presente.strip.size';

export default function PageStrip({
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
  const [size, setSize] = useState<Size>('m');
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<{ i: number; half: 'left' | 'right' } | null>(null);
  /* A horizontal scroller clips its children vertically too — `overflow-x:
   * auto` makes `overflow-y: visible` compute to `auto` — so a menu drawn
   * inside a tile would be cut off by the strip. It is drawn outside the
   * scroller at fixed coordinates taken from the button that opened it. */
  const [menu, setMenu] = useState<{ i: number; x: number; y: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const currentEl = useRef<HTMLDivElement>(null);

  /* Read after mount, never during render: the server has no localStorage, and
   * a first paint that disagrees with the second is a hydration error. */
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(KEY);
      if (v === 's' || v === 'm' || v === 'l') setSize(v);
    } catch {
      /* private mode — the default is a fine answer */
    }
  }, []);

  const pick = (v: Size) => {
    setSize(v);
    try {
      window.localStorage.setItem(KEY, v);
    } catch {
      /* nothing to do: it just will not be remembered */
    }
  };

  /* Page fourteen of sixteen is off the end of the strip. Anything that moves
   * the current page — clicking a note, the wizard, an arrow key — has to
   * bring it back into view, or the strip quietly stops telling the truth
   * about where you are. */
  useEffect(() => {
    currentEl.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [currentId, size]);

  /* A menu pinned to the viewport has to close when the page moves under it. */
  useEffect(() => {
    if (!menu) return;
    const shut = () => setMenu(null);
    window.addEventListener('mousedown', shut);
    window.addEventListener('scroll', shut, true);
    window.addEventListener('resize', shut);
    return () => {
      window.removeEventListener('mousedown', shut);
      window.removeEventListener('scroll', shut, true);
      window.removeEventListener('resize', shut);
    };
  }, [menu]);

  /* The strip is one row, so a trackpad's vertical flick should move it
   * sideways — otherwise the gesture does nothing and reads as broken. */
  const onWheel = (e: React.WheelEvent) => {
    const el = scroller.current;
    if (!el || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    el.scrollLeft += e.deltaY;
  };

  return (
    <div className="ed-strip" data-size={size} style={{ ['--tw' as string]: SIZES[size] + 'px' }}>
      <div className="strip-scroll" ref={scroller} onWheel={onWheel}>
        {pages.map((p, i) => {
          const t = getTemplate(p.templateId);
          const on = p.id === currentId;
          return (
            <div
              key={p.id}
              ref={on ? currentEl : undefined}
              className={
                'strip-item' +
                (on ? ' on' : '') +
                (p.sectionStart !== undefined ? ' sec' : '') +
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
                setOver({ i, half: e.clientX < r.left + r.width / 2 ? 'left' : 'right' });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (drag === null || !over) return;
                let to = over.half === 'left' ? over.i : over.i + 1;
                if (drag < to) to -= 1;
                onReorder(drag, to);
                setDrag(null);
                setOver(null);
              }}
              onClick={() => onSelect(p.id)}
            >
              {/* One lane along the top of the strip, present on every tile so
                  the thumbnails line up whether or not a section starts here. */}
              <div className="strip-sec">
                {p.sectionStart !== undefined ? (
                  <input
                    value={p.sectionStart}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onRenameSection(i, e.target.value)}
                    placeholder="Section"
                  />
                ) : null}
              </div>

              <div className="strip-thumb">
                <div style={{ pointerEvents: 'none' }}>
                  <Stage page={p} brand={brand} />
                </div>
              </div>

              <div className="strip-cap">
                <b>{i + 1}</b>
                <span className="tname">{t.name}</span>
                <button
                  className="strip-more"
                  aria-label="Page actions"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setMenu(menu?.i === i ? null : { i, x: r.right, y: window.innerHeight - r.top + 6 });
                  }}
                >
                  ⋯
                </button>
              </div>

            </div>
          );
        })}

        <button className="strip-add" title="Add a page at the end" onClick={() => onAddAfter(pages.length - 1)}>
          +
        </button>
      </div>

      {menu ? (
        <div
          className="menu strip-menu"
          style={{ right: window.innerWidth - menu.x, bottom: menu.y }}
          /* The close-on-mousedown listener above fires before any click, so
             without this a menu item would unmount before it was chosen. */
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { onDuplicate(menu.i); setMenu(null); }}>Duplicate</button>
          <button onClick={() => { onAddAfter(menu.i); setMenu(null); }}>Add page after</button>
          <button
            onClick={() => {
              const p = pages[menu.i];
              onRenameSection(menu.i, p.sectionStart === undefined ? 'New section' : (undefined as any));
              setMenu(null);
            }}
          >
            {pages[menu.i]?.sectionStart === undefined ? 'Start a section here' : 'Remove section break'}
          </button>
          <button className="danger" onClick={() => { onDelete(menu.i); setMenu(null); }}>Delete</button>
        </div>
      ) : null}

      <div className="strip-tools">
        <span className="strip-count">
          {pages.length} page{pages.length === 1 ? '' : 's'}
        </span>
        <div className="seg strip-size">
          {(['s', 'm', 'l'] as Size[]).map((v) => (
            <button
              key={v}
              className={size === v ? 'on' : ''}
              onClick={() => pick(v)}
              title={v === 's' ? 'Small — see the whole deck' : v === 'm' ? 'Medium' : 'Large — see what is on each page'}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
