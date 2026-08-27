'use client';

import { useState } from 'react';
import { BRAND_ORDER, THEMES } from '@/lib/brand/themes';
import type { BrandId } from '@/lib/brand/themes';
import { STARTERS, buildPresentation } from '@/lib/templates/starters';
import type { Presentation } from '@/lib/model/types';

export default function NewPresentation({
  createdBy,
  onCancel,
  onCreate,
}: {
  createdBy: string;
  onCancel: () => void;
  onCreate: (p: Presentation) => void;
}) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState<BrandId>('alessi');
  const [starter, setStarter] = useState('retail');

  const next = () => setStep((s) => Math.min(2, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

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
    <div className="scrim-modal" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-head">
          <div className="steps" style={{ marginBottom: 14 }}>
            Step {step + 1} of 3
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
                  <span
                    className="choice-swatch"
                    style={{
                      background: `linear-gradient(135deg, ${t.colors.brandPrimary} 0 50%, ${t.colors.cream} 50% 100%)`,
                    }}
                  />
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
                <span
                  className="choice-swatch"
                  style={{ display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600, color: '#8c9096' }}
                >
                  {s.steps.length}
                </span>
                <span>
                  <span className="choice-name">{s.name}</span>
                  <span className="choice-desc">{s.description}</span>
                </span>
              </button>
            ))}
        </div>

        <div className="modal-foot">
          <button className="btn ghost" onClick={step === 0 ? onCancel : back}>
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < 2 ? (
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
  );
}
