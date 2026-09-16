'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A GROUP OF CONTROLS, IN ONE OF TWO SHAPES
 * ---------------------------------------------------------------------------
 * inline — a disclosure in a column. What a narrow rail wants.
 * menu   — a button on a toolbar that opens its controls in a popover. What a
 *          toolbar wants, and the reason this exists.
 *
 * The first attempt at a top panel laid every group out flat across the width,
 * which turned a settings rail on its side and produced a five-hundred-pixel
 * wall above the work — worse than the rail, because now it ate the dimension
 * the slide actually needs. A toolbar is one row tall. Everything else it
 * holds is behind a menu, opened on demand and dismissed by looking away.
 */
export default function Collapse({
  title,
  children,
  defaultOpen = false,
  note,
  mode = 'inline',
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  note?: string;
  mode?: 'inline' | 'menu';
}) {
  const [open, setOpen] = useState(mode === 'menu' ? false : defaultOpen);
  const wrap = useRef<HTMLDivElement>(null);

  /* A menu closes when you click away or press escape. Without this it is not
   * a menu, it is a panel that happens to be small. */
  useEffect(() => {
    if (mode !== 'menu' || !open) return;
    const away = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [mode, open]);

  if (mode === 'menu') {
    return (
      <div className={'barmenu' + (open ? ' open' : '')} ref={wrap}>
        <button className="barbtn" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span dangerouslySetInnerHTML={{ __html: title }} />
          <i className="barcaret" aria-hidden="true" />
        </button>
        {open ? <div className="barpop">{children}</div> : null}
      </div>
    );
  }

  return (
    <div className={'collapse' + (open ? ' open' : '')}>
      <button className="collapse-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span dangerouslySetInnerHTML={{ __html: title }} />
        {note && !open ? <i className="collapse-note">{note}</i> : null}
        <span className="collapse-caret" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="collapse-body">{children}</div> : null}
    </div>
  );
}
