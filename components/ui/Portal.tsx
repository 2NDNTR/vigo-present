'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Draws its children at the end of <body>, outside whatever panel opened them.
 * Pop-ups use it so they never inherit a dark panel's colours, clipping or stacking.
 */
export default function Portal({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? createPortal(children, document.body) : null;
}
