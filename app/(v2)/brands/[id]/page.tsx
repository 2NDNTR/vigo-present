'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Composer from '@/components/v2/Composer';
import DeckGrid, { useDecks } from '@/components/v2/DeckGrid';
import MediaGrid, { useAssets } from '@/components/v2/MediaGrid';
import { useApp } from '@/components/v2/Shell';
import { brandLook } from '@/components/v2/brandLook';
import { THEMES, type BrandId } from '@/lib/brand/themes';
import { ASSET_CATEGORIES, type AssetCategory } from '@/lib/model/types';
import { uploadShared } from '@/lib/assets/sharedUpload';

const TABS = ['Overview', 'Presentations', 'Identity', 'Media', 'Guidelines'] as const;
type Tab = (typeof TABS)[number];

interface BrandDetail {
  id: string;
  name: string;
  description: string;
  voice: string;
  disclaimers: string;
  guidelines: string;
}

export default function BrandWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { brands } = useApp();
  const summary = brands?.find((b) => b.id === id);
  const [tab, setTab] = useState<Tab>('Overview');
  const [detail, setDetail] = useState<BrandDetail | null>(null);
  const [rights, setRights] = useState({ canEdit: false, canAdmin: false });
  const [missing, setMissing] = useState(false);
  const { decks, reload } = useDecks();
  const mine = useMemo(() => (decks || []).filter((d) => d.brand === id), [decks, id]);
  const look = brandLook(id);

  useEffect(() => {
    fetch('/api/brands/' + id, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!j.brand) return setMissing(true);
        setDetail(j.brand);
        setRights({ canEdit: !!j.canEdit, canAdmin: !!j.canAdmin });
      })
      .catch(() => setMissing(true));
  }, [id]);

  if (missing) {
    return (
      <div className="empty2">
        <h1 className="t-section">This brand isn&rsquo;t available to you</h1>
        <p>It may not exist, or you may not have been given access. An administrator can add you to it.</p>
      </div>
    );
  }

  return (
    <>
      <header className="ws-hero" style={{ background: look.ground, color: look.ink }}>
        <div>
          <div className="logo" style={{ marginBottom: 18 }}>
            {look.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={look.logo} alt="" />
            ) : (
              <span>{look.wordmark}</span>
            )}
          </div>
          <h1 className="t-title">{detail?.name || summary?.name || ' '}</h1>
          {detail?.description && (
            <p className="t-body" style={{ marginTop: 6, opacity: 0.75, maxWidth: '60ch' }}>
              {detail.description}
            </p>
          )}
        </div>
        {summary && (
          <div style={{ display: 'flex', gap: 28, fontSize: 14 }}>
            <Fact n={summary.decks} label={summary.decks === 1 ? 'presentation' : 'presentations'} />
            <Fact n={summary.live} label="live links" />
            <Fact n={summary.assets} label={summary.assets === 1 ? 'photo' : 'photos'} />
          </div>
        )}
      </header>

      <div className="ws-tabs" role="tablist" aria-label="Brand sections">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <>
          {rights.canEdit && <Composer initialBrand={id} />}
          <section className="v2-section">
            <header>
              <h2 className="t-section">Latest from {detail?.name || 'this brand'}</h2>
            </header>
            {decks === null ? (
              <p className="t-small">Loading…</p>
            ) : mine.length === 0 ? (
              <div className="empty2">
                <h3 className="t-section">No presentations in this brand yet</h3>
                <p>Describe one above. It will be built in this brand&rsquo;s layouts and photography.</p>
              </div>
            ) : (
              <DeckGrid decks={mine.slice(0, 6)} onChanged={reload} showBrand={false} />
            )}
          </section>
        </>
      )}

      {tab === 'Presentations' &&
        (mine.length ? (
          <DeckGrid decks={mine} onChanged={reload} showBrand={false} />
        ) : (
          <div className="empty2">
            <h3 className="t-section">No presentations yet</h3>
            <p>Generate one from the Overview tab, or start from a template.</p>
          </div>
        ))}

      {tab === 'Identity' && <Identity id={id} />}
      {tab === 'Media' && <BrandMedia id={id} canEdit={rights.canEdit} />}
      {tab === 'Guidelines' && detail && <Guidelines detail={detail} canAdmin={rights.canAdmin} onSaved={setDetail} />}
    </>
  );
}

function Fact({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>{n}</div>
      <div style={{ opacity: 0.7, marginTop: 6 }}>{label}</div>
    </div>
  );
}

/* --------------------------------------------------------------- identity */

const ROLE_NAMES: Record<string, string> = {
  display: 'Display',
  headline: 'Headline',
  subhead: 'Subhead',
  body: 'Body',
  quote: 'Quote',
  metricXl: 'Statistic',
};

