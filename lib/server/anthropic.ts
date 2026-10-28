import 'server-only';

/**
 * A drop-in for fetch() on the Messages API that copes with models which do
 * not accept a forced tool_choice ({type:"tool"} or {type:"any"}). Newer models
 * reject those with a 400. When that happens the request is sent again with
 * tool_choice "auto" and a plain instruction to use the tool, and the model is
 * remembered so later calls skip the failed attempt.
 */
const noForced = new Set<string>();

export async function messagesFetch(url: string, init: RequestInit & { body: string }): Promise<Response> {
  const body = JSON.parse(init.body);
  const forced = body.tool_choice && (body.tool_choice.type === 'tool' || body.tool_choice.type === 'any');
  if (forced && noForced.has(body.model)) return fetch(url, { ...init, body: JSON.stringify(relax(body)) });

  const res = await fetch(url, init);
  if (!forced || res.status !== 400) return res;
  const text = await res.clone().text().catch(() => '');
  if (!/tool_choice/i.test(text)) return res;
  noForced.add(body.model);
  return fetch(url, { ...init, body: JSON.stringify(relax(body)) });
}

function relax(body: any) {
  const choice = body.tool_choice;
  const ask =
    choice.type === 'tool'
      ? `Answer only by calling the ${choice.name} tool.`
      : 'Act only by calling the tools.';
  // the instruction goes in the system prompt, never into the messages: changing an
  // earlier message would invalidate the model's signed reasoning on the next call
  const system =
    typeof body.system === 'string'
      ? body.system + '\n\n' + ask
      : Array.isArray(body.system)
        ? [...body.system, { type: 'text', text: ask }]
        : ask;
  return { ...body, tool_choice: { type: 'auto' }, system };
}
