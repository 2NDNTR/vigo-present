'use client';

import { useState } from 'react';

/**
 * The panel had every control visible at once, which reads as complexity even
 * when each control is simple. The three or four things people touch on every
 * page stay out; everything else lives one click away, closed by default and
 * remembered open while the page is being worked on.
 */
export default function Collapse({
  title,
  children,
  defaultOpen = false,
  note,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  note?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={'collapse' + (open ? ' open' : '')}>
      <button className="collapse-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{title}</span>
        {note && !open ? <i className="collapse-note">{note}</i> : null}
        <span className="collapse-caret" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="collapse-body">{children}</div> : null}
    </div>
  );
}
