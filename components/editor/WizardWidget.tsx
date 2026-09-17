'use client';

import { useEffect, useRef, useState } from 'react';
import type { Page } from '@/lib/model/types';
import { getTemplate, TEMPLATES } from '@/lib/templates/registry';
import { pageForModel, applyChanges, type AssistReply } from '@/lib/ingest/assist';

/**
 * THE WIZARD, AS A WIDGET
 * ---------------------------------------------------------------------------
 * It used to open a second panel beside the inspector, which put two columns
 * of controls on screen and made the page itself the smallest thing in the
 * window. Wrong shape: the wizard is not a set of controls, it is a
 * conversation, and a conversation wants one narrow column and a field at the
 * bottom — the shape everyone already knows.
 *
 * So it sits ON TOP of the panel it was competing with, in the same column,
 * and keeps a feed: what you asked, what it did, in order. The feed matters
 * more than it looks. Three requests into a rewrite, "what have I already had
 * it do" is the question, and a widget that only ever shows the last reply
 * cannot answer it.
 *
 * What it still refuses to do is unchanged: it rewrites words, it may suggest
 * an approved layout, and it never touches styling or invents a figure.
 */

const PROMPTS = [
  'Shorten the headline — it is running long.',
  'Write the copy for this page.',
  'Make the cards one voice, same length.',
  'Tighten every line. Cut a third of the words.',
];

interface Turn {
  id: number;
  role: 'you' | 'wizard';
  text: string;
  /** set on a wizard turn that proposed a layout — never applied by itself */
  layout?: string;
  pending?: boolean;
  failed?: boolean;
}

let seq = 0;

export default function WizardWidget({
  page,
  onClose,
  onApply,
  onSwapTemplate,
}: {
  page: Page;
  onClose: () => void;
  onApply: (mutate: (p: Page) => void) => void;
  onSwapTemplate: (id: string) => void;
}) {
  const [feed, setFeed] = useState<Turn[]>([]);
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  /* The newest turn is the one you are waiting for, so the feed follows it. */
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [feed]);

  const run = async (text: string) => {
    const request = text.trim();
    if (!request || busy) return;

    const askId = ++seq;
    const replyId = ++seq;
    setFeed((f) => [
      ...f,
      { id: askId, role: 'you', text: request },
      { id: replyId, role: 'wizard', text: 'Working…', pending: true },
    ]);
    setAsk('');
    setBusy(true);

    const land = (patch: Partial<Turn>) =>
      setFeed((f) => f.map((t) => (t.id === replyId ? { ...t, pending: false, ...patch } : t)));

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
        land({ text: j.error || 'The wizard could not finish.', failed: true });
        return;
      }

      const changes = j.changes || [];
      if (changes.length) {
        /* Applied straight onto the page: a diff view for four rewritten
         * sentences is more to read than the sentences. Undo is the safety
         * net and it is one keystroke. */
        onApply((p) => {
          applyChanges(p, changes);
        });
      }

      const suggests =
        j.suggestLayout && j.suggestLayout !== page.templateId && TEMPLATES.some((t) => t.id === j.suggestLayout)
          ? j.suggestLayout
          : undefined;

      land({
        text: j.note || (changes.length ? 'Done.' : 'Nothing to change there.'),
        layout: suggests,
      });
    } catch {
      land({ text: 'The wizard could not finish.', failed: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="wgt wgt-wizard">
      <header className="wgt-head">
        <span className="wgt-title">Wizard</span>
        <span className="wgt-sub">this page</span>
        <button className="wgt-x" onClick={onClose} aria-label="Close the wizard">
          ✕
        </button>
      </header>

      <div className="wiz-feed" ref={feedRef}>
        {feed.length === 0 ? (
          <div className="wiz-empty">
            <p>
              It rewrites the words on this page and can suggest an approved layout. It never changes styling, and it
              will not invent a figure.
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
            <div key={t.id} className={'wiz-turn ' + t.role + (t.failed ? ' failed' : '')}>
              <div className={'wiz-bubble' + (t.pending ? ' pending' : '')}>{t.text}</div>
              {t.layout ? (
                <div className="wiz-suggest">
                  <span>
                    Suggests <b>{getTemplate(t.layout).name}</b>
                  </span>
                  {/* A suggestion, never an action: swapping a layout moves
                      everything on the page, and that is the person's call. */}
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
          placeholder="Ask for what you want…"
          value={ask}
          disabled={busy}
          onChange={(e) => {
            setAsk(e.target.value);
            /* Grows with the request and stops before it eats the feed. */
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(96, e.target.scrollHeight) + 'px';
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
      {feed.length > 0 ? <div className="wiz-foot">⌘Z puts any change back.</div> : null}
    </section>
  );
}
