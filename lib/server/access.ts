import 'server-only';
import { NextResponse } from 'next/server';
import { q } from './db';
import { currentUser, type SessionUser } from './auth';

/**
 * WHO MAY DO WHAT
 * ---------------------------------------------------------------------------
 * Every permission in the product is one of three questions about one brand:
 * may this person SEE it, EDIT it, or ADMINISTER it. A deck, an asset and a
 * template each belong to exactly one brand, so the answer for the brand is
 * the answer for the thing.
 *
 *   platform admin   everything, every brand, plus people and brands
 *   brand_admin      edit + manage that brand's identity, templates, media
 *   editor           create and edit decks and media in that brand
 *   viewer           open decks in that brand, nothing else
 *
 * Checked here, on the server, on every request. The interface hides what a
 * person cannot do as a courtesy; it is never what stops them.
 */

export type BrandRole = 'brand_admin' | 'editor' | 'viewer';
export type Need = 'view' | 'edit' | 'admin';

const RANK: Record<BrandRole, number> = { viewer: 1, editor: 2, brand_admin: 3 };
const NEED: Record<Need, number> = { view: 1, edit: 2, admin: 3 };

export interface Access {
  user: SessionUser;
  platformAdmin: boolean;
  brands: Record<string, BrandRole>;
}

export async function accessFor(user: SessionUser): Promise<Access> {
  const r = await q('select brand_id, role from memberships where user_id = $1', [user.id]);
  const brands: Record<string, BrandRole> = {};
  for (const row of r.rows) brands[row.brand_id] = row.role;
  return { user, platformAdmin: !!user.platform_admin, brands };
}

export function can(a: Access, brandId: string | null | undefined, need: Need): boolean {
  if (a.platformAdmin) return true;
  if (!brandId) return false;
  const role = a.brands[brandId];
  return !!role && RANK[role] >= NEED[need];
}

/** Brands this person can at least see — the filter for every list. */
export function visibleBrands(a: Access): string[] | 'all' {
  return a.platformAdmin ? 'all' : Object.keys(a.brands);
}

export const forbidden = (msg = 'You do not have access to this.') =>
  NextResponse.json({ error: msg }, { status: 403 });

/**
 * The common opening of a protected route: a signed-in person and what they
 * may touch, or the response to send instead.
 */
export async function signedIn(): Promise<Access | Response> {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  return accessFor(me);
}

/** The brand a deck belongs to, or null when there is no such deck. */
export async function deckBrand(presentationId: string): Promise<string | null | undefined> {
  const r = await q('select coalesce(brand_id, brand) as b from presentations where id = $1', [presentationId]);
  return r.rows[0] ? r.rows[0].b : undefined;
}

/**
 * For routes about one deck: a response to send if this person may not touch
 * it at the level asked, or null to carry on. Missing and forbidden look alike.
 */
export async function deckGuard(a: Access, presentationId: string, need: Need): Promise<Response | null> {
  const b = await deckBrand(presentationId);
  if (b === undefined || !can(a, b, need)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return null;
}

/** Writes one line to the audit log. Never fails the request it describes. */
export async function audit(actor: string | null, action: string, target: string | null, detail: object = {}) {
  try {
    await q('insert into audit_events (actor_id, action, target, detail, at) values ($1,$2,$3,$4,$5)', [
      actor,
      action,
      target,
      JSON.stringify(detail),
      Date.now(),
    ]);
  } catch (e) {
    console.error('audit write failed', e);
  }
}
