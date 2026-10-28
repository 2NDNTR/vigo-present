'use client';

import { useState } from 'react';
import Portal from '@/components/ui/Portal';
import { brandLook as look } from '@/components/v2/brandLook';
import { BRAND_ORDER, THEMES } from '@/lib/brand/themes';
import type { BrandId } from '@/lib/brand/themes';
import { STARTERS, buildPresentation } from '@/lib/templates/starters';
import type { Presentation } from '@/lib/model/types';

export default function NewPresentation({
  createdBy,
  onCancel,
  onCreate,
  brand: fixedBrand,
}: {
  createdBy: string;
  /** opened from inside a brand: that brand is the answer, so its step is skipped */
  brand?: string;
  onCancel: () => void;
  onCreate: (p: Presentation) => void;
}) {
  const [at, setAt] = useState(0);
  const [title, setTitle] = useState('');
  const known = fixedBrand && (BRAND_ORDER as readonly string[]).includes(fixedBrand) ? (fixedBrand as BrandId) : undefined;
  const [brand, setBrand] = useState<BrandId>(known || 'alessi');
  // the steps this person actually sees, in order
  const flow: (0 | 1 | 2)[] = known ? [0, 2] : [0, 1, 2];
  const [starter, setStarter] = useState('retail');

  const step = flow[at];
  const last = at === flow.length - 1;
  const next = () => setAt((s) => Math.min(flow.length - 1, s + 1));
  const back = () => setAt((s) => Math.max(0, s - 1));

  const finish = () => {
    onCreate(
      buildPresentation({
        title: title.trim() || 'Untitled Presentation',
        brand,
        starterId: starter,
        createdBy,
      })
    );
  };

  return (
    <Portal>
    <div className="scrim-modal" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-head">
          <div className="stepbar" aria-label={`Step ${at + 1} of ${flow.length}`}>
            {flow.map((_, i) => (
              <i key={i} className={i <= at ? 'done' : ''} />
            ))}
            <span>
              Step {at + 1} of {flow.length}
              {known ? ', ' + THEMES[known].name : ''}
            </span>
          </div>
          {step === 0 && (
            <>
              <h2>Name your presentation</h2>
              <p className="sub">You can change this at any time.</p>
            </>
          )}
          {step === 1 && (
            <>
              <h2>Choose a brand</h2>
              <p className="sub">
                Typography, colour, logo and spacing load automatically. You never rebuild a brand.
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <h2>Start from a template</h2>
              <p className="sub">Every page is already designed. Replace the content and you&rsquo;re done.</p>
            </>
          )}
        </div>

        <div className="modal-body">
          {step === 0 && (
            <input
              className="field"
              autoFocus
              value={title}
              placeholder="2027 Retail Sales Presentation"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && next()}
            />
          )}

          {step === 1 &&
            BRAND_ORDER.map((b) => {
              const t = THEMES[b];
              return (
                <button key={b} className={'choice' + (brand === b ? ' on' : '')} onClick={() => setBrand(b)}>
                  <span className="choice-brand" style={{ background: look(b).ground, color: look(b).ink }}>
                    {look(b).logo ? <img src={look(b).logo} alt="" /> : <b>{look(b).wordmark}</b>}
                    <i style={{ background: look(b).swatch }} />
                  </span>
                  <span>
                    <span className="choice-name" style={{ fontFamily: t.fonts.display }}>
                      {t.name}
                    </span>
                    <span className="choice-desc">{t.description}</span>
                  </span>
                </button>
              );
            })}

          {step === 2 &&
            STARTERS.map((s) => (
              <button key={s.id} className={'choice' + (starter === s.id ? ' on' : '')} onClick={() => setStarter(s.id)}>
                <span className="choice-count">
                  <b>{s.steps.length}</b>
                  {s.steps.length === 1 ? 'page' : 'pages'}
                </span>
                <span>
                  <span className="choice-name">{s.name}</span>
                  <span className="choice-desc">{s.description}</span>
                </span>
              </button>
            ))}
        </div>

        <div className="modal-foot">
          <button className="btn ghost" onClick={at === 0 ? onCancel : back}>
            {at === 0 ? 'Cancel' : 'Back'}
          </button>
          {!last ? (
            <button className="btn primary" onClick={next}>
              Continue
            </button>
          ) : (
            <button className="btn primary" onClick={finish}>
              Create presentation
            </button>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
}
