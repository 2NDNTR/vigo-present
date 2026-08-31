'use client';

/**
 * SLIDE-TO-SLIDE MOTION
 * ---------------------------------------------------------------------------
 * One tween, used by the preview and by the published link, so a deck moves the
 * same way wherever it is watched.
 *
 * `scrollTo({ behavior: 'smooth' })` was doing this before. It is not tunable —
 * the curve and the duration belong to the browser, and they differ between
 * Chrome, Safari and Firefox. For a page that is a whole slide tall, the
 * default reads as a fast slide plus an abrupt stop. Animating it ourselves
 * costs a few lines and buys a curve we can actually design.
 */

/**
 * Slow out, fast through the middle, settle gently. The long tail is the part
 * that reads as "expensive": the slide decelerates into place rather than
 * arriving and stopping dead.
 */
function easeInOutQuint(t: number): number {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface ScrollAnimation {
  cancel: () => void;
  done: Promise<void>;
}

/**
 * Tweens `el.scrollTop` to `to`. Returns a handle so a new move can cancel one
 * already running — without that, two overlapping tweens fight each other and
 * the deck stutters.
 */
export function animateScrollTo(el: HTMLElement, to: number, duration = 760): ScrollAnimation {
  const from = el.scrollTop;
  const distance = to - from;

  if (prefersReducedMotion() || Math.abs(distance) < 2) {
    el.scrollTop = to;
    return { cancel: () => {}, done: Promise.resolve() };
  }

  // A one-slide move and a jump from slide 1 to slide 9 should not take the
  // same time; scale with distance, but keep it inside a deliberate range.
  const screens = Math.abs(distance) / Math.max(1, el.clientHeight);
  const ms = Math.min(1150, Math.max(420, duration * (0.72 + screens * 0.28)));

  let raf = 0;
  let cancelled = false;
  let resolve: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  const start = performance.now();

  const step = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - start) / ms);
    el.scrollTop = from + distance * easeInOutQuint(t);
    if (t < 1) raf = requestAnimationFrame(step);
    else resolve();
  };
  raf = requestAnimationFrame(step);

  return {
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      resolve();
    },
    done,
  };
}
