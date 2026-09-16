'use client';

import { useState } from 'react';
import type { Block } from '@/lib/model/types';
import type { BrandTheme, ColorRole } from '@/lib/brand/themes';
import { colorLabel } from '@/lib/brand/themes';

/**
 * THE SELECTION BAR
 * ---------------------------------------------------------------------------
 * Three things, on the block, where the block is: change its colour, add
 * another beside it, remove it. Everything else stays in the panel.
 *
 * Canva's version of this bar carries a dozen controls because Canva's promise
 * is that anything is possible. Ours carries three because the other nine —
 * font, size, position, rotation, opacity, effects — are decisions this
 * product makes FOR the user, on purpose. A bar that offered them would be
 * offering to break the brand from the most convenient place on screen.
 *
 * Even the colour is not a colour: it is a role from the theme, so a rebrand
 * carries it.
 */
export default function BlockBar({
  block,
  theme,
  onDark,
  canAdd,
  onColor,
  onAdd,
  onDelete,
}: {
  block: Block;
  theme: BrandTheme;
  /** the page's surface is dark — which is what 'auto' resolves against */
  onDark: boolean;
  canAdd: boolean;
  onColor: (role: ColorRole | 'auto') => void;
  onAdd: () => void;
  onDelete: () => void;
}) {
  const [colors, setColors] = useState(false);
  const current = block.style?.color || 'auto';

  /*
   * The swatch shows the colour the block IS, not the colour someone has
   * overridden it to. Most blocks are on 'auto' — they take the page's ink —
   * and drawing that as an empty or crossed-out chip says "no colour", which
   * is both wrong and alarming: the text on screen plainly has one. So auto is
   * resolved the same way the renderer resolves it, and the menu is where the
   * distinction between chosen and inherited lives.
   */
  const shown = current === 'auto'
    ? onDark
      ? theme.colors.white || '#ffffff'
      : theme.colors[theme.surface.ink]
    : theme.colors[current as ColorRole];

  return (
    <div
      className="bbar"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className={'bbar-btn' + (colors ? ' on' : '')}
        title="Colour"
        aria-label="Colour"
        onClick={() => setColors(!colors)}
      >
        <span className="bbar-swatch" style={{ background: shown }} />
      </button>

      {canAdd ? (
        <button className="bbar-btn" title="Add another like this" aria-label="Add another like this" onClick={onAdd}>
          +
        </button>
      ) : null}

      <span className="bbar-sep" />

      <button className="bbar-btn danger" title="Remove" aria-label="Remove" onClick={onDelete}>
        <TrashIcon />
      </button>

      {colors ? (
        <div className="bbar-colors">
          <button
            className={'bbar-color' + (current === 'auto' ? ' on' : '')}
            title="From the theme"
            onClick={() => {
              onColor('auto');
              setColors(false);
            }}
          >
            <i className="auto" style={{ background: shown }} />
          </button>
          {theme.textColors.map((r) => (
            <button
              key={r}
              className={'bbar-color' + (current === r ? ' on' : '')}
              title={colorLabel(theme, r)}
              onClick={() => {
                onColor(r);
                setColors(false);
              }}
            >
              <i style={{ background: theme.colors[r] }} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}


/** A bin, drawn rather than typed: a hyphen does not read as "delete". */
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 4h4a1 1 0 0 1 1 1v2H9V5a1 1 0 0 1 1-1z" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M10 11v7M14 11v7" />
    </svg>
  );
}
