'use client';

import { useMemo, useState } from 'react';
import { TEMPLATE_CATEGORIES, templatesByCategory, getTemplate } from '@/lib/templates/registry';
import type { PageTemplate } from '@/lib/templates/registry';
import type { BrandId } from '@/lib/brand/themes';

/**
 * PICK A LAYOUT BY LOOKING AT IT
 * ---------------------------------------------------------------------------
 * A dropdown of forty-five layout names asks the user to remember what
 * "Statement + Company" looks like. A picture asks them to point.
 *
 * The picture is a SCHEMATIC, not a miniature of the slide. The first attempt
 * rendered a real Stage scaled down with a transform, which was wrong twice
 * over: a 1600px stage transform-scaled into a 128px box breaks the moment the
 * panel is narrower than the arithmetic assumed, and even when it fitted, a
 * slide at 128px is a grey smudge with unreadable placeholder text. Nobody
 * chooses a layout by reading it — they choose it by its SHAPE.
 *
 * So the thumbnail is drawn from the template's own grid: same columns, same
 * rows, same areas. It is fluid, so it cannot overflow; it is cheap, so all
 * forty-five can exist at once; and it stays accurate for free, because it is
 * generated from the layout definition rather than maintained beside it.
 */
export default function LayoutPicker({
  brand,
  templateId,
  onPick,
}: {
  brand: BrandId;
  templateId: string;
  onPick: (id: string) => void;
}) {
  const current = getTemplate(templateId);
  const [open, setOpen] = useState(false);
  /* Opens on the category the page is already in — the layout someone wants
   * next is usually a neighbour of the one they have. */
  const [cat, setCat] = useState<string>(current.category);

  const groups = useMemo(() => templatesByCategory(), []);
  const items = useMemo(
    () => groups.filter((g) => g.category === cat).flatMap((g) => g.items),
    [groups, cat]
  );

  return (
    <div className="layout-picker">
      <button className={'lp-current' + (open ? ' open' : '')} onClick={() => setOpen(!open)}>
        <Schematic t={current} />
        <span className="lp-meta">
          <b>{current.name}</b>
          <i>{open ? 'Close' : 'Change layout'}</i>
        </span>
      </button>

      {open ? (
        <div className="lp-body">
          <div className="lp-cats">
            {TEMPLATE_CATEGORIES.map((c) => (
              <button key={c} className={'chip sm' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>

          <div className="lp-grid">
            {items.map((t) => (
              <button
                key={t.id}
                className={'lp-item' + (t.id === templateId ? ' on' : '')}
                title={t.hint}
                onClick={() => {
                  onPick(t.id);
                  setOpen(false);
                }}
              >
                <Schematic t={t} />
                <span className="lp-name">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The layout, drawn as itself. Auto-sized tracks are given a share of the box
 * — in a real page they are sized by their content, and a schematic has none.
 */
function Schematic({ t }: { t: PageTemplate }) {
  const l = t.layout;

  const areas = useMemo(() => {
    const seen: string[] = [];
    l.areas.forEach((row) =>
      row.split(/\s+/).forEach((a) => {
        if (a && a !== '.' && !seen.includes(a)) seen.push(a);
      })
    );
    return seen;
  }, [l.areas]);

  const track = (s: string) => s.replace(/minmax\(0,\s*/g, '').replace(/\)/g, '').replace(/auto/g, '0.4fr');

  return (
    <span
      className="lp-schema"
      aria-hidden="true"
      style={{
        gridTemplateColumns: track(l.columns),
        gridTemplateRows: track(l.rows),
        gridTemplateAreas: l.areas.map((a) => `"${a}"`).join(' '),
      }}
    >
      {areas.map((a) => {
        const slot = t.slots.find((s) => s.key === a);
        const kind =
          slot && slot.accepts.some((x) => x === 'image' || x === 'video')
            ? 'media'
            : a === 'head' || a === 'top'
              ? 'head'
              : 'body';
        /* A slot that holds several blocks is drawn as several — otherwise
         * Three Cards and Six Cards are the same picture, which is exactly
         * the distinction this deck spent a morning getting right. */
        const n = kind === 'body' && slot?.max && slot.max > 1 ? Math.min(slot.max, 6) : 0;
        if (n > 1) {
          return (
            <span key={a} className="lp-sub" style={{ gridArea: a, gridTemplateColumns: `repeat(${Math.min(n, 3)}, 1fr)` }}>
              {Array.from({ length: n }).map((_, i) => (
                <span key={i} className="lp-cell is-body" />
              ))}
            </span>
          );
        }
        return <span key={a} className={'lp-cell is-' + kind} style={{ gridArea: a }} />;
      })}
    </span>
  );
}
