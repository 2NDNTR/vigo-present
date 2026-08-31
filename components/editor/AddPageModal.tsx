'use client';

import { useMemo, useState } from 'react';
import Stage from '@/components/render/Stage';
import { TEMPLATE_CATEGORIES, templatesByCategory, createPage } from '@/lib/templates/registry';
import type { BrandId } from '@/lib/brand/themes';

/**
 * Nobody starts with a blank page. Choosing "Add page" opens a library of
 * finished layouts — the user picks a shape, not a canvas.
 */
export default function AddPageModal({
  brand,
  onClose,
  onPick,
}: {
  brand: BrandId;
  onClose: () => void;
  onPick: (templateId: string) => void;
}) {
  const [cat, setCat] = useState<string>('All');
  const groups = useMemo(() => templatesByCategory(), []);
  // Rebuilt per brand: the placeholder plates are baked in at creation, so a
  // preview made for one brand would keep showing that brand's colours.
  const samples = useMemo(() => {
    const m: Record<string, any> = {};
    groups.forEach((g) => g.items.forEach((t) => (m[t.id] = createPage(t.id, undefined, brand))));
    return m;
  }, [groups, brand]);

  const visible = groups.filter((g) => cat === 'All' || g.category === cat);

  return (
    <div className="scrim-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide">
        <div className="modal-head" style={{ paddingBottom: 18 }}>
          <h2>Add a page</h2>
          <p className="sub">Every layout is already designed. Pick one and replace the content.</p>
        </div>
        <div className="modal-body" style={{ paddingTop: 0 }}>
          <div className="catbar">
            {['All', ...TEMPLATE_CATEGORIES].map((c) => (
              <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
          {visible.map((g) => (
            <div key={g.category} style={{ marginBottom: 30 }}>
              <div className="label" style={{ marginBottom: 12 }}>{g.category}</div>
              <div className="tmpl-grid">
                {g.items.map((t) => (
                  <div key={t.id} className="tmpl" onClick={() => onPick(t.id)}>
                    <div className="pv">
                      <div style={{ pointerEvents: 'none' }}>
                        <Stage page={samples[t.id]} brand={brand} />
                      </div>
                    </div>
                    <div className="tn">
                      <b>{t.name}</b>
                      <i>{t.hint}</i>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <span className="tiny">{Object.keys(samples).length} layouts · all on brand</span>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
