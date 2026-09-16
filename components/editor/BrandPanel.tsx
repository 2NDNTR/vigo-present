'use client';

import { BRAND_ORDER, THEMES, TYPE_LABELS, colorLabel, getTheme } from '@/lib/brand/themes';
import type { BrandTheme, ColorRole } from '@/lib/brand/themes';
import type { BrandId, TypeRole } from '@/lib/brand/themes';

export default function BrandPanel({
  brand,
  onChangeBrand,
}: {
  brand: BrandId;
  onChangeBrand: (b: BrandId) => void;
}) {
  const theme = getTheme(brand);
  const roles: TypeRole[] = ['display', 'headline', 'subhead', 'body', 'caption', 'metricXl', 'metricLarge', 'metricLabel'];

  return (
    <div>
      <div className="panel-sec" style={{ paddingTop: 0 }}>
        <h4 className="panel-h">Brand</h4>
        <div className="seg" style={{ marginBottom: 10 }}>
          {BRAND_ORDER.map((b) => (
            <button key={b} className={brand === b ? 'on' : ''} onClick={() => onChangeBrand(b)}>
              {THEMES[b].shortName}
            </button>
          ))}
        </div>
        <p className="tiny">{theme.description}</p>
      </div>

      {/*
        * THE APPROVED COLOURS ARE THE BRAND'S, NOT A FIXED LIST
        * -------------------------------------------------------------------
        * This read from SWATCH_ORDER — seven roles, hard-coded, identical for
        * every brand. So Vigo's panel showed a brown accent and two greys and
        * called them approved, while Vigo Yellow and Vigo Red, the two colours
        * the brand is actually made of, were not on the list at all. A brand
        * panel that misreports the brand is worse than no brand panel.
        *
        * Each theme already declares what it approves: textColors for type,
        * surfaceColors for backgrounds. Those are the answer, and they are
        * shown split, because "you may set type in this" and "you may fill a
        * page with this" are different permissions and the deck treats them
        * differently.
        */}
      <div className="panel-sec">
        <div className="label" style={{ marginBottom: 8 }}>Approved for type</div>
        <Swatches roles={theme.textColors} theme={theme} />

        <div className="label" style={{ margin: '16px 0 8px' }}>Approved for surfaces</div>
        <Swatches roles={theme.surfaceColors} theme={theme} />

        <p className="tiny" style={{ marginTop: 10 }}>
          There is no colour picker on purpose. Only {theme.shortName}&rsquo;s approved colours can be used.
        </p>
      </div>

      <div className="panel-sec">
        <div className="label" style={{ marginBottom: 8 }}>Typography scale</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {roles.map((r) => (
            <div key={r} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontFamily: theme.type[r].family === 'display' ? theme.fonts.display : theme.fonts.body,
                  fontWeight: theme.type[r].weight,
                  fontSize: 14,
                }}
              >
                {TYPE_LABELS[r]}
              </span>
              <span className="tiny mono-num">{theme.type[r].size} / {theme.type[r].weight}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-sec">
        <div className="label" style={{ marginBottom: 8 }}>Logo</div>
        <div style={{ border: '1px solid var(--app-line)', borderRadius: 8, padding: '18px 14px', textAlign: 'center' }}>
          <span
            style={{
              fontFamily: theme.logo.family === 'display' ? theme.fonts.display : theme.fonts.body,
              fontWeight: theme.logo.weight,
              letterSpacing: theme.logo.tracking + 'em',
              fontSize: 15,
            }}
          >
            {theme.logo.text}
          </span>
        </div>
        <p className="tiny" style={{ marginTop: 10 }}>
          Placeholder wordmark. Drop the approved logo files in and every presentation updates.
        </p>
      </div>

      <div className="panel-sec">
        <div className="banner" style={{ margin: 0 }}>
          <b>Placeholder tokens.</b> Colours, fonts and logos here are neutral stand-ins. Replace the
          values in <code>lib/brand/themes.ts</code> and every presentation ever created inherits the
          change — no page is ever edited by hand.
        </div>
      </div>
    </div>
  );
}

/**
 * A row per approved colour. White and cream are invisible on a white panel
 * without a hairline, and a swatch nobody can see is not documentation.
 */
function Swatches({ roles, theme }: { roles: ColorRole[]; theme: BrandTheme }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {roles.map((c) => (
        <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            className="swatch"
            style={{
              background: theme.colors[c],
              cursor: 'default',
              boxShadow: 'inset 0 0 0 1px rgba(16,24,40,0.14)',
            }}
          />
          <span style={{ fontSize: 12.5 }}>{colorLabel(theme, c)}</span>
          <span className="tiny mono-num" style={{ marginLeft: 'auto' }}>{theme.colors[c]}</span>
        </div>
      ))}
    </div>
  );
}
