'use client';

import { useEffect, useRef, useState } from 'react';
import Stage from '@/components/render/Stage';
import type { Presentation } from '@/lib/model/types';
import { getTheme } from '@/lib/brand/themes';
import { animateScrollTo, prefersReducedMotion } from '@/lib/present/scroll';

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
  const anim = useRef<{ cancel: () => void } | null>(null);
  const animating = useRef(false);
  const indexRef = useRef(0);
  indexRef.current = index;
  // The keyboard and wheel handlers are declared above goto; a ref keeps them
  // pointed at the current one without re-binding listeners on every render.
  const gotoRef = useRef<(i: number) => void>(() => {});
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
      if (mode === 'scroll' && !narrow) {
        if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
          e.preventDefault();
          gotoRef.current(indexRef.current + 1);
        }
        if (e.key === 'ArrowUp' || e.key === 'PageUp') {
          e.preventDefault();
          gotoRef.current(indexRef.current - 1);
        }
        if (e.key === 'Home') { e.preventDefault(); gotoRef.current(0); }
        if (e.key === 'End') { e.preventDefault(); gotoRef.current(pages.length - 1); }
      }
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
      // While a tween is running it is the authority on the index; reading it
      // back from scrollTop mid-flight makes the progress bar and dots flicker
      // through every slide the animation passes over.
      if (animating.current) return;
      const i = Math.round(el.scrollTop / el.clientHeight);
      setIndex(Math.max(0, Math.min(pages.length - 1, i)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [mode, narrow, pages.length]);

  /* --------------------------------------------- wheel: one slide per gesture

     Native `scroll-snap` leaves the motion to the browser, and on a trackpad a
     flick carries momentum across two or three slides before the snap catches
     it. Taking the wheel lets one gesture mean exactly one slide, on our curve.

     The cooldown is the important part: a trackpad emits a long tail of small
     deltas after the fingers lift, and without it that tail reads as three more
     page turns. Momentum is ignored until it has genuinely settled.            */
  useEffect(() => {
    if (mode !== 'scroll' || narrow) return;
    const el = scroller.current;
    if (!el || prefersReducedMotion()) return;

    let cooling = false;
    let settle: any;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;                       // pinch-zoom, not a scroll
      e.preventDefault();
      clearTimeout(settle);
      settle = setTimeout(() => (cooling = false), 220);
      if (cooling || animating.current) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      if (Math.abs(e.deltaY) < 4) return;          // ignore the faintest drift
      const next = indexRef.current + dir;
      if (next < 0 || next > pages.length - 1) return;
      cooling = true;
      gotoRef.current(next);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      clearTimeout(settle);
    };
  }, [mode, narrow, pages.length]);

  /* ---------------------------------------------- reveal on entry (scroll) */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.reveal'));
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('in');
        }),
      { threshold: 0.18 }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [pages.length, narrow, mode]);

  const goto = (i: number) => {
    const clamped = Math.max(0, Math.min(pages.length - 1, i));
    setIndex(clamped);
    const el = scroller.current;
    if (mode !== 'scroll' || narrow || !el) return;
    anim.current?.cancel();
    animating.current = true;
    // Mandatory snap and a hand-rolled tween both want to own scrollTop; some
    // engines re-snap on every programmatic write, which fights the curve.
    // Snap is suspended for the duration and restored on arrival, so it is
    // still there for touch and for the reduced-motion path.
    el.style.scrollSnapType = 'none';
    const a = animateScrollTo(el, clamped * el.clientHeight);
    anim.current = a;
    a.done.then(() => {
      if (anim.current !== a) return;
      animating.current = false;
      el.style.scrollSnapType = '';
    });
  };

  gotoRef.current = goto;

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
      <div className="present-root">
        {pages.map((p) => (
          <section key={p.id} className="reveal">
            <Stage page={p} brand={presentation.brand} mode="stacked" />
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
      <div className="present-root" style={{ height: '100vh', overflow: 'hidden' }}>
        <div className="slidewrap">
          <div style={{ width: 'min(100vw, calc(100vh * 16 / 9))' }}>
            <Stage page={pages[index]} brand={presentation.brand} mode="fixed" />
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
    <div className="present-root">
      <div className="scrollmode hide-scroll" ref={scroller}>
        {pages.map((p) => (
          <section key={p.id} style={{ height: '100vh' }}>
            <Stage page={p} brand={presentation.brand} mode="fill" />
          </section>
        ))}
      </div>
      {chrome}
    </div>
  );
}
