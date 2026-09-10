'use client';

import { useEffect, type RefObject } from 'react';

/**
 * ENTRANCE MOTION
 * ---------------------------------------------------------------------------
 * A deck read in a browser is a scroll story, and a scroll story earns its
 * pacing: each page gets one arrival, and the parts of the page arrive in
 * reading order rather than all at once. Everything visual lives in CSS —
 * this file only decides WHEN a page has arrived, and runs the one effect CSS
 * cannot: counting a figure up to its value.
 *
 * A page arrives once. Scrolling back up does not replay it, because a deck
 * that re-animates on every pass reads as a website, not as a presentation.
 *
 * The motion is opt-in per root: the class goes on at run time, so a page
 * that never reaches this hook (the editor canvas, a print) renders in its
 * finished state instead of staying invisible.
 */

const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);
const COUNT_MS = 1150;

/** prefix (currency, sign) · the number · suffix (+, %, M, unit) */
const FIGURE = /^([^\d]*)(\d[\d,]*(?:\.\d+)?)(.*)$/;

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Count a metric up to the number it already says. The element's own text is
 * the source of truth — the value is never re-derived from the model, so
 * whatever the deck says is what it lands on, formatting and all.
 */
function countUp(stage: Element): void {
  stage.querySelectorAll<HTMLElement>('.metric .mv .tt').forEach((node) => {
    if (node.dataset.counted) return;
    const raw = (node.textContent || '').trim();
    const m = FIGURE.exec(raw);
    if (!m) return;

    const target = parseFloat(m[2].replace(/,/g, ''));
    if (!isFinite(target) || target <= 0) return;

    node.dataset.counted = '1';
    const grouped = m[2].includes(',');
    const decimals = (m[2].split('.')[1] || '').length;

    /* The figure is wider at its value than at zero, so the label under it
     * would step sideways for a second. Hold the finished width instead. */
    const width = node.getBoundingClientRect().width;
    if (width) node.style.minWidth = width + 'px';
    node.classList.add('counting');

    const started = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - started) / COUNT_MS);
      const v = target * EASE_OUT(t);
      const shown = decimals ? v.toFixed(decimals) : Math.round(v).toString();
      node.textContent =
        m[1] +
        (grouped
          ? Number(shown).toLocaleString('en-US', {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })
          : shown) +
        m[3];
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        node.textContent = raw;
        node.classList.remove('counting');
        node.style.minWidth = '';
      }
    };
    requestAnimationFrame(frame);
  });
}

function arrive(stage: Element): void {
  stage.classList.add('in');
  countUp(stage);
}

/**
 * @param rootRef      the element that carries the `motion` class
 * @param scrollerRef  the scrolling element, when the pages live inside one
 * @param key          re-runs the observer when the page set changes
 */
export function useEntrance(
  rootRef: RefObject<HTMLElement | null>,
  scrollerRef: RefObject<HTMLElement | null>,
  key: unknown
): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const stages = Array.from(root.querySelectorAll('.stage'));
    if (!stages.length) return;

    if (reducedMotion()) {
      stages.forEach((s) => s.classList.add('in'));
      return;
    }

    root.classList.add('motion');

    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          arrive(e.target);
          io.unobserve(e.target);
        }),
      { root: scrollerRef.current || null, threshold: 0.22 }
    );
    stages.forEach((s) => io.observe(s));

    /* The first page is already on screen when the deck opens; it should
     * arrive on its own rather than waiting for someone to scroll. */
    const first = requestAnimationFrame(() => {
      if (stages[0]) {
        arrive(stages[0]);
        io.unobserve(stages[0]);
      }
    });

    return () => {
      cancelAnimationFrame(first);
      io.disconnect();
      root.classList.remove('motion');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export default useEntrance;
