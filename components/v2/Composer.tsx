'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NewPresentation from '@/components/NewPresentation';
import PdfImport from '@/components/PdfImport';
import { getStore } from '@/lib/store';
import { getTemplate } from '@/lib/templates/registry';
import Thumb from '@/components/ui/Thumb';
import type { Presentation } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';
import { useApp } from './Shell';
import { brandLook } from './brandLook';

/**
 * BRAND IN, STORY OUT
 * ---------------------------------------------------------------------------
 * Pick the brand, say what the deck is for. Claude chooses a sequence of the
 * brand's approved layouts and drafts the words; the brand supplies every
 * colour, face and picture. The result is a saved draft that opens in the
 * editor, never a preview that disappears.
 *
 * The progress line shows the real stages of the request, in order, as they
 * happen. It never shows a percentage it does not have.
 */
const STEPS = ['Sending your brief', 'Planning pages and writing', 'Saving the draft', 'Opening it'] as const;

export default function Composer({ initialBrand }: { initialBrand?: string }) {
  const router = useRouter();
  const { user, brands } = useApp();
  const editable = (brands || []).filter((b) => b.role && b.role !== 'viewer');
  const [brand, setBrand] = useState<string | undefined>(initialBrand);
  const [brief, setBrief] = useState('');
  const [step, setStep] = useState(-1);
  const [problem, setProblem] = useState<string | null>(null);
  const [startBlank, setStartBlank] = useState(false);
  const [fromPdf, setFromPdf] = useState(false);
  const [review, setReview] = useState(true);
  const [plan, setPlan] = useState<Presentation | null>(null);

  useEffect(() => {
    if (!brand && editable.length) setBrand(editable[0].id);
  }, [brand, editable]);

  const busy = step >= 0;

  const generate = async () => {
    const text = brief.trim();
    if (!text || !brand || busy) return;
    setProblem(null);
    setStep(0);
    try {
      const req = fetch('/api/compose/deck', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brief: text, brand }),
      });
      setStep(1);
      const r = await req;
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.presentation) {
        setProblem(j.error || 'That brief could not be planned. Add who it is for and what it needs to prove, then try again.');
        setStep(-1);
        return;
      }
      const p: Presentation = j.presentation;
      if (review) {
        // Nothing is saved until the outline is approved.
        setPlan(p);
        setStep(-1);
        return;
      }
      await save(p);
    } catch {
      setProblem('The connection dropped while planning. Your brief is still here, so try again.');
      setStep(-1);
    }
  };

  const save = async (p: Presentation) => {
    setStep(2);
    const s = await getStore();
    await s.save(p);
    setStep(3);
    router.push('/e/' + p.id);
  };

  const create = async (p: Presentation) => {
    const s = await getStore();
    await s.save(p);
    router.push('/e/' + p.id);
  };

  return (
    <section className="composer" aria-label="Create a presentation">
      <h1 className="t-display">What are you presenting?</h1>
      <p className="t-body lead">
        Choose the brand and describe the meeting. You get a full draft in that brand&rsquo;s layouts and photography,
        ready to edit. Figures are left blank for you to fill, never invented.
      </p>

      {initialBrand ? (
        <div style={{ height: 22 }} />
      ) : (
      <div className="brands" role="group" aria-label="Brand">
        {(editable.length ? editable : []).map((b) => (
          <button key={b.id} aria-pressed={brand === b.id} onClick={() => setBrand(b.id)} disabled={busy}>
            <span className="sw" style={{ background: brandLook(b.id).swatch }} />
            {b.name}
          </button>
        ))}
      </div>
      )}

      {plan ? (
        <Outline
          plan={plan}
          onChange={setPlan}
          onBack={() => setPlan(null)}
          onCreate={() => {
            const p = plan;
            setPlan(null);
            save(p).catch(() => {
              setProblem('The deck could not be saved. Try again.');
              setStep(-1);
            });
          }}
        />
      ) : (
      <div className="box">
        <textarea
          aria-label="Describe the presentation"
          value={brief}
          disabled={busy}
          onChange={(e) => setBrief(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generate();
          }}
          placeholder="A 12-page pitch to a regional grocery buyer introducing our premium Italian range: family heritage, how we make it, the products that sell, and what a partnership looks like."
        />
        {busy ? (
          <ol className="progress-steps" aria-live="polite">
            {STEPS.map((s, i) => (
              <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>
                <i aria-hidden />
                {s}
              </li>
            ))}
          </ol>
        ) : (
          <div className="row">
            <label className="t-small review-toggle">
              <input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} />
              Review the outline before it&rsquo;s created
            </label>
            <button className="btn2 primary lg" onClick={generate} disabled={!brief.trim() || !brand}>
              Generate presentation
            </button>
          </div>
        )}
        {problem && (
          <p className="problem" role="alert">
            {problem}
          </p>
        )}
      </div>
      )}

      <div className="others">
        <button onClick={() => setStartBlank(true)} disabled={busy}>
          Start from a template instead
        </button>
        <button onClick={() => setFromPdf(true)} disabled={busy}>
          Rebuild an existing PDF
        </button>
      </div>

      {startBlank && (
        <NewPresentation createdBy={user?.name || 'Vigo team'} onCancel={() => setStartBlank(false)} onCreate={create} />
      )}
      {fromPdf && <PdfImport createdBy={user?.name || 'Vigo team'} onCancel={() => setFromPdf(false)} onCreate={create} />}
    </section>
  );
}

/** The planned deck, page by page, before anything is saved. */
function Outline({
  plan,
  onChange,
  onBack,
  onCreate,
}: {
  plan: Presentation;
  onChange: (p: Presentation) => void;
  onBack: () => void;
  onCreate: () => void;
}) {
  const headline = (pg: Presentation['pages'][number]) => {
    for (const blocks of Object.values(pg.slots || {})) {
      for (const b of blocks || []) {
        if (b.type === 'text' && b.text && ['display', 'headline'].includes(b.style?.role || '')) return b.text;
      }
    }
    for (const blocks of Object.values(pg.slots || {})) for (const b of blocks || []) if (b.text) return b.text;
    return '';
  };
  return (
    <div className="outline" aria-label="Proposed outline">
      <div className="outline-head">
        <div>
          <h2 className="t-section">{plan.title}</h2>
          <p className="t-small">{plan.pages.length} pages. Remove any you don&rsquo;t need, then create the deck.</p>
        </div>
      </div>
      <ol className="outline-list">
        {plan.pages.map((pg, i) => (
          <li key={pg.id}>
            <span className="n">{i + 1}</span>
            <div className="mini">
              <Thumb page={pg} brand={plan.brand} />
            </div>
            <div className="txt">
              <b>{headline(pg) || getTemplate(pg.templateId)?.name}</b>
              <span>{getTemplate(pg.templateId)?.name}</span>
            </div>
            <button
              className="rm"
              aria-label={'Remove page ' + (i + 1)}
              disabled={plan.pages.length <= 1}
              onClick={() => onChange({ ...plan, pages: plan.pages.filter((x) => x.id !== pg.id) })}
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
      <div className="outline-foot">
        <button className="btn2 quiet on-dark" onClick={onBack}>
          Change the brief
        </button>
        <button className="btn2 primary lg" onClick={onCreate}>
          Create {plan.pages.length}-page presentation
        </button>
      </div>
    </div>
  );
}

export type { BrandId };
