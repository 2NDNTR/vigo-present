'use client';

import { useEffect, useState } from 'react';

/**
 * DOES IT ACTUALLY FIT?
 * ---------------------------------------------------------------------------
 * Every other guardrail in this product is computed from the data: too many
 * cards, a headline of ninety characters, a colour that will not survive its
 * background. Whether a paragraph FITS cannot be known that way. It depends on
 * which font loaded, how it wrapped, and the exact width the slide rendered
 * at — facts only the browser has.
 *
 * So this measures. It is the difference between a product that promises
 * on-brand output and one that merely intends it: a page that spills past its
 * slide is off-brand in the most literal sense, it is invisible in the editor
 * at the size people work at, and the first person to see it is usually the
 * buyer.
 *
 * Measurement is deliberately conservative. A slot is only reported when it
 * overflows by more than a couple of points, because sub-pixel rounding at
 * some window widths will always produce a fraction, and a warning that cries
 * wolf is a warning people learn to scroll past.
 */

export interface Overflow {
  label: string;
  by: number;
}

const SLOP = 3;

export function useFit(root: HTMLElement | null, key: unknown): Overflow[] {
  const [over, setOver] = useState<Overflow[]>([]);

  useEffect(() => {
    if (!root) return;

    const measure = () => {
      const found: Overflow[] = [];
      root.querySelectorAll<HTMLElement>('.stage .slot').forEach((el) => {
        const by = el.scrollHeight - el.clientHeight;
        if (by > SLOP) {
          /* The slot's own key is the only name available in the DOM; the
           * label a person would recognise comes from the template, so it is
           * resolved by the caller. Sending the key keeps this hook ignorant
           * of the template registry. */
          found.push({ label: el.dataset.slot || 'This page', by });
        }
      });
      setOver((prev) =>
        prev.length === found.length && prev.every((p, i) => p.label === found[i].label && Math.abs(p.by - found[i].by) < 1)
          ? prev
          : found
      );
    };

    /* Two frames, then once more after the fonts settle: a measurement taken
     * before the real face loads is a measurement of the fallback. */
    const raf = requestAnimationFrame(() => requestAnimationFrame(measure));
    const settle = window.setTimeout(measure, 400);
    (document as any).fonts?.ready?.then(measure).catch(() => {});

    const ro = new ResizeObserver(measure);
    ro.observe(root);
    root.querySelectorAll('.stage .slot').forEach((el) => ro.observe(el));

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      ro.disconnect();
    };
  }, [root, key]);

  return over;
}
