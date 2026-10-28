'use client';

import { useState } from 'react';
import { useApp } from '@/components/v2/Shell';

interface PlanItem {
  sourceId: string;
  url: string;
  name: string;
  brand: string;
  category: string;
  fileName: string;
  width?: number;
  height?: number;
  kind: 'image' | 'video';
  id: string;
  exists: boolean;
}

const GROUP: Record<string, string> = {
  Logos: 'Logos',
  'Product Photography': 'Products',
  Lifestyle: 'Lifestyle',
  Video: 'Video',
};

/**
 * Copies the live site's media library into V2, filed as Logos, Products,
 * Lifestyle and Video. Files are copied, not linked, so V2 never depends on
 * V1's storage. Safe to run again: what is already here is skipped.
 */
export default function V1Import() {
  const { toast } = useApp();
  const [plan, setPlan] = useState<PlanItem[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<{ name: string; reason: string }[]>([]);

  const look = async () => {
    setError('');
    setBusy(true);
    const r = await fetch('/api/admin/v1-library', { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(j.error || 'The live library could not be read.');
    setPlan(j.items || []);
  };

  const todo = (plan || []).filter((x) => !x.exists);
  const counts = (list: PlanItem[]) =>
    Object.values(GROUP).map((g) => [g, list.filter((x) => GROUP[x.category] === g).length] as const);

  const run = async () => {
    if (!todo.length) return;
    setBusy(true);
    setDone(0);
    setFailed([]);
    // a few at a time per brand; videos alone, as they are the large ones
    const batches: PlanItem[][] = [];
    for (const brand of ['corporate', 'vigo', 'alessi']) {
      const mine = todo.filter((x) => x.brand === brand);
      mine.filter((x) => x.kind === 'video').forEach((v) => batches.push([v]));
      const imgs = mine.filter((x) => x.kind !== 'video');
      for (let i = 0; i < imgs.length; i += 8) batches.push(imgs.slice(i, i + 8));
    }
    let n = 0;
    const bad: { name: string; reason: string }[] = [];
    for (const b of batches) {
      try {
        const r = await fetch('/api/assets/import-urls', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            brand: b[0].brand,
            category: b[0].category,
            items: b.map((x) => ({ url: x.url, name: x.name, category: x.category, fileName: x.fileName, width: x.width, height: x.height })),
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) b.forEach((x) => bad.push({ name: x.name, reason: j.error || 'failed' }));
        else (j.failed || []).forEach((f: any) => bad.push({ name: b.find((x) => x.url === f.url)?.name || f.url, reason: f.reason }));
      } catch {
        b.forEach((x) => bad.push({ name: x.name, reason: 'connection dropped' }));
      }
      n += b.length;
      setDone(n);
      setFailed([...bad]);
    }
    setBusy(false);
    toast(bad.length ? `Imported with ${bad.length} to retry` : 'The V1 library is in V2');
    look();
  };

  return (
    <section className="v1import">
      <h2 className="t-section" style={{ marginBottom: 6 }}>
        Bring in the live site&rsquo;s library
      </h2>
      <p className="t-small" style={{ marginBottom: 16 }}>
        Copies every logo, photograph and video from vigopresents.com into this workspace, filed as Logos, Products,
        Lifestyle and Video. The live site is only read, never changed. Running it again copies only what is missing.
      </p>

      {error && <p className="v1import-error">{error}</p>}

      {!plan ? (
        <button className="btn2" onClick={look} disabled={busy}>
          {busy ? 'Reading the live library…' : 'Check what is there'}
        </button>
      ) : (
        <>
          <div className="v1import-counts">
            {counts(plan).map(([g, c]) => (
              <div key={g}>
                <b>{c}</b>
                <span>{g}</span>
              </div>
            ))}
          </div>
          <p className="t-small" style={{ margin: '12px 0 16px' }}>
            {todo.length === 0
              ? `All ${plan.length} files are already here.`
              : `${todo.length} of ${plan.length} files to copy${plan.length - todo.length ? `; ${plan.length - todo.length} already here` : ''}.`}
          </p>
          {busy && (
            <div className="v1import-bar" role="progressbar" aria-valuemin={0} aria-valuemax={todo.length} aria-valuenow={done}>
              <i style={{ width: (done / Math.max(1, todo.length)) * 100 + '%' }} />
              <span>
                {done} of {todo.length}
              </span>
            </div>
          )}
          {!busy && todo.length > 0 && (
            <button className="btn2 primary" onClick={run}>
              Copy {todo.length} files
            </button>
          )}
          {failed.length > 0 && (
            <details className="v1import-failed">
              <summary>{failed.length} could not be copied; run again to retry them</summary>
              <ul>
                {failed.slice(0, 50).map((f, i) => (
                  <li key={i}>
                    {f.name}: {f.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
