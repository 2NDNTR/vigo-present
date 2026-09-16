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
  canAdd,
  onColor,
  onAdd,
  onDelete,
}: {
  block: Block;
  theme: BrandTheme;
  canAdd: boolean;
  onColor: (role: ColorRole | 'auto') => void;
  onAdd: () => void;
  onDelete: () => void;
}) {
  const [colors, setColors] = useState(false);
  const current = block.style?.color || 'auto';

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
        <span
          className="bbar-swatch"
          style={current !== 'auto' ? { background: theme.colors[current as ColorRole] } : undefined}
        />
      </button>

      {canAdd ? (
        <button className="bbar-btn" title="Add another like this" aria-label="Add another like this" onClick={onAdd}>
          +
        </button>
      ) : null}

      <span className="bbar-sep" />

      <button className="bbar-btn danger" title="Remove" aria-label="Remove" onClick={onDelete}>
        −
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
            <i className="auto" />
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