function Identity({ id }: { id: string }) {
  const theme = (THEMES as Record<string, (typeof THEMES)['vigo']>)[id];
  if (!theme) {
    return (
      <div className="empty2">
        <h3 className="t-section">This brand has no visual system yet</h3>
        <p>Colours, type and logos are configured once, then every presentation in the brand uses them.</p>
      </div>
    );
  }
  const shown = (Object.keys(theme.colors) as (keyof typeof theme.colors)[]).filter(
    (k) => theme.surfaceColors.includes(k) || theme.textColors.includes(k)
  );
  const face = (f: 'display' | 'body' | 'serif') => (f === 'serif' ? theme.fonts.serif || theme.fonts.display : theme.fonts[f]);
  return (
    <>
      <section>
        <h2 className="t-section" style={{ marginBottom: 14 }}>
          Colours
        </h2>
        <div className="palette2">
          {shown.map((k) => (
            <div className="chip2" key={k}>
              <div style={{ background: theme.colors[k] }} />
              <p>
                {theme.colorLabels?.[k] || k}
                <span>{theme.colors[k].toUpperCase()}</span>
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="v2-section">
        <h2 className="t-section" style={{ marginBottom: 14 }}>
          Type
        </h2>
        <div className="typespec">
          {Object.entries(ROLE_NAMES).map(([role, name]) => {
            const t = (theme.type as Record<string, { size: number; weight: number; family: 'display' | 'body' | 'serif'; transform?: string }>)[role];
            if (!t) return null;
            return (
              <div key={role}>
                <span className="t-small">{name}</span>
                <span
                  style={{
                    fontFamily: face(t.family),
                    fontWeight: t.weight,
                    fontSize: Math.max(15, Math.min(44, t.size * 0.42)),
                    textTransform: (t.transform as any) || 'none',
                    lineHeight: 1.15,
                    color: theme.colors.brandPrimary,
                  }}
                >
                  {role === 'metricXl' ? '38%' : role === 'body' ? 'Made the way it has been made since the family began.' : theme.name}
                </span>
              </div>
            );
          })}
        </div>
        <p className="t-small" style={{ marginTop: 12 }}>
          Every presentation in this brand uses these exactly. Nobody picks a font size or a colour by hand.
        </p>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ media */

function BrandMedia({ id, canEdit }: { id: string; canEdit: boolean }) {
  const { assets, reload } = useAssets();
  const { toast } = useApp();
  const [category, setCategory] = useState<AssetCategory | 'All'>('All');
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const mine = (assets || []).filter((a) => a.brand === id && (category === 'All' || a.category === category));
  const present = new Set((assets || []).filter((a) => a.brand === id).map((a) => a.category));

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const into: AssetCategory = category === 'All' ? 'Lifestyle' : category;
    let done = 0;
    for (const f of Array.from(files)) {
      setBusy(`Uploading ${done + 1} of ${files.length}…`);
      try {
        await uploadShared(f, id as BrandId, into);
        done++;
      } catch (e: any) {
        toast('Could not upload ' + f.name + ': ' + (e?.message || 'unknown error'));
      }
    }
    setBusy(null);
    if (done) toast(`Added ${done} to ${into}`);
    reload();
  };

  return (
    <>
      <div className="toolbar">
        <div className="seg2" role="group" aria-label="Category">
          {(['All', ...ASSET_CATEGORIES.filter((c) => present.has(c))] as (AssetCategory | 'All')[]).map((c) => (
            <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
        {canEdit && (
          <>
            <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => upload(e.target.files)} />
            <button className="btn2 primary" onClick={() => input.current?.click()} disabled={!!busy}>
              {busy || (category === 'All' ? 'Upload to Lifestyle' : 'Upload to ' + category)}
            </button>
          </>
        )}
      </div>
      {assets === null ? (
        <p className="t-small">Loading photography…</p>
      ) : mine.length === 0 ? (
        <div className="empty2">
          <h3 className="t-section">No photography here yet</h3>
          <p>Approved photos and video uploaded here are the only pictures the generator will use for this brand.</p>
        </div>
      ) : (
        <MediaGrid assets={mine} />
      )}
    </>
  );
}

/* ------------------------------------------------------------- guidelines */

function Guidelines({
  detail,
  canAdmin,
  onSaved,
}: {
  detail: BrandDetail;
  canAdmin: boolean;
  onSaved: (d: BrandDetail) => void;
}) {
  const { toast } = useApp();
  const [draft, setDraft] = useState(detail);
  const [saving, setSaving] = useState(false);
  const dirty = (['description', 'voice', 'disclaimers', 'guidelines'] as const).some((k) => draft[k] !== detail[k]);

  const save = async () => {
    setSaving(true);
    const r = await fetch('/api/brands/' + detail.id, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        description: draft.description,
        voice: draft.voice,
        disclaimers: draft.disclaimers,
        guidelines: draft.guidelines,
      }),
    });
    setSaving(false);
    if (r.ok) {
      onSaved(draft);
      toast('Guidelines saved');
    } else toast('Could not save. Only a brand admin can change guidelines.');
  };

  const field = (k: 'description' | 'voice' | 'disclaimers' | 'guidelines', label: string, hint: string, ph: string) => (
    <label className="field2">
      <span>{label}</span>
      <small>{hint}</small>
      <textarea
        readOnly={!canAdmin}
        value={draft[k]}
        placeholder={canAdmin ? ph : 'Not written yet.'}
        onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
      />
    </label>
  );

  return (
    <div style={{ maxWidth: 760 }}>
      <p className="t-body" style={{ marginBottom: 26, color: 'var(--muted)' }}>
        The generator reads this before writing a single page for {detail.name}. Plain sentences work best.
      </p>
      {field('description', 'What the brand is', 'One or two sentences a new salesperson would understand.', 'Premium Italian specialty foods, made by the Alessi family in Tampa since 1947.')}
      {field('voice', 'How it speaks', 'Tone, words to use, words to avoid.', 'Warm and confident. Talk about the family and the kitchen, not "solutions". Never say "best-in-class".')}
      {field('guidelines', 'What every deck should do', 'Rules that apply to any presentation in this brand.', 'Lead with product photography. Keep each page to one idea. Close with a clear next step for the buyer.')}
      {field('disclaimers', 'Standard disclaimers', 'Added where pricing or claims appear.', 'Prices are wholesale and subject to change. Images are representative.')}
      {canAdmin && (
        <button className="btn2 primary" onClick={save} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save guidelines'}
        </button>
      )}
    </div>
  );
}
