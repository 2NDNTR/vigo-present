'use client';

import type { Block } from '@/lib/model/types';

/**
 * The floating bar over a selected item. Short on purpose: the brand decides
 * fonts, colours and sizes, so what is left to do by hand is swap a photo,
 * nudge its framing, repeat the item, put it back where the layout had it, or
 * take it away.
 */
export default function ItemBar({
  block,
  moved,
  focusing,
  canDuplicate,
  onSwap,
  onFocus,
  onDuplicate,
  onReset,
  onDelete,
}: {
  block: Block;
  moved: boolean;
  focusing: boolean;
  canDuplicate: boolean;
  onSwap?: () => void;
  onFocus: () => void;
  onDuplicate: () => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const picture = block.type === 'image' || block.type === 'video' || (block.type === 'card' && block.showImage !== false);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div className="itembar" role="toolbar" aria-label="Item" onMouseDown={stop} onPointerDown={stop} onClick={stop}>
      {picture && onSwap ? (
        <button onClick={onSwap} title="Choose another photo from the library">
          <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="m3 11 3.5-3.5 2.5 2.5 2-2 2 2" /></svg>
          Swap photo
        </button>
      ) : null}
      {picture && block.media?.url ? (
        <button className={focusing ? 'on' : ''} onClick={onFocus} title="Drag the photo inside its frame">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12M5.5 4.5 8 2l2.5 2.5M5.5 11.5 8 14l2.5-2.5M4.5 5.5 2 8l2.5 2.5M11.5 5.5 14 8l-2.5 2.5" /></svg>
          {focusing ? 'Done' : 'Reframe'}
        </button>
      ) : null}
      {canDuplicate ? (
        <button onClick={onDuplicate} title="Add another like this">
          <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="1.5" /><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" /></svg>
          Duplicate
        </button>
      ) : null}
      {moved ? (
        <button onClick={onReset} title="Put it back where the layout places it">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3v4h4" /><path d="M3.5 7A5 5 0 1 1 5 11.5" /></svg>
          Reset
        </button>
      ) : null}
      <span className="itembar-sep" />
      <button className="danger" onClick={onDelete} title="Remove" aria-label="Remove">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.6 8.5h4.8l.6-8.5" /></svg>
      </button>
    </div>
  );
}
