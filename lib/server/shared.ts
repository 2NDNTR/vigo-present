import 'server-only';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { q } from './db';
import { currentUser } from './auth';
import { accessFor, can } from './access';

/**
 * WHAT A SHARED LINK HANDS OUT
 * ---------------------------------------------------------------------------
 * A recipient gets one page that draws the deck, and nothing else. So the
 * server decides here — never the browser — whether this person may see it,
 * and then sends only what the page draws: no speaker notes, no author ids,
 * no share settings, no asset ids that could be used to go looking in the
 * library. Pictures arrive as plain URLs, already resolved.
 *
 *   public    anyone with the link
 *   password  the link plus the password, checked here, remembered by a
 *             signed cookie for this one link
 *   private   signed-in members who can see the deck's brand
 */

export type SharedResult =
  | { state: 'ok'; deck: PublicDeck; access: 'public' | 'password' | 'private' }
  | { state: 'password' }
  | { state: 'missing' };

export interface PublicDeck {
  title: string;
  brand: string;
  retailer?: unknown;
  layout: 'vertical' | 'horizontal';
  pages: unknown[];
  cover?: string;
}

const UNLOCK_HOURS = 12;
const secret = () => process.env.AUTH_SECRET || '';

interface LinkRow {
  link_id: string;
  access: 'public' | 'password' | 'private';
  password_hash: string | null;
  layout: 'vertical' | 'horizontal';
  brand: string;
  doc: any;
}

async function findLink(slug: string): Promise<LinkRow | null> {
  if (!slug || slug.length > 120) return null;
  const r = await q(
    `select s.id as link_id, s.access, s.password_hash, s.layout,
            coalesce(p.brand_id, p.brand) as brand, p.doc
     from share_links s join presentations p on p.id = s.presentation_id
     where s.slug = $1 and s.revoked_at is null
       and p.status = 'published' and p.archived_at is null`,
    [slug]
  );
  return r.rows[0] || null;
}

export async function loadShared(slug: string): Promise<SharedResult> {
  const link = await findLink(slug);
  if (!link) return { state: 'missing' };

  if (link.access === 'private') {
    const me = await currentUser();
    // Not signed in, or signed in without the brand: the same answer as a link
    // that never existed, so a private link reveals nothing about itself.
    if (!me || !can(await accessFor(me), link.brand, 'view')) return { state: 'missing' };
  }

  if (link.access === 'password') {
    // A password link with no password set is closed, never open.
    if (!link.password_hash) return { state: 'missing' };
    const jar = await cookies();
    if (!readUnlock(jar.get(cookieName(link.link_id))?.value, link.link_id)) return { state: 'password' };
  }

  return { state: 'ok', access: link.access, deck: await toPublic(link) };
}

/** Checks a password and, if right, remembers it for this link only. */
export async function unlock(slug: string, password: string): Promise<boolean> {
  const link = await findLink(slug);
  if (!link || link.access !== 'password' || !link.password_hash) return false;
  const { verifyPassword } = await import('./passwords');
  if (!verifyPassword(password, link.password_hash)) return false;
  const jar = await cookies();
  jar.set(cookieName(link.link_id), makeUnlock(link.link_id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: UNLOCK_HOURS * 3600,
  });
  return true;
}

/* -------------------------------------------------------------- shaping */

const PAGE_FIELDS = ['id', 'templateId', 'headline', 'showLogo', 'brandOverride', 'background', 'slots'] as const;

async function toPublic(link: LinkRow): Promise<PublicDeck> {
  const doc = link.doc || {};
  const pages = (Array.isArray(doc.pages) ? doc.pages : []).map((p: any) => {
    const out: Record<string, unknown> = {};
    for (const k of PAGE_FIELDS) if (p[k] !== undefined) out[k] = p[k];
    return out;
  });

  // Resolve every asset id to its URL here, then drop the id.
  const ids = new Set<string>();
  walkMedia(pages, (m) => {
    if (typeof m.assetId === 'string') ids.add(m.assetId);
  });
  const urls = new Map<string, string>();
  if (ids.size) {
    const r = await q('select id, url from assets where id = any($1)', [[...ids]]);
    for (const row of r.rows) urls.set(row.id, row.url);
  }
  walkMedia(pages, (m) => {
    if (typeof m.assetId === 'string') {
      const u = urls.get(m.assetId);
      if (u) m.url = u;
      delete m.assetId;
    }
    if (typeof m.url === 'string' && m.url.startsWith('blob:')) delete m.url;
  });

  const first: any = pages[0];
  const cover = first?.background?.media?.url;
  return {
    title: String(doc.title || 'Presentation'),
    brand: String(doc.brand || link.brand),
    retailer: doc.retailer,
    layout: link.layout,
    pages,
    cover: typeof cover === 'string' && /^https?:/.test(cover) ? cover : undefined,
  };
}

/** Visits every `media` object anywhere in the pages, in place. */
function walkMedia(node: unknown, fn: (m: Record<string, any>) => void): void {
  if (Array.isArray(node)) {
    for (const n of node) walkMedia(n, fn);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === 'media' && v && typeof v === 'object') fn(v as Record<string, any>);
    walkMedia(v, fn);
  }
}

/* -------------------------------------------------------------- cookies */

const cookieName = (linkId: string) => 'vp_unlock_' + linkId.replace(/[^A-Za-z0-9_]/g, '').slice(0, 40);

function sign(v: string) {
  return crypto.createHmac('sha256', secret()).update('unlock:' + v).digest('base64url');
}
function makeUnlock(linkId: string) {
  const body = `${linkId}.${Date.now() + UNLOCK_HOURS * 3_600_000}`;
  return `${body}.${sign(body)}`;
}
function readUnlock(token: string | undefined, linkId: string): boolean {
  if (!token || !secret()) return false;
  const i = token.lastIndexOf('.');
  const body = token.slice(0, i);
  const mac = token.slice(i + 1);
  const expected = sign(body);
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
  const [id, exp] = [body.slice(0, body.lastIndexOf('.')), body.slice(body.lastIndexOf('.') + 1)];
  return id === linkId && Number(exp) > Date.now();
}
