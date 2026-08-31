'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';

/**
 * SELECT — a real menu, not a native <select>
 * ---------------------------------------------------------------------------
 * A native <select> hands its popup to the operating system, which draws it in
 * the OS style and ignores every line of CSS on the page. On macOS that is a
 * dark, dense list that has nothing to do with the rest of this application.
 * There is no styling fix for it; the control has to be rebuilt.
 *
 * So this is a button plus a listbox, which means the menu is ours to design —
 * and, more usefully, ours to STRUCTURE. Options carry an optional `group`, so
 * a long list is broken by section headings instead of repeating the category
 * on every row ("Storytelling — Quote" becomes "Quote" under "Storytelling").
 *
 * The menu renders into a portal on <body>. The inspector is a narrow scrolling
 * column, and a menu positioned inside it would be clipped by that column's
 * overflow — a portal plus fixed positioning lets it sit above everything and
 * flip above the trigger when it would otherwise run off the bottom.
 *
 * Keyboard behaviour matches what people expect from a native control, because
 * that is the part of "native" actually worth keeping: arrows, Home/End, Enter,
 * Escape, and type-ahead.
 */

export interface SelectOption {
  value: string;
  label: string;
  /** Optional section heading. Consecutive options sharing one are grouped. */
  group?: string;
}

const MENU_MAX_H = 360;
const MARGIN = 8;

export default function Select({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  style,
  ariaLabel,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const typed = useRef({ buf: '', at: 0 });

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - MARGIN;
    const above = r.top - MARGIN;
    // Flip up only when there is genuinely more room there — a menu that flips
    // for a few pixels of gain reads as a glitch.
    const up = below < Math.min(MENU_MAX_H, options.length * 34 + 12) && above > below;
    setPos({ left: r.left, top: up ? r.top - MARGIN : r.bottom + 6, width: r.width, up });
  }, [options.length]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    // `true` so a scroll inside the inspector closes the menu too — a menu that
    // stays pinned while the panel behind it moves looks broken.
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  // Keep the highlighted row visible when arrowing through a long list.
  useEffect(() => {
    if (!open || active < 0) return;
    itemRefs.current[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function openMenu() {
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function commit(i: number) {
    const o = options[i];
    if (!o) return;
    onChange(o.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      commit(active);
    } else if (e.key === 'Tab') {
      setOpen(false);
    } else if (e.key.length === 1) {
      // Type-ahead: keystrokes within a second compound into one search.
      const now = Date.now();
      typed.current.buf = now - typed.current.at > 1000 ? e.key : typed.current.buf + e.key;
      typed.current.at = now;
      const q = typed.current.buf.toLowerCase();
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(q));
      if (hit >= 0) setActive(hit);
    }
  }

  const menu =
    open && pos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className={'selectmenu' + (pos.up ? ' up' : '')}
            role="listbox"
            style={{
              left: pos.left,
              width: pos.width,
              maxHeight: MENU_MAX_H,
              ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            }}
          >
            {options.map((o, i) => {
              const newGroup = o.group && (i === 0 || options[i - 1].group !== o.group);
              return (
                <div key={o.value}>
                  {newGroup && <div className="selectgroup">{o.group}</div>}
                  <div
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    role="option"
                    aria-selected={o.value === value}
                    className={
                      'selectitem' +
                      (i === active ? ' active' : '') +
                      (o.value === value ? ' on' : '')
                    }
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commit(i);
                    }}
                  >
                    <svg className="selectcheck" viewBox="0 0 14 14" aria-hidden="true">
                      <path
                        d="M2.5 7.4l3 3 6-6.4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>{o.label}</span>
                  </div>
                </div>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={'selecttrigger' + (open ? ' open' : '')}
        style={style}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className={'selectvalue' + (selected ? '' : ' placeholder')}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="selectchev" viewBox="0 0 12 16" aria-hidden="true">
          <path
            d="M3.2 6.4L6 3.6l2.8 2.8M3.2 9.6L6 12.4l2.8-2.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {menu}
    </>
  );
}
