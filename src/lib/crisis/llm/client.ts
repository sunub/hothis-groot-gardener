import type { LlmConfig } from './config';
import type { ChatMessage } from './prompt';

/**
 * One chat call that must return JSON matching `schema`.
 * - ollama: POST {baseUrl}/api/chat with `format` (constrained decoding),
 *   `think` and `options.num_ctx`.
 * - openai: POST {baseUrl}/chat/completions with `response_format`
 *   json_schema (vLLM, LM Studio and other OpenAI-compatible servers).
 * Returns the parsed JSON; throws on HTTP errors and on text that is not JSON.
 */
export async function chatJson(
  config: LlmConfig,
  messages: ChatMessage[],
  schema: object,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  let url: string;
  let body: Record<string, unknown>;
  if (config.provider === 'ollama') {
    url = `${config.baseUrl}/api/chat`;
    body = {
      model: config.model,
      messages,
      stream: false,
      format: schema,
      options: { temperature: config.temperature, num_ctx: config.numCtx },
    };
    if (config.think !== undefined) body.think = config.think;
    if (config.keepAlive !== undefined) body.keep_alive = config.keepAlive;
  } else {
    url = `${config.baseUrl}/chat/completions`;
    body = {
      model: config.model,
      messages,
      temperature: config.temperature,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'crisis_text', schema, strict: true },
      },
    };
  }

  const res = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Model server answered ${res.status}: ${detail}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  const content = config.provider === 'ollama' ? ollamaContent(json) : openAiContent(json);
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Model reply has no text content.');
  }
  return parseJsonText(content);
}

function ollamaContent(json: Record<string, unknown>): unknown {
  const message = json.message as { content?: unknown } | undefined;
  return message?.content;
}

function openAiContent(json: Record<string, unknown>): unknown {
  const choices = json.choices as { message?: { content?: unknown } }[] | undefined;
  return choices?.[0]?.message?.content;
}

/** Parse the reply. Tolerates a ```json fence around the object. */
export function parseJsonText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const raw = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Model reply is not valid JSON: ${raw.slice(0, 200)}`);
  }
}
