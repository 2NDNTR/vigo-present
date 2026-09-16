'use client';

import { useState } from 'react';
import type { Page, Presentation } from '@/lib/model/types';
import { getTemplate, TEMPLATES } from '@/lib/templates/registry';
import { pageForModel, applyChanges, type AssistReply } from '@/lib/ingest/assist';
import NotesPanel from './NotesPanel';

/**
 * THE COMPANION DRAWER
 * ---------------------------------------------------------------------------
 * Notes and the wizard are not properties of a page, so they had no business
 * in a panel whose whole job is to describe one. They are companions to the
 * work: you want them beside what you are doing and gone when you are not.
 *
 * So: a drawer off the top right, open or shut, holding the two things that
 * talk ABOUT the deck rather than change its settings.
 */

const PROMPTS = [
  'Shorten the headline — it is running long.',
  'Write the copy for this page.',
  'Make the cards one voice, same length, same rhythm.',
  'Tighten every line. Cut a third of the words.',
];

export default function AssistDrawer({
  open,
  tab,
  onTab,
  onClose,
  presentation,
  page,
  onApply,
  onSwapTemplate,
}: {
  open: boolean;
  tab: 'notes' | 'wizard';
  onTab: (t: 'notes' | 'wizard') => void;
  onClose: () => void;
  presentation: Presentation;
  page: Page;
  /** hands back a mutated copy of the page for the editor to commit */
  onApply: (mutate: (p: Page) => void) => void;
  onSwapTemplate: (id: string) => void;
}) {
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<AssistReply | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (text: string) => {
    const request = text.trim();
    if (!request || busy) return;
    setBusy(true);
    setProblem(null);
    setReply(null);
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
      const j = await r.json();
      if (!r.ok) {
        setProblem(j.error || 'The wizard could not finish.');
        return;
      }
      const changes = j.changes || [];
      if (changes.length) {
        /* Applied straight onto the page, because a diff view for four
         * rewritten sentences is more to read than the sentences. Undo is the
         * safety net, and it is one keystroke. */
        onApply((p) => {
          applyChanges(p, changes);
        });
      }
      setReply(j);
      setAsk('');
    } catch {
      setProblem('The wizard could not finish.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <aside className="drawer">
      <div className="drawer-head">
        <div className="seg drawer-tabs">
          <button className={tab === 'wizard' ? 'on' : ''} onClick={() => onTab('wizard')}>Wizard</button>
          <button className={tab === 'notes' ? 'on' : ''} onClick={() => onTab('notes')}>Notes</button>
        </div>
        <button className="btn ghost sm" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="drawer-body">
        {tab === 'notes' ? (
          <NotesPanel
            presentationId={presentation.id}
            pageId={page.id}
            pageTitles={Object.fromEntries(
              presentation.pages.map((p, i) => [p.id, i + 1 + '. ' + (p.sectionStart || getTemplate(p.templateId).name)])
            )}
          />
        ) : (
          <div className="panel-sec" style={{ paddingTop: 0 }}>
            <p className="tiny" style={{ marginTop: 0 }}>
              Help with this page. It rewrites words and can suggest a layout — it never changes styling, and it will
              not invent a figure.
            </p>

            <textarea
              className="field"
              rows={3}
              style={{ width: '100%', resize: 'vertical', marginTop: 10 }}
              placeholder="Ask for what you want. “Rewrite these six cards for a Publix buyer.”"
              value={ask}
              disabled={busy}
              onChange={(e) => setAsk(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run(ask);
              }}
            />
            <button className="btn primary sm" style={{ marginTop: 8 }} disabled={busy || !ask.trim()} onClick={() => run(ask)}>
              {busy ? 'Working…' : 'Ask'}
            </button>

            <div className="label" style={{ margin: '18px 0 6px' }}>Or start from one of these</div>
            <div className="wiz-prompts">
              {PROMPTS.map((p) => (
                <button key={p} className="wiz-prompt" disabled={busy} onClick={() => run(p)}>
                  {p}
                </button>
              ))}
            </div>

            {problem ? <p className="tiny" style={{ marginTop: 14 }}>{problem}</p> : null}

            {reply ? (
              <div className="wiz-reply">
                <p>{reply.note || 'Done.'}</p>
                <p className="tiny" style={{ margin: '6px 0 0' }}>⌘Z puts it back.</p>
                {reply.suggestLayout && reply.suggestLayout !== page.templateId && TEMPLATES.some((t) => t.id === reply.suggestLayout) ? (
                  <div className="wiz-suggest">
                    <span>
                      Suggests <b>{getTemplate(reply.suggestLayout).name}</b>
                      {reply.layoutReason ? ' — ' + reply.layoutReason : ''}
                    </span>
                    {/* A suggestion, never an action: swapping a layout moves
                        everything on the page, and that is the person's call. */}
                    <button className="btn sm" onClick={() => onSwapTemplate(reply.suggestLayout!)}>
                      Use it
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
