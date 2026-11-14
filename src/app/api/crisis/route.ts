import { crisisRequestSchema } from '@/lib/contract/schemas';
import type { ApiError } from '@/lib/contract/types';
import { createCrisis, NoCandidateError, type CrisisGenerator } from '@/lib/crisis';

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
  let body: unknown;
  try {
    body = await request.json();
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
