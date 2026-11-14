import { eventCardRequestSchema, REQUEST_BODY_MAX_BYTES } from '@/lib/contract/schemas';
import type { ApiError } from '@/lib/contract/types';
import { readLlmConfig } from '@/lib/crisis/llm';
import { createEventCard, InvalidEventRequestError, type EventCardGenerator } from '@/lib/event-cards';
// Imported from its file, not the index: it pulls in server-only code that the index must not carry.
import { createEventCardLlmGenerator } from '@/lib/event-cards/llm-generator';

/**
 * The text generator for event cards, connected the same way as the crisis
 * route: on when LLM_MODEL is set (see .env.example). Without it every card
 * uses the pre-made text, as before.
 */
const llmConfig = readLlmConfig();
const generator: EventCardGenerator | undefined = llmConfig ? createEventCardLlmGenerator(llmConfig) : undefined;
const timeoutMs = llmConfig?.timeoutMs;

// Responses carry the hidden verdicts, so no layer may store them.
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

/**
 * POST /api/event: return the card for a scheduled or conditional timeline
 * event. 200 EventCardResponse, 400 bad_request, 500 internal.
 */
export async function POST(request: Request): Promise<Response> {
  let raw: string | null;
  try {
    raw = await readBodyText(request, REQUEST_BODY_MAX_BYTES);
  } catch {
    return errorResponse(400, 'bad_request', 'Request body could not be read.');
  }
  if (raw === null) {
    return errorResponse(400, 'bad_request', `Request body is larger than ${REQUEST_BODY_MAX_BYTES} bytes.`);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse(400, 'bad_request', 'Request body is not valid JSON.');
  }

  const parsed = eventCardRequestSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return errorResponse(400, 'bad_request', `Request does not match the event card request format. ${detail}`);
  }

  try {
    const card = await createEventCard(parsed.data, { generator, timeoutMs });
    return Response.json(card, { status: 200, headers: NO_STORE });
  } catch (error) {
    if (error instanceof InvalidEventRequestError) {
      return errorResponse(400, 'bad_request', 'Request refers to an event or action that cannot be shown.');
    }
    // Details stay in the server log; the client gets a generic message.
    console.error('POST /api/event failed', error);
    return errorResponse(500, 'internal', 'The event card could not be created.');
  }
}

function errorResponse(status: number, code: ApiError['error']['code'], message: string): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status, headers: NO_STORE });
}

/**
 * The body as text, or null when it is larger than `limit` bytes. Same as in
 * the crisis route, which a route file cannot export: the bytes are counted
 * while reading, because the content-length header may be missing or wrong.
 */
async function readBodyText(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      // Stop reading; the rest of the body is never buffered.
      void reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
