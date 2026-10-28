'use client';

import { useEffect, useRef, useState } from 'react';
import { useEntrance } from '@/components/present/Motion';
import Stage from '@/components/render/Stage';
import type { Presentation } from '@/lib/model/types';
import { getTheme } from '@/lib/brand/themes';

/**
 * PRESENTATION MODE
 * Three experiences from the same structured data:
 *   SCROLL      — a vertically scrolling web story
 *   HORIZONTAL  — the same story scrolling sideways, a page per screen
 *   SLIDES      — traditional next / previous navigation (V1 decks)
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

  /* ------------------------------------------------------ idle chrome
   * The controls are there the moment the mouse moves and gone a couple of
   * seconds after it stops, so the deck has the screen to itself while someone
   * talks over it. Touch and keyboard bring them back the same way. */
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t = 0;
    const wake = () => {
      setIdle(false);
      window.clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), 2600);
    };
    wake();
    const evs = ['mousemove', 'pointerdown', 'keydown', 'touchstart'] as const;
    evs.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      window.clearTimeout(t);
      evs.forEach((e) => window.removeEventListener(e, wake));
    };
  }, []);

  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const canFull = typeof document !== 'undefined' && !!document.fullscreenEnabled;

  /* ---------------------------------------------------------- keyboard */
  const indexRef = useRef(0);
  indexRef.current = index;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return;
      if (e.key === 'Escape' && onExit && !document.fullscreenElement) onExit();
      if (e.key === 'f' || e.key === 'F') toggleFull();
      if (narrow) return;
      const fwd = ['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key);
      const back = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key);
      if (fwd || back || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const i = indexRef.current;
        goto(e.key === 'Home' ? 0 : e.key === 'End' ? pages.length - 1 : fwd ? Math.min(pages.length - 1, i + 1) : Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, narrow, pages.length, onExit]);

  /* ------------------------------------------- track position in scroll */
  useEffect(() => {
    if ((mode !== 'scroll' && mode !== 'horizontal') || narrow) return;
    const el = scroller.current;
    if (!el) return;
    const across = mode === 'horizontal';
    const onScroll = () => {
      const i = across ? Math.round(el.scrollLeft / el.clientWidth) : Math.round(el.scrollTop / el.clientHeight);
      setIndex(Math.max(0, Math.min(pages.length - 1, i)));
    };
    /* A mouse wheel only moves up and down. Sideways, the wheel turns the
     * pages, so nobody has to find a trackpad gesture to read the deck. */
    const onWheel = (e: WheelEvent) => {
      if (!across || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollBy({ left: e.deltaY, behavior: 'auto' });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
    };
  }, [mode, narrow, pages.length]);

  /* ------------------------------------------------------ entrance motion
   * Every composition gets the same treatment — the phone stack, the slide
   * deck and the scroll story all arrive the same way, so the deck feels like
   * one thing at three sizes. In slides the key changes with the index, which
   * is what replays the arrival on each new slide. */
  const root = useRef<HTMLDivElement>(null);
  useEntrance(root, scroller, mode === 'slide' && !narrow ? index : pages.length + ':' + narrow + mode);

  function goto(i: number) {
    setIndex(i);
    if (mode === 'scroll' && !narrow && scroller.current) {
      scroller.current.scrollTo({ top: i * scroller.current.clientHeight, behavior: 'smooth' });
    }
    if (mode === 'horizontal' && !narrow && scroller.current) {
      scroller.current.scrollTo({ left: i * scroller.current.clientWidth, behavior: 'smooth' });
    }
  };

  const name = (i: number) => pages[i]?.sectionStart || 'Page ' + (i + 1);
  const chrome = (
    <div className={'pchrome2' + (idle ? ' idle' : '')}>
      <div className="pbar">
        <i style={{ width: ((index + 1) / pages.length) * 100 + '%' }} />
      </div>
      {mode === 'scroll' && (
        <nav className="prail" aria-label="Pages">
          {pages.map((p, i) => (
            <button key={p.id} className={i === index ? 'on' : ''} onClick={() => goto(i)} aria-label={name(i)}>
              <span>{name(i)}</span>
            </button>
          ))}
        </nav>
      )}
      <div className="pdock" role="toolbar" aria-label="Presentation controls">
        <span className="pdock-title">{presentation.title}</span>
        <span className="pdock-sep" />
        <button className="pdock-btn" onClick={() => goto(Math.max(0, index - 1))} disabled={index === 0} aria-label="Previous page">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>
        </button>
        <span className="pdock-count">
          <b>{index + 1}</b> / {pages.length}
        </span>
        <button
          className="pdock-btn"
          onClick={() => goto(Math.min(pages.length - 1, index + 1))}
          disabled={index === pages.length - 1}
          aria-label="Next page"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
        </button>
        {canFull && (
          <>
            <span className="pdock-sep" />
            <button className="pdock-btn" onClick={toggleFull} aria-label={full ? 'Exit full screen' : 'Full screen'} title="Full screen (F)">
              {full ? (
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" /></svg>
              ) : (
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" /></svg>
              )}
            </button>
          </>
        )}
        {onExit && (
          <button className="pdock-close" onClick={onExit}>
            Close
          </button>
        )}
      </div>
    </div>
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
        {/* the two halves of the screen turn the page, as a clicker would */}
        <button className="pzone left" onClick={() => goto(Math.max(0, index - 1))} aria-label="Previous page" tabIndex={-1} />
        <button className="pzone right" onClick={() => goto(Math.min(pages.length - 1, index + 1))} aria-label="Next page" tabIndex={-1} />
        {chrome}
      </div>
    );
  }

  /* -------------------------------------------------------- horizontal */
  if (mode === 'horizontal') {
    return (
      <div className="present-root" ref={root}>
        <div className="hscrollmode hide-scroll" ref={scroller}>
          {pages.map((p) => (
            <section key={p.id}>
              <Stage page={p} brand={presentation.brand} retailer={presentation.retailer} mode="fill" />
            </section>
          ))}
        </div>
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
