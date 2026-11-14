import { crisisRequestSchema, REQUEST_BODY_MAX_BYTES } from '@/lib/contract/schemas';
import type { ApiError } from '@/lib/contract/types';
import {
  createCrisis,
  InvalidRequestError,
  NoCandidateError,
  type CrisisGenerator,
} from '@/lib/crisis';

/**
 * The text generator for crises. None is connected yet, so every crisis is a
 * pre-made one (implementation notes, entry 22).
 *
 * GENERATOR HOOK: assign a `CrisisGenerator` here to enable generated crises.
 * Keep secrets on the server: read them inside the generator, not in the client.
 */
const generator: CrisisGenerator | undefined = undefined;

// Responses are per request and contain the hidden verdicts, so no layer may store them.
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

/**
 * POST /api/crisis: return a validated crisis for the plant state in the body.
 * 200 CrisisResponse, 400 bad_request, 422 no_candidate, 500 internal.
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

  const parsed = crisisRequestSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return errorResponse(400, 'bad_request', `Request does not match the crisis request format. ${detail}`);
  }

  try {
    const crisis = await createCrisis(parsed.data, { generator });
    return Response.json(crisis, { status: 200, headers: NO_STORE });
  } catch (error) {
    if (error instanceof InvalidRequestError) {
      return errorResponse(400, 'bad_request', 'Request refers to an unknown crisis or action.');
    }
    if (error instanceof NoCandidateError) {
      return errorResponse(422, 'no_candidate', error.message);
    }
    // Details stay in the server log; the client gets a generic message.
    console.error('POST /api/crisis failed', error);
    return errorResponse(500, 'internal', 'The crisis could not be created.');
  }
}

function errorResponse(status: number, code: ApiError['error']['code'], message: string): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status, headers: NO_STORE });
}

/**
 * The body as text, or null when it is larger than `limit` bytes. The bytes
 * are counted while reading, because the content-length header may be missing
 * or wrong; the header is only used to refuse an announced oversized body early.
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
