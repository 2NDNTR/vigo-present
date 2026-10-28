'use client';

import { useEffect, useRef, useState } from 'react';
import type { Block, Page } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';
import { getTemplate, TEMPLATES } from '@/lib/templates/registry';
import { pageForModel, applyChanges, type AssistChange, type AssistReply } from '@/lib/ingest/assist';
import Stage from '@/components/render/Stage';

/**
 * REFINE WITH AI — one page at a time
 * ---------------------------------------------------------------------------
 * A conversation about the page that is open. Each request comes back as a
 * PROPOSAL: the page as it would look, drawn by the real renderer, with every
 * changed line shown before and after. Nothing on the page moves until the
 * person accepts. Accepting first saves the deck as it stands as a named
 * version, then applies the change, so any accepted edit can be restored from
 * history as well as undone.
 *
 * What it will not do is unchanged: it rewrites words and may suggest an
 * approved layout. It never touches styling and never invents a figure.
 */

const PROMPTS = [
  'Make the headline more compelling.',
  'Cut the copy by a third.',
  'Make this page more sales-focused.',
  'Make the cards one voice, same length.',
];

interface Diff {
  where: string;
  before: string;
  after: string;
}

interface Turn {
  id: number;
  role: 'you' | 'ai';
  text: string;
  pending?: boolean;
  failed?: boolean;
  /** a proposed rewrite, waiting for a decision */
  changes?: AssistChange[];
  preview?: Page;
  diffs?: Diff[];
  decision?: 'accepted' | 'discarded';
  /** an approved layout it suggests — never applied by itself */
  layout?: string;
  request?: string;
}

let seq = 0;

function describeDiffs(page: Page, changes: AssistChange[]): Diff[] {
  const byId = new Map<string, Block>();
  Object.values(page.slots).forEach((blocks) => blocks.forEach((b) => byId.set(b.id, b)));
  const out: Diff[] = [];
  for (const c of changes) {
    const b = byId.get(String(c.blockId));
    if (!b) continue;
    const kinds: [keyof AssistChange, 'text' | 'support' | 'label' | 'value', string][] = [
      ['text', 'text', b.type === 'text' ? b.style?.role || 'text' : b.type],
      ['support', 'support', 'supporting line'],
      ['label', 'label', 'label'],
      ['value', 'value', 'figure'],
    ];
    for (const [ck, bk, where] of kinds) {
      const after = typeof c[ck] === 'string' ? String(c[ck]).trim() : '';
      if (!after) continue;
      if (bk === 'value' && !b.value) continue; // never fills in a figure nobody gave it
      const before = String(b[bk] || '');
      if (before !== after) out.push({ where, before, after });
    }
  }
  return out;
}

