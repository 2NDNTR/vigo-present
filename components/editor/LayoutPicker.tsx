'use client';

import { useMemo, useState } from 'react';
import Stage from '@/components/render/Stage';
import { TEMPLATE_CATEGORIES, templatesByCategory, getTemplate, createPage } from '@/lib/templates/registry';
import type { BrandId } from '@/lib/brand/themes';

/**
 * PICK A LAYOUT BY LOOKING AT IT
 * ---------------------------------------------------------------------------
 * A dropdown of forty-five layout names asks the user to remember what
 * "Statement + Company" looks like. A grid of the actual layouts asks them to
 * point. Same data, same click count, and nobody has to hold a picture in
 * their head between reading the name and seeing the result.
 *
 * The thumbnails are real Stages, not screenshots — so they are always current,
 * always in the deck's own brand, and cost nothing to keep in sync. They are
 * built only while the picker is open and only for the category on screen:
 * forty-five live stages mounted in a side panel is a scroll janking its way
 * to a stop.
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
  const samples = useMemo(() => {
    if (!open) return {};
    const m: Record<string, any> = {};
    items.forEach((t) => (m[t.id] = createPage(t.id, undefined, brand)));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items, brand]);

  const currentSample = useMemo(() => createPage(templateId, undefined, brand), [templateId, brand]);

  return (
    <div className="layout-picker">
      {/* The current layout, shown rather than named. Clicking it is the way in. */}
      <button className={'lp-current' + (open ? ' open' : '')} onClick={() => setOpen(!open)}>
        <span className="lp-thumb">
          <span style={{ pointerEvents: 'none' }}>
            <Stage page={currentSample} brand={brand} />
          </span>
        </span>
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
                <span className="lp-thumb">
                  <span style={{ pointerEvents: 'none' }}>
                    <Stage page={samples[t.id]} brand={brand} />
                  </span>
                </span>
                <span className="lp-name">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
