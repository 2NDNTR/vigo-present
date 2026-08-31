'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

interface Props {
  value: string;
  onChange?: (v: string) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  onFocus?: () => void;
  /** shrink to fit rather than let a word break across lines */
  fit?: boolean;
  /**
   * Maximum multiplier the type may GROW by to fill its column, for the one
   * case where the text is the page (the Single Metric layout). Measured
   * against the real column rather than an estimate, because the display faces
   * differ in width per brand — Alessi's runs wide enough that a figure fitted
   * by arithmetic hung off both edges of the page.
   */
  growTo?: number;
}

const MIN_FIT = 0.55;

/**
 * Click the text. Type. Done.
 * Uncontrolled on purpose so the caret never jumps while typing.
 *
 * Words are never broken mid-word. When a word is too wide for its column the
 * type steps down until it fits — the same thing a designer would do, and the
 * reason nobody has to think about font size.
 */
export default function EditableText({
  value,
  onChange,
  editable,
  placeholder,
  className,
  style,
  onFocus,
  fit = true,
  growTo,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el && el.innerText !== (value || '')) {
      el.innerText = value || '';
    }
  }, [value]);

  const refit = useCallback(() => {
    const el = ref.current;
    if (!el || !fit) return;
    el.style.setProperty('--tt-fit', '1');
    if (!el.textContent) return;
    let f = 1;

    // GROW TO FILL — only when the caller asks for it, and only measured.
    // A solo metric is shrink-to-fit, so its own clientWidth tells us nothing;
    // the page's slot is the real column, and the whole metric group (value,
    // label, context line) is what has to stay inside its height.
    if (growTo && growTo > 1) {
      const slot = el.closest('.slot') as HTMLElement | null;
      const group = el.closest('.metric') as HTMLElement | null;
      if (slot) {
        const cs = getComputedStyle(slot);
        const availW =
          slot.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0');
        const availH =
          slot.clientHeight - parseFloat(cs.paddingTop || '0') - parseFloat(cs.paddingBottom || '0');
        if (availW > 0 && availH > 0) {
          for (let i = 0; i < 60 && f < growTo; i++) {
            const next = Math.min(growTo, f + 0.05);
            el.style.setProperty('--tt-fit', String(next));
            const tooWide = el.getBoundingClientRect().width > availW * 0.96;
            const tooTall = !!group && group.getBoundingClientRect().height > availH * 0.98;
            if (tooWide || tooTall) {
              el.style.setProperty('--tt-fit', String(f));
              break;
            }
            f = next;
          }
          return;
        }
      }
    }

    // step down until the widest word stops overflowing its column
    for (let i = 0; i < 20; i++) {
      if (el.scrollWidth <= el.clientWidth + 1) break;
      f = Math.max(MIN_FIT, f - 0.04);
      el.style.setProperty('--tt-fit', String(f));
      if (f <= MIN_FIT) break;
    }
  }, [fit, growTo]);

  useLayoutEffect(() => {
    refit();
  }, [value, refit, style]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !fit) return;
    // Observe the container, never the element being resized. When growing,
    // the immediate parent is shrink-to-fit and moves WITH the text, so watch
    // the page slot instead — otherwise each refit retriggers the observer.
    const parent = (growTo && growTo > 1 ? el.closest('.slot') : null) || el.parentElement;
    const ro = new ResizeObserver(() => refit());
    if (parent) ro.observe(parent);
    let cancelled = false;
    (document as any).fonts?.ready?.then(() => {
      if (!cancelled) refit();
    });
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [refit, fit, growTo]);

  return (
    <div
      ref={ref}
      className={(className || '') + ' editable-text'}
      style={style}
      data-ph={placeholder || ''}
      contentEditable={!!editable}
      suppressContentEditableWarning
      spellCheck={!!editable}
      onFocus={editable ? onFocus : undefined}
      onInput={
        editable
          ? (e) => {
              refit();
              onChange && onChange((e.target as HTMLElement).innerText);
            }
          : undefined
      }
      onPaste={
        editable
          ? (e) => {
              e.preventDefault();
              const text = e.clipboardData.getData('text/plain');
              document.execCommand('insertText', false, text);
            }
          : undefined
      }
      onKeyDown={
        editable
          ? (e) => {
              if (e.key === 'Escape') (e.target as HTMLElement).blur();
              e.stopPropagation();
            }
          : undefined
      }
    />
  );
}
