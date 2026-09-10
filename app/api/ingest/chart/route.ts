import { NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/server/auth';
import { CHART_PROMPT, CHART_SCHEMA, validate, toPage } from '@/lib/ingest/chart';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const API = 'https://api.anthropic.com/v1';
const VERSION = '2023-06-01';

/**
 * READ A CHART FROM A SCREENSHOT
 * ---------------------------------------------------------------------------
 * The key lives in the environment and never leaves the server — the browser
 * sends an image and gets back data, so the deck can be authored from a laptop
 * without a key on it.
 *
 * The model is pinned by env when someone wants a specific one, and otherwise
 * discovered at run time. Hard-coding a model id means the day that id is
 * retired, an internal tool quietly 404s and nobody knows why; asking the API
 * what exists costs one cached call and outlives the naming.
 */

let cachedModel: { id: string; at: number } | null = null;

async function pickModel(key: string): Promise<string> {
  const pinned = process.env.ANTHROPIC_MODEL;
  if (pinned) return pinned;
  if (cachedModel && Date.now() - cachedModel.at < 12 * 60 * 60 * 1000) return cachedModel.id;

  try {
    const r = await fetch(API + '/models?limit=40', {
      headers: { 'x-api-key': key, 'anthropic-version': VERSION },
    });
    if (r.ok) {
      const j = await r.json();
      const ids: string[] = (j.data || []).map((m: { id: string }) => m.id);
      /* Sonnet is the working choice for this job: it reads a dense Nielsen
       * table reliably and costs a fraction of the largest model, which
       * matters when a review is twenty-one screenshots. Opus if there is no
       * Sonnet, and whatever is listed first if the naming has moved on. */
      const id =
        ids.find((m) => m.includes('sonnet')) || ids.find((m) => m.includes('opus')) || ids[0];
      if (id) {
        cachedModel = { id, at: Date.now() };
        return id;
      }
    }
  } catch {
    /* fall through to the default below */
  }
  return 'claude-sonnet-4-5';
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'The screenshot reader is not configured. Add ANTHROPIC_API_KEY in the Vercel project settings.' },
      { status: 501 }
    );
  }

  const body = await req.json().catch(() => null);
  const image: string | undefined = body?.image;
  if (!image || !image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Send an image.' }, { status: 400 });
  }

  const m = /^data:(image\/(png|jpeg|webp|gif));base64,(.+)$/s.exec(image);
  if (!m) return NextResponse.json({ error: 'Use a PNG, JPEG or WebP screenshot.' }, { status: 400 });
  const [, mediaType, , b64] = m;

  /* ~5MB of base64 is about 3.7MB of image, which is a generous full-page
   * screenshot. Refusing here beats a timeout the user cannot interpret. */
  if (b64.length > 5_000_000) {
    return NextResponse.json({ error: 'That screenshot is very large — crop it to the chart and try again.' }, { status: 413 });
  }

  const model = await pickModel(key);

  let res: Response;
  try {
    res = await fetch(API + '/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: CHART_PROMPT,
        tools: [
          {
            name: 'chart_data',
            description: 'Return the chart in the image as structured data.',
            input_schema: CHART_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: 'chart_data' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
              {
                type: 'text',
                text: body?.note
                  ? 'Read this chart. Context from the person who sent it: ' + String(body.note).slice(0, 400)
                  : 'Read this chart.',
              },
            ],
          },
        ],
      }),
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach the reader. Try again.' }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    /* The two failures worth naming, because they need different people to fix
     * them: a bad key is an admin problem, a rate limit is a wait. */
    const status = res.status;
    const msg =
      status === 401 || status === 403
        ? 'The API key was rejected. Check ANTHROPIC_API_KEY in the Vercel project settings.'
        : status === 429
          ? 'The reader is rate limited right now — try again in a moment.'
          : 'The reader could not process that image.';
    console.error('[ingest/chart]', status, detail.slice(0, 400));
    return NextResponse.json({ error: msg }, { status: status === 429 ? 429 : 502 });
  }

  const j = await res.json();
  const block = (j.content || []).find((c: { type: string }) => c.type === 'tool_use');
  if (!block) return NextResponse.json({ error: 'Nothing readable came back from that image.' }, { status: 422 });

  const checked = validate(block.input || {});
  if ('error' in checked) return NextResponse.json({ error: checked.error }, { status: 422 });

  return NextResponse.json({ page: toPage(checked), read: checked, model });
}
