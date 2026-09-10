'use client';

import { useEffect, useRef, useState } from 'react';
import { useEntrance } from '@/components/present/Motion';
import Stage from '@/components/render/Stage';
import type { Presentation } from '@/lib/model/types';
import { getTheme } from '@/lib/brand/themes';

/**
 * PRESENTATION MODE
 * Two experiences from the same structured data:
 *   SCROLL — a vertically scrolling web story
 *   SLIDES — traditional next / previous navigation
 * On phones both stack intelligently instead of shrinking a desktop slide.
 */
export default function Presenter({
  presentation,
  onExit,
  label,
  forceNarrow,
}: {
  presentation: Presentation;
  onExit?: () => void;
  label?: string;
  /** preview override — render the phone composition regardless of window size */
  forceNarrow?: boolean;
}) {
  const [autoNarrow, setAutoNarrow] = useState(false);
  const narrow = forceNarrow === undefined ? autoNarrow : forceNarrow;
  const [index, setIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const mode = presentation.share?.mode || 'scroll';
  const pages = presentation.pages;
  const theme = getTheme(presentation.brand);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const on = () => setAutoNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  /* ---------------------------------------------------------- keyboard */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onExit) onExit();
      if (mode === 'slide' && !narrow) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
          e.preventDefault();
          setIndex((i) => Math.min(pages.length - 1, i + 1));
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          setIndex((i) => Math.max(0, i - 1));
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [mode, narrow, pages.length, onExit]);

  /* ------------------------------------------- track position in scroll */
  useEffect(() => {
    if (mode !== 'scroll' || narrow) return;
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollTop / el.clientHeight);
      setIndex(Math.max(0, Math.min(pages.length - 1, i)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [mode, narrow, pages.length]);

  /* ------------------------------------------------------ entrance motion
   * Every composition gets the same treatment — the phone stack, the slide
   * deck and the scroll story all arrive the same way, so the deck feels like
   * one thing at three sizes. In slides the key changes with the index, which
   * is what replays the arrival on each new slide. */
  const root = useRef<HTMLDivElement>(null);
  useEntrance(root, scroller, mode === 'slide' && !narrow ? index : pages.length + ':' + narrow + mode);

  const goto = (i: number) => {
    setIndex(i);
    if (mode === 'scroll' && !narrow && scroller.current) {
      scroller.current.scrollTo({ top: i * scroller.current.clientHeight, behavior: 'smooth' });
    }
  };

  const chrome = (
    <>
      <div className="pbar">
        <i style={{ width: ((index + 1) / pages.length) * 100 + '%' }} />
      </div>
      {!narrow && (
        <div className="pnav">
          {pages.map((p, i) => (
            <i key={p.id} className={i === index ? 'on' : ''} onClick={() => goto(i)} />
          ))}
        </div>
      )}
      <div className="pchrome">
        <span>
          {label ? label + ' · ' : ''}
          {presentation.title}
        </span>
        <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span className="mono-num">
            {index + 1} / {pages.length}
          </span>
          {onExit && (
            <button className="btn sm" style={{ background: 'rgba(255,255,255,0.16)', border: 0, color: '#fff' }} onClick={onExit}>
              Close
            </button>
          )}
        </span>
      </div>
    </>
  );

  /* ------------------------------------------------------------ mobile */
  if (narrow) {
    return (
      <div className="present-root" ref={root}>
        {pages.map((p) => (
          <section key={p.id}>
            <Stage page={p} brand={presentation.brand} retailer={presentation.retailer} mode="stacked" />
          </section>
        ))}
        <div style={{ padding: '26px 20px 40px', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
          {presentation.title}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- slides */
  if (mode === 'slide') {
    return (
      <div className="present-root" ref={root} style={{ height: '100vh', overflow: 'hidden' }}>
        <div className="slidewrap">
          <div style={{ width: 'min(100vw, calc(100vh * 16 / 9))' }}>
            <Stage page={pages[index]} brand={presentation.brand} retailer={presentation.retailer} mode="fixed" />
          </div>
        </div>
        <button className="parrow left" onClick={() => goto(Math.max(0, index - 1))} aria-label="Previous">
          ‹
        </button>
        <button className="parrow right" onClick={() => goto(Math.min(pages.length - 1, index + 1))} aria-label="Next">
          ›
        </button>
        {chrome}
      </div>
    );
  }

  /* ------------------------------------------------------------- scroll */
  return (
    <div className="present-root" ref={root}>
      <div className="scrollmode hide-scroll" ref={scroller}>
        {pages.map((p) => (
          <section key={p.id} style={{ height: '100vh' }}>
            <Stage page={p} brand={presentation.brand} retailer={presentation.retailer} mode="fill" />
          </section>
        ))}
      </div>
      {chrome}
    </div>
  );
}
