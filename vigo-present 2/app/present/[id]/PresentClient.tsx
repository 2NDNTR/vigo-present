'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Presenter from '@/components/present/Presenter';
import { getStore } from '@/lib/store';
import type { Presentation, PresentationMode } from '@/lib/model/types';

type Device = 'desktop' | 'mobile';

export default function PresentClient({ id }: { id: string }) {
  const router = useRouter();
  const [p, setP] = useState<Presentation | null>(null);
  const [missing, setMissing] = useState(false);
  const [mode, setMode] = useState<PresentationMode | null>(null);
  const [device, setDevice] = useState<Device>('desktop');

  useEffect(() => {
    getStore()
      .then((s) => s.get(id))
      .then((res) => {
        if (!res) return setMissing(true);
        setP(res);
        setMode(res.share?.mode || 'scroll');
      })
      .catch(() => setMissing(true));
  }, [id]);

  if (missing) return <div style={{ padding: 60 }}>Not found.</div>;
  if (!p || !mode) return <div style={{ padding: 60, color: '#888' }}>Loading…</div>;

  const view: Presentation = { ...p, share: { ...p.share, mode } };

  const controls = (
    <div className="preview-controls">
      <div className="seg dark">
        {(['scroll', 'slide'] as PresentationMode[]).map((m) => (
          <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
            {m === 'scroll' ? 'Scroll' : 'Slides'}
          </button>
        ))}
      </div>
      <div className="seg dark">
        {(['desktop', 'mobile'] as Device[]).map((d) => (
          <button key={d} className={device === d ? 'on' : ''} onClick={() => setDevice(d)}>
            {d === 'desktop' ? 'Desktop' : 'Mobile'}
          </button>
        ))}
      </div>
    </div>
  );

  /* Mobile preview renders the real phone composition inside a device frame,
     so what you check here is exactly what a recipient gets on a phone. */
  if (device === 'mobile') {
    return (
      <div className="device-stage">
        {controls}
        <div className="device-frame">
          <div className="device-screen">
            <Presenter presentation={view} label="Preview" forceNarrow />
          </div>
        </div>
        <button className="btn sm device-exit" onClick={() => router.push('/e/' + id)}>
          Close
        </button>
      </div>
    );
  }

  return (
    <>
      <Presenter presentation={view} label="Preview" forceNarrow={false} onExit={() => router.push('/e/' + id)} />
      {controls}
    </>
  );
}
