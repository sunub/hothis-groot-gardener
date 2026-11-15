import { diaryTranslateRequestSchema, REQUEST_BODY_MAX_BYTES, type DiaryTranslateResponse } from '@/lib/contract/schemas';
import type { ApiError } from '@/lib/contract/types';
import { createLlmDiaryTranslator } from '@/server/ai/diary-translate/llm';
import { translateDiaryTexts, type DiaryTranslator } from '@/server/ai/diary-translate/translate';
import { readLlmConfig } from '@/server/ai/crisis/llm';

/**
 * Korean text for diary lines (experiment records and observation lines).
 * Connected when LLM_MODEL is set, like the crisis text. Without it every
 * entry is null and the screen keeps the English line.
 */
const llmConfig = readLlmConfig();
const translator: DiaryTranslator | undefined = llmConfig ? createLlmDiaryTranslator(llmConfig) : undefined;
const timeoutMs = llmConfig?.timeoutMs;
/** English -> Korean for the life of the server: the lines are fixed text and the same for every player. */
const cache = new Map<string, string>();

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

/** POST /api/diary-translate: 200 DiaryTranslateResponse, 400 bad_request. */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > REQUEST_BODY_MAX_BYTES) return errorResponse(400, 'Request body is too large.');
    body = JSON.parse(raw);
  } catch {
    return errorResponse(400, 'Request body is not valid JSON.');
  }
  const parsed = diaryTranslateRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, 'Request does not match the diary translation format.');

  const translations = await translateDiaryTexts(parsed.data.texts, { translator, timeoutMs, cache });
  const response: DiaryTranslateResponse = { translations };
  return Response.json(response, { status: 200, headers: NO_STORE });
}

function errorResponse(status: number, message: string): Response {
  const body: ApiError = { error: { code: 'bad_request', message } };
  return Response.json(body, { status, headers: NO_STORE });
}
