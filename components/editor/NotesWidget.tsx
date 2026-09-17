'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * NOTES, AS POST-ITS
 * ---------------------------------------------------------------------------
 * Feedback beside the deck instead of in an inbox. It is drawn as post-its on
 * purpose: a note is a scrap stuck to a slide, not a row in a system, and the
 * yellow is doing a job — it is the one part of this editor allowed to look
 * unfinished, because it IS the unfinished part. Everything else on screen is
 * the deck; this is the arguing about it.
 *
 * Two things make it worth having rather than a shared document: a note is
 * pinned to the page it is about, so round three reads next to the slide
 * round two was arguing over; and @ mentions resolve to people, so a note
 * reaches someone without a separate email that then holds the real
 * decision.
 *
 * ✓ settles a note; ✕ removes it, and only for the person who wrote it.
 * Deleting someone else's feedback is not a tidy-up, it is an edit to the
 * record of what was asked for — so the rest of us get ✓ and nothing more.
 */

interface Note {
  id: string;
  pageId?: string | null;
  body: string;
  mentions: string[];
  resolved: boolean;
  createdAt: number;
  author: { id: string; name: string };
  mine: boolean;
}

interface Person { id: string; name: string; email: string }

export default function NotesWidget({
  presentationId,
  pageId,
  pageTitles,
  onClose,
  onGoToPage,
}: {
  presentationId: string;
  pageId?: string;
  pageTitles: Record<string, string>;
  onClose: () => void;
  onGoToPage: (pageId: string) => void;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [team, setTeam] = useState<Person[]>([]);
  const [text, setText] = useState('');
  const [scope, setScope] = useState<'page' | 'deck'>('page');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [mentionAt, setMentionAt] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const load = async () => {
    try {
      const r = await fetch('/api/notes?presentationId=' + encodeURIComponent(presentationId));
      if (r.ok) setNotes((await r.json()).notes || []);
    } catch {
      /* not worth an error state for a failed poll */
    }
  };

  useEffect(() => {
    load();
    const t = window.setInterval(load, 20_000);
    fetch('/api/team')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setTeam(j.users || j.team || []))
      .catch(() => {});
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationId]);

  /* The toggle is the filter AND the target, so what you are reading is what
   * your next note joins. Deck-wide notes show in both, because a note about
   * the whole deck is about this page too. */
  const shown = useMemo(
    () => (scope === 'page' ? notes.filter((n) => !n.pageId || n.pageId === pageId) : notes),
    [notes, scope, pageId]
  );

  const matches = useMemo(() => {
    if (mentionAt === null) return [];
    const term = mentionAt.toLowerCase();
    return team.filter((p) => (p.name || p.email).toLowerCase().includes(term)).slice(0, 5);
  }, [mentionAt, team]);

  const onType = (v: string) => {
    setText(v);
    const upto = v.slice(0, box.current?.selectionStart ?? v.length);
    const m = /@([\w.\- ]{0,20})$/.exec(upto);
    setMentionAt(m ? m[1] : null);
  };

  const insertMention = (p: Person) => {
    const el = box.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([\w.\- ]{0,20})$/, '@' + (p.name || p.email) + ' ');
    setText(before + text.slice(caret));
    setMentionAt(null);
    el?.focus();
  };

  const mentionedIds = (body: string) =>
    team.filter((p) => body.includes('@' + (p.name || p.email))).map((p) => p.id);

  const post = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          presentationId,
          pageId: scope === 'page' ? pageId : null,
          body,
          mentions: mentionedIds(body),
        }),
      });
      if (!r.ok) {
        setProblem((await r.json()).error || 'That note did not save.');
        return;
      }
      setText('');
      if (box.current) box.current.style.height = 'auto';
      await load();
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (n: Note) => {
    /* Moved on screen before the server answers — a checkmark that waits on a
     * round trip feels broken, and the next poll corrects it if it failed. */
    setNotes((all) => all.map((x) => (x.id === n.id ? { ...x, resolved: !x.resolved } : x)));
    await fetch('/api/notes', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: n.id, resolved: !n.resolved }),
    }).catch(() => {});
    load();
  };

  const remove = async (n: Note) => {
    setNotes((all) => all.filter((x) => x.id !== n.id));
    await fetch('/api/notes?id=' + encodeURIComponent(n.id), { method: 'DELETE' }).catch(() => {});
    load();
  };

  return (
    <section className="wgt wgt-notes">
      <header className="wgt-head">
        <span className="wgt-title">Notes</span>
        <button className="wgt-x" onClick={onClose} aria-label="Close notes">
          ✕
        </button>
      </header>

      <div className="notes-scope">
        <div className="seg">
          <button className={scope === 'page' ? 'on' : ''} onClick={() => setScope('page')}>This page</button>
          <button className={scope === 'deck' ? 'on' : ''} onClick={() => setScope('deck')}>All pages</button>
        </div>
      </div>

      <div className="postits">
        {shown.length === 0 ? (
          <p className="notes-none">
            {scope === 'page' ? 'Nothing stuck to this page yet.' : 'No notes on this deck yet.'}
          </p>
        ) : (
          shown.map((n) => (
            <article key={n.id} className={'postit' + (n.resolved ? ' done' : '')}>
              <div className="postit-top">
                <b>{n.author.name}</b>
                <span className="postit-when">{when(n.createdAt)}</span>
              </div>
              <div className="postit-body">{highlight(n.body)}</div>
              <div className="postit-foot">
                {n.pageId ? (
                  <button className="postit-where" onClick={() => onGoToPage(n.pageId!)} title="Go to that page">
                    {pageTitles[n.pageId] || 'a page'}
                  </button>
                ) : (
                  <span className="postit-where flat">whole deck</span>
                )}
                <span className="postit-acts">
                  <button
                    className={'pi-act ok' + (n.resolved ? ' on' : '')}
                    onClick={() => resolve(n)}
                    title={n.resolved ? 'Reopen this note' : 'Mark it done'}
                    aria-label={n.resolved ? 'Reopen' : 'Mark done'}
                  >
                    ✓
                  </button>
                  {/* Only the author's own: see the note at the top of this file. */}
                  {n.mine ? (
                    <button className="pi-act no" onClick={() => remove(n)} title="Delete this note" aria-label="Delete">
                      ✕
                    </button>
                  ) : null}
                </span>
              </div>
            </article>
          ))
        )}
      </div>

      {problem ? <p className="notes-none">{problem}</p> : null}

      <div className="notes-compose">
        {matches.length ? (
          <div className="mention-menu">
            {matches.map((p) => (
              <button key={p.id} onClick={() => insertMention(p)}>
                {p.name || p.email}
              </button>
            ))}
          </div>
        ) : null}
        <textarea
          ref={box}
          rows={1}
          placeholder={scope === 'page' ? 'Note on this page. @ to tag someone.' : 'Note on the deck. @ to tag someone.'}
          value={text}
          onChange={(e) => {
            onType(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(90, e.target.scrollHeight) + 'px';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !mentionAt) {
              e.preventDefault();
              post();
            }
          }}
        />
        <button className="notes-post" disabled={busy || !text.trim()} onClick={post}>
          Stick it
        </button>
      </div>
    </section>
  );
}

/** A tagged name should be findable by eye — it is the reason the note reached you. */
function highlight(body: string) {
  return body.split(/(@[\w.\-]+(?: [A-Z][\w.\-]*)?)/g).map((part, i) =>
    part.startsWith('@') ? <span key={i} className="pi-at">{part}</span> : <span key={i}>{part}</span>
  );
}

function when(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return new Date(ts).toLocaleDateString();
}
