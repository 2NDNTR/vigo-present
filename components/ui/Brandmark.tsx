import type { CSSProperties } from 'react';

/**
 * THE PRODUCT MARK
 * ---------------------------------------------------------------------------
 * One component, used by every header, so the logo is replaced in exactly one
 * place — the same principle the asset registry applies to photography:
 * reference it once, change it once.
 *
 * `size="lg"` is for the sign-in screen, where the mark stands alone above the
 * form rather than sitting in a 64px bar.
 *
 * The width is intentionally not fixed. The file is 762x128 and the CSS sets
 * the height only, so the aspect ratio is whatever the artwork actually is —
 * a new logo of different proportions drops in without touching any layout.
 */
export default function Brandmark({
  size = 'md',
  style,
}: {
  /** sm sits in the editor's 56px bar; lg stands alone above the sign-in form */
  size?: 'sm' | 'md' | 'lg';
  style?: CSSProperties;
}) {
  return (
    <div className={'brandmark' + (size === 'md' ? '' : ' ' + size)} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/presentor-logo.png" alt="Presentor" />
    </div>
  );
}
