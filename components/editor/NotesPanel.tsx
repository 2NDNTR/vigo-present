'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * NOTES
 * ---------------------------------------------------------------------------
 * Feedback beside the deck instead of in an inbox. Three things make it worth
 * having rather than a shared document:
 *
 *   - a note is pinned to the page it is about, so round three reads next to
 *     the slide round two was arguing over;
 *   - @ mentions resolve to people, so a note reaches someone without a
 *     separate email that then holds the real decision;
 *   - the summary reads every round at once and says what is still open,
 *     which is the thing nobody can work out by scrolling.
 *
 * The summary is a reading of the notes, not an authority over them. It never
 * marks anything resolved and never edits a note.
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

export default function NotesPanel({
  presentationId,
  pageId,
  pageTitles,
}: {
  presentationId: string;
  pageId?: string;
  pageTitles: Record<string, string>;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [team, setTeam] = useState<Person[]>([]);
  const [text, setText] = useState('');
  const [scope, setScope] = useState<'page' | 'deck'>('page');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [mentionAt, setMentionAt] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const load = async () => {
    try {
      const r = await fetch('/api/notes?presentationId=' + encodeURIComponent(presentationId));
      if (r.ok) setNotes((await r.json()).notes || []);
    } catch {
      /* the panel is not worth an error state for a failed poll */
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

  /* The @ menu opens on the word being typed and closes as soon as it stops
   * looking like a mention — no modal, no commitment. */
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
      await load();
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (n: Note) => {
    await fetch('/api/notes', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: n.id, resolved: !n.resolved }),
    });
    load();
  };

  const summarise = async () => {
    setBusy(true);
    setProblem(null);
    setSummary(null);
    try {
      const r = await fetch('/api/notes/summary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ presentationId, pageTitles }),
      });
      const j = await r.json();
      if (!r.ok) setProblem(j.error || 'The summary could not be built.');
      else setSummary(j.summary);
    } catch {
      setProblem('The summary could not be built.');
    } finally {
      setBusy(false);
    }
  };

  const open = notes.filter((n) => !n.resolved).length;

  return (
    <div className="panel-sec notes-panel">
      <h4 className="panel-h">
        Notes {open ? <span className="notes-count">{open} open</span> : null}
      </h4>

      <div className="seg" style={{ marginBottom: 8 }}>
        <button className={scope === 'page' ? 'on' : ''} onClick={() => setScope('page')}>This page</button>
        <button className={scope === 'deck' ? 'on' : ''} onClick={() => setScope('deck')}>Whole deck</button>
      </div>

      <textarea
        ref={box}
        className="field"
        rows={3}
        style={{ width: '100%', resize: 'vertical' }}
        placeholder="Leave a note. Type @ to tag someone."
        value={text}
        onChange={(e) => onType(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') post();
        }}
      />

      {matches.length ? (
        <div className="mention-menu">
          {matches.map((p) => (
            <button key={p.id} onClick={() => insertMention(p)}>
              {p.name || p.email}
            </button>
          ))}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button className="btn sm primary" disabled={busy || !text.trim()} onClick={post}>
          {busy ? 'Working…' : 'Add note'}
        </button>
        <button className="btn sm" disabled={busy || !notes.length} onClick={summarise} title="Read every round and say what is still open">
          Summarise feedback
        </button>
      </div>

      {problem ? <p className="tiny" style={{ marginTop: 8 }}>{problem}</p> : null}

      {summary ? (
        <div className="notes-summary">
          <div className="tiny" style={{ opacity: 0.6, marginBottom: 6 }}>
            Across {notes.length} note{notes.length === 1 ? '' : 's'} — a reading, not a decision.
          </div>
          {summary.split('\n').filter(Boolean).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          <button className="btn sm ghost" style={{ marginTop: 6 }} onClick={() => setSummary(null)}>Hide</button>
        </div>
      ) : null}

      <div className="notes-list">
        {notes.length === 0 ? (
          <p className="tiny" style={{ opacity: 0.6 }}>No notes yet.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className={'note' + (n.resolved ? ' done' : '')}>
              <div className="note-head">
                <b>{n.author.name}</b>
                <span className="tiny">
                  {n.pageId ? pageTitles[n.pageId] || 'a page' : 'whole deck'} · {when(n.createdAt)}
                </span>
              </div>
              <div className="note-body">{n.body}</div>
              <button className="btn sm ghost" onClick={() => resolve(n)}>
                {n.resolved ? 'Reopen' : 'Mark done'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
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
