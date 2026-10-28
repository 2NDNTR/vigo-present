import { signedIn } from '@/lib/server/access';

export const dynamic = 'force-dynamic';

/**
 * Serves a library picture from V2's own address, so the editor can draw it
 * into an off-screen render (the assistant's second look). Browsers refuse to
 * read pixels from another site's image into a canvas; from the same site they
 * allow it. Only the media hosts the library uses are served, and only to
 * people who are signed in.
 */
const ALLOWED = (host: string) => host.endsWith('.public.blob.vercel-storage.com') || host === 'vigopresents.com';

export async function GET(req: Request) {
  const a = await signedIn();
  if (a instanceof Response) return a;
  const u = new URL(req.url).searchParams.get('u') || '';
  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return new Response('Bad address', { status: 400 });
  }
  if (target.protocol !== 'https:' || !ALLOWED(target.host)) return new Response('Not allowed', { status: 403 });
  const r = await fetch(target, { cache: 'force-cache' });
  if (!r.ok || !r.body) return new Response('Not found', { status: 404 });
  const type = r.headers.get('content-type') || 'application/octet-stream';
  if (!/^(image|video)\//.test(type)) return new Response('Not media', { status: 415 });
  return new Response(r.body, { headers: { 'content-type': type, 'cache-control': 'private, max-age=3600' } });
}