export default function WizardWidget({
  page,
  brand,
  presentationId,
  onClose,
  onApply,
  onSwapTemplate,
}: {
  page: Page;
  brand: BrandId;
  presentationId: string;
  onClose: () => void;
  onApply: (mutate: (p: Page) => void) => void;
  onSwapTemplate: (id: string) => void;
}) {
  const [feed, setFeed] = useState<Turn[]>([]);
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [feed]);

  /* Proposals belong to the page they were made for. Moving to another page
     closes any that were still open, so nothing is applied to the wrong one. */
  useEffect(() => {
    setFeed((f) => f.map((t) => (t.changes && !t.decision ? { ...t, decision: 'discarded' } : t)));
  }, [page.id]);

  const patch = (id: number, p: Partial<Turn>) => setFeed((f) => f.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const run = async (text: string) => {
    const request = text.trim();
    if (!request || busy) return;
    const askId = ++seq;
    const replyId = ++seq;
    setFeed((f) => [
      // an unanswered proposal is set aside when a new request starts
      ...f.map((t) => (t.changes && !t.decision ? { ...t, decision: 'discarded' as const } : t)),
      { id: askId, role: 'you', text: request },
      { id: replyId, role: 'ai', text: 'Reading the page…', pending: true },
    ]);
    setAsk('');
    setBusy(true);
    try {
      const template = getTemplate(page.templateId);
      const r = await fetch('/api/assist/page', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          request,
          page: pageForModel(page, template),
          layouts: TEMPLATES.map((t) => `${t.id} — ${t.name}. ${t.hint}`).join('\n'),
        }),
      });
      const j: AssistReply & { error?: string } = await r.json();
      if (!r.ok) {
        patch(replyId, { pending: false, failed: true, text: j.error || 'That could not be finished. Try asking differently.' });
        return;
      }
      const changes = j.changes || [];
      const diffs = describeDiffs(page, changes);
      const suggests =
        j.suggestLayout && j.suggestLayout !== page.templateId && TEMPLATES.some((t) => t.id === j.suggestLayout)
          ? j.suggestLayout
          : undefined;
      let preview: Page | undefined;
      if (diffs.length) {
        preview = JSON.parse(JSON.stringify(page)) as Page;
        applyChanges(preview, changes);
      }
      patch(replyId, {
        pending: false,
        text: j.note || (diffs.length ? 'Here is a proposed rewrite.' : 'Nothing needed changing for that.'),
        changes: diffs.length ? changes : undefined,
        diffs,
        preview,
        layout: suggests,
        request,
      });
    } catch {
      patch(replyId, { pending: false, failed: true, text: 'The connection dropped. Your page is unchanged.' });
    } finally {
      setBusy(false);
    }
  };

  const accept = async (t: Turn) => {
    if (!t.changes) return;
    // the deck as it stands is kept as a version first, so this can be restored later
    try {
      await fetch(`/api/presentations/${presentationId}/versions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label: 'Before AI: ' + (t.request || 'refine').slice(0, 80), reason: 'ai-accept' }),
      });
    } catch {
      /* no backend (local copy): undo is still the safety net */
    }
    const changes = t.changes;
    onApply((p) => {
      applyChanges(p, changes);
    });
    patch(t.id, { decision: 'accepted' });
  };

  return (
    <section className="wgt wgt-wizard" aria-label="Refine with AI">
      <header className="wgt-head">
        <span className="wgt-title">Refine with AI</span>
        <span className="wgt-sub">this page</span>
        <button className="wgt-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div className="wiz-feed" ref={feedRef}>
        {feed.length === 0 ? (
          <div className="wiz-empty">
            <p>
              Ask for a change to this page. You&rsquo;ll see the result before anything is applied. It rewrites words and
              can suggest an approved layout; it never changes styling or invents a figure.
            </p>
            <div className="wiz-chips">
              {PROMPTS.map((p) => (
                <button key={p} className="wiz-chip" onClick={() => run(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          feed.map((t) => (
            <div key={t.id} className={'wiz-turn ' + (t.role === 'ai' ? 'wizard' : 'you') + (t.failed ? ' failed' : '')}>
              <div className={'wiz-bubble' + (t.pending ? ' pending' : '')}>{t.text}</div>

              {t.preview && t.diffs && t.diffs.length > 0 && (
                <div className={'proposal' + (t.decision ? ' decided' : '')}>
                  <div className="proposal-stage" aria-label="Proposed page">
                    <Stage page={t.preview} brand={brand} />
                  </div>
                  <ul className="proposal-diffs">
                    {t.diffs.map((d, i) => (
                      <li key={i}>
                        <span className="where">{d.where}</span>
                        <del>{d.before || '(empty)'}</del>
                        <ins>{d.after}</ins>
                      </li>
                    ))}
                  </ul>
                  {t.decision ? (
                    <p className="proposal-state">
                      {t.decision === 'accepted'
                        ? 'Applied. The previous version is saved in history, and ⌘Z undoes it.'
                        : 'Not applied.'}
                    </p>
                  ) : (
                    <div className="proposal-actions">
                      <button className="btn sm ghost" onClick={() => patch(t.id, { decision: 'discarded' })}>
                        Discard
                      </button>
                      <button className="btn sm primary" onClick={() => accept(t)}>
                        Apply to page
                      </button>
                    </div>
                  )}
                </div>
              )}

              {t.layout ? (
                <div className="wiz-suggest">
                  <span>
                    Suggests <b>{getTemplate(t.layout).name}</b>
                  </span>
                  {/* swapping a layout moves everything on the page: always the person's call */}
                  <button className="btn sm" onClick={() => onSwapTemplate(t.layout!)}>
                    Use it
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
      <div className="wiz-compose">
        <textarea
          rows={1}
          value={ask}
          placeholder="Ask for a change to this page"
          disabled={busy}
          onChange={(e) => {
            setAsk(e.target.value);
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              run(ask);
            }
          }}
        />
        <button className="wiz-send" disabled={busy || !ask.trim()} onClick={() => run(ask)} aria-label="Ask">
          ↑
        </button>
      </div>
    </section>
  );
}
