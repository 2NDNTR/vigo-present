'use client';

import { useEffect, useState } from 'react';

interface Version {
  n: number;
  label: string;
  reason: string;
  created_at: number;
  author: string | null;
}

const REASON: Record<string, string> = {
  checkpoint: 'Saved version',
  generate: 'Generated',
  'ai-accept': 'Before an AI change',
  publish: 'Published',
  restore: 'Restore',
};

function when(ts: number) {
  const d = new Date(Number(ts));
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ', ' +
        d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * HISTORY — the deck's saved versions, newest first.
 * Autosave keeps the deck current; these are the points worth going back to.
 * Restoring never removes anything: the deck as it is now is saved first, then
 * the old version comes forward, so a restore can itself be restored.
 */
export default function HistoryWidget({
  presentationId,
  onClose,
  beforeRestore,
}: {
  presentationId: string;
  onClose: () => void;
  /** lets the editor flush its pending autosave before the server swaps the deck */
  beforeRestore: () => Promise<void>;
}) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    fetch(`/api/presentations/${presentationId}/versions`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setVersions(j.versions || []))
      .catch(() => setVersions([]));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationId]);

  const save = async () => {
    setBusy(true);
    setError('');
    await beforeRestore();
    const r = await fetch(`/api/presentations/${presentationId}/versions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: label.trim() || 'Saved version', reason: 'checkpoint' }),
    });
    setBusy(false);
    if (!r.ok) return setError('That version could not be saved.');
    setLabel('');
    load();
  };

  const restore = async (v: Version) => {
    if (!confirm(`Restore “${v.label}”? The deck as it is now is saved first, so you can come back to it.`)) return;
    setBusy(true);
    setError('');
    await beforeRestore();
    const r = await fetch(`/api/presentations/${presentationId}/versions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ restore: v.n }),
    });
    if (!r.ok) {
      setBusy(false);
      return setError('That version could not be restored.');
    }
    // the server now holds the restored deck under a new version number; reload to pick it up cleanly
    window.location.reload();
  };

  return (
    <section className="wgt" aria-label="Version history">
      <header className="wgt-head">
        <span className="wgt-title">History</span>
        <span className="wgt-sub">this deck</span>
        <button className="wgt-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div className="hist-save">
        <input
          className="field"
          placeholder="Name this version, e.g. Sent to Publix"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          disabled={busy}
        />
        <button className="btn sm" onClick={save} disabled={busy}>
          Save version
        </button>
      </div>
      {error && <p className="hist-error">{error}</p>}
      <ol className="hist-list">
        {versions === null ? (
          <li className="hist-empty">Loading…</li>
        ) : versions.length === 0 ? (
          <li className="hist-empty">No saved versions yet. They appear when you save one, publish, or apply an AI change.</li>
        ) : (
          versions.map((v, i) => (
            <li key={v.n}>
              <div>
                <b>{v.label || REASON[v.reason] || 'Version ' + v.n}</b>
                <span>
                  {when(v.created_at)}
                  {v.author ? ', ' + v.author : ''}
                </span>
              </div>
              {i === 0 && v.reason !== 'ai-accept' ? (
                <span className="hist-tag">Latest</span>
              ) : (
                <button className="btn sm ghost" onClick={() => restore(v)} disabled={busy}>
                  Restore
                </button>
              )}
            </li>
          ))
        )}
      </ol>
    </section>
  );
}
