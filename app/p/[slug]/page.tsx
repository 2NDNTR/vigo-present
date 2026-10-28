import type { Metadata } from 'next';
import PublicClient from './PublicClient';
import { hasDatabase } from '@/lib/server/db';
import { loadShared, type SharedResult } from '@/lib/server/shared';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

/**
 * THE SHARED LINK
 * The server decides what this viewer may see before anything is sent, and
 * the page receives only the drawable deck. With no database (a local copy)
 * the client falls back to browser storage, as V1 did.
 */
async function load(slug: string): Promise<SharedResult | null> {
  if (!hasDatabase()) return null;
  try {
    return await loadShared(slug);
  } catch (e) {
    console.error('shared link failed', e);
    return { state: 'missing' };
  }
}

/** The tab and any link preview carry the deck's own name — not the tool's. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await load(slug);
  const base: Metadata = { robots: { index: false, follow: false }, description: null };
  if (r?.state !== 'ok') return { ...base, title: 'Presentation' };
  return {
    ...base,
    title: r.deck.title,
    openGraph: { title: r.deck.title, images: r.deck.cover ? [r.deck.cover] : [] },
    twitter: { card: r.deck.cover ? 'summary_large_image' : 'summary', title: r.deck.title },
  };
}

export default async function PublicPage({ params }: Props) {
  const { slug } = await params;
  return <PublicClient slug={slug} initial={await load(slug)} />;
}
