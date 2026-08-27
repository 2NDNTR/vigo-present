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
    // step down until the widest word stops overflowing its column
    for (let i = 0; i < 20; i++) {
      if (el.scrollWidth <= el.clientWidth + 1) break;
      f = Math.max(MIN_FIT, f - 0.04);
      el.style.setProperty('--tt-fit', String(f));
      if (f <= MIN_FIT) break;
    }
  }, [fit]);

  useLayoutEffect(() => {
    refit();
  }, [value, refit, style]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !fit) return;
    // observe the container, never the element being resized
    const parent = el.parentElement;
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
  }, [refit, fit]);

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
