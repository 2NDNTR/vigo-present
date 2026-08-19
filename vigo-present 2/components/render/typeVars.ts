import type { CSSProperties } from 'react';
import type { TypeRole } from '@/lib/brand/themes';

/**
 * Typography is applied by ROLE, never by size. The role resolves to whatever
 * the active brand theme says it means.
 */
export function typeVars(role: TypeRole, scale = 1): CSSProperties {
  return {
    ['--tt-family' as any]: `var(--t-${role}-family)`,
    ['--tt-size' as any]: `var(--t-${role}-size)`,
    ['--tt-weight' as any]: `var(--t-${role}-weight)`,
    ['--tt-lh' as any]: `var(--t-${role}-lh)`,
    ['--tt-tracking' as any]: `var(--t-${role}-tracking)`,
    ['--tt-transform' as any]: `var(--t-${role}-transform)`,
    ['--tt-scale' as any]: String(scale),
  } as CSSProperties;
}

export function u(n: number): string {
  return `calc(var(--u) * ${n}px)`;
}
