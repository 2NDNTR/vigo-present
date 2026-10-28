import { NextResponse } from 'next/server';
import { can, deckBrand, signedIn } from '@/lib/server/access';
import { hasDatabase, q } from '@/lib/server/db';
import { runAgent, type LibraryPhoto } from '@/lib/server/agent';
import { layoutsForModel } from '@/lib/ingest/sidekick';
import type { Presentation } from '@/lib/model/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ANTHROPIC_BASE_URL lets a local test point the agent at a stand-in server
const API = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com') + '/v1';
const VERSION = '2023-06-01';

let cachedModel: { id: string; at: number } | null = null;
async function pickModel(key: string): Promise<string> {
  if (process.env.ANTHROPIC_MODEL) return process.env.ANTHROPIC_MODEL;
  if (cachedModel && Date.now() - cachedModel.at < 12 * 60 * 60 * 1000) return cachedModel.id;
  try {
    const r = await fetch(API + '/models?limit=40', { headers: { 'x-api-key': key, 'anthropic-version': VERSION } });
    if (r.ok) {
      const ids: string[] = ((await r.json()).data || []).map((m: { id: string }) => m.id);
      const id = ids.find((m) => m.includes('sonnet')) || ids.find((m) => m.includes('opus')) || ids[0];
      if (id) {
        cachedModel = { id, at: Date.now() };
        return id;
      }
    }
  } catch {
    /* fall through */
  }
  return 'claude-sonnet-4-5';
}

const IMG = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

/**
 * The assistant. The response is a stream of JSON lines so the editor can show
 * each step as it happens:
 *   {"type":"step","text":"Reading “Publix Q3”"}
 *   {"type":"done","reply":…,"pages":[…],"lines":[…],"skipped":0,"focus":…,"placed":["att1"]}
 *   {"type":"error","error":…}
 * Nothing is saved here. The editor applies the finished pages through its
 * normal versioned save.
 */
export async function POST(req: Request) {
  const a = await signedIn();
  if (a instanceof Response) return a;

  const body = await req.json().catch(() => null);
  const deck = body?.presentation as Presentation | undefined;
  const request = String(body?.request || '').trim().slice(0, 3000);
  if (!deck?.id || !Array.isArray(deck.pages) || (!request && !body?.images?.length)) {
    return NextResponse.json({ error: 'Say what you would like changed.' }, { status: 400 });
  }
  // edit rights on the deck as stored (if it exists yet) and on the brand it is in now
  const stored = hasDatabase() ? await deckBrand(deck.id) : undefined;
  if ((stored !== undefined && !can(a, stored, 'edit')) || !can(a, deck.brand, 'edit')) {
    return NextResponse.json({ error: 'You cannot edit this presentation.' }, { status: 403 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: 'The assistant is not set up. Add ANTHROPIC_API_KEY in Vercel.' }, { status: 501 });

  const images: { id: string; media: string; data: string }[] = [];
  for (const im of Array.isArray(body?.images) ? body.images.slice(0, 4) : []) {
    const m = IMG.exec(String(im?.dataUrl || ''));
    if (m && m[2].length < 7_000_000) images.push({ id: 'att' + (images.length + 1), media: m[1], data: m[2] });
  }

  // the review pass: the editor's renders of the pages just changed (looked at, never placed)
  const shots: { pageId: string; media: string; data: string }[] = [];
  for (const sh of Array.isArray(body?.shots) ? body.shots.slice(0, 8) : []) {
    const m = IMG.exec(String(sh?.dataUrl || ''));
    if (m && m[2].length < 3_000_000 && typeof sh?.pageId === 'string') shots.push({ pageId: sh.pageId, media: m[1], data: m[2] });
  }

  // earlier turns, words only, alternating and starting with the person
  const history: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const t of Array.isArray(body?.history) ? body.history.slice(-10) : []) {
    const text = String(t?.text || '').slice(0, 1500);
    if (!text) continue;
    const role = t?.role === 'ai' ? 'assistant' : 'user';
    if (history.length && history[history.length - 1].role === role) history[history.length - 1].content += '\n' + text;
    else history.push({ role, content: text });
  }
  while (history.length && history[0].role !== 'user') history.shift();
  if (history.length && history[history.length - 1].role === 'user') history.pop();

  const photos: LibraryPhoto[] = (Array.isArray(body?.photos) ? body.photos.slice(0, 600) : [])
    .filter((p: any) => p && typeof p.id === 'string' && typeof p.url === 'string' && /^(https:|\/)/.test(p.url))
    .map((p: any) => ({
      id: p.id.slice(0, 160),
      name: String(p.name || p.id).slice(0, 120),
      category: String(p.category || '').slice(0, 40),
      url: p.url.slice(0, 600),
      width: Number(p.width) || undefined,
      height: Number(p.height) || undefined,
    }));

  let jobId: string | null = null;
  if (hasDatabase()) {
    jobId = 'job_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    await q(
      `insert into generation_jobs (id, brand_id, user_id, kind, stage, brief, presentation_id, created_at, updated_at)
       values ($1, $2, $3, 'assist', 'composing', $4, $5, $6, $6)`,
      [jobId, deck.brand, a.user.id, JSON.stringify({ request: request.slice(0, 2000), images: images.length }), deck.id, Date.now()]
    ).catch(() => (jobId = null));
  }
  const model = await pickModel(key);
  const finish = (stage: string, extra: { error?: string; usage?: any } = {}) =>
    jobId
      ? q(
          `update generation_jobs set stage=$2, error=$3, model=$4, input_tokens=$5, output_tokens=$6, updated_at=$7 where id=$1`,
          [jobId, stage, extra.error || null, model, extra.usage?.input_tokens || 0, extra.usage?.output_tokens || 0, Date.now()]
        ).catch(() => {})
      : Promise.resolve();

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
      const send = (o: object) => ctl.enqueue(enc.encode(JSON.stringify(o) + '\n'));
      try {
        const out = await runAgent(
          {
            access: a,
            deck,
            openPageId: String(body?.openPageId || ''),
            request,
            history,
            images,
            shots,
            photos,
            layouts: layoutsForModel(),
            apiKey: key,
            model,
          },
          (text) => send({ type: 'step', text })
        );
        await finish('done', { usage: out.usage });
        send({
          type: 'done',
          reply: out.reply,
          pages: out.deck.pages,
          lines: out.lines,
          skipped: out.skipped,
          reasons: out.reasons,
          focus: out.focus,
          placed: out.placed,
        });
      } catch (e: any) {
        await finish('failed', { error: String(e?.status || e?.message || 'error').slice(0, 200) });
        send({ type: 'error', error: e?.message || 'The assistant could not finish. Your deck is unchanged.' });
      } finally {
        ctl.close();
      }
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  });
}
