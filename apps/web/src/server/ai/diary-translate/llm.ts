import { chatJson } from '../crisis/llm/client';
import type { LlmConfig } from '../crisis/llm/config';
import type { ChatMessage } from '../crisis/llm/prompt';
import type { DiaryTranslator } from './translate';

/** Temperature for translation: close to the source, little room for new content. */
export const DIARY_TRANSLATION_TEMPERATURE = 0.2;

export const DIARY_TRANSLATION_SYSTEM_PROMPT = `You translate short diary lines from English to Korean for Space Garden Simulator, a training game about growing red romaine lettuce on the ISS. The lines are notes from real space-station plant experiments or what the crew saw in the grow chamber.
Translate only what is given. Do not add, drop or change any fact, number, place or action.

Rules:
1. Natural Korean in a plain written style for a diary ("~했다", "~보인다", "~했습니다" are fine; keep one style for all lines).
2. Keep the meaning and the length close to the English. Do not make a sentence longer than it is.
3. Fixed terms: lettuce = 상추 (never 양배추 or 양상추), plant pillow or seed pillow = 식물 필로우 (never 베개), wick = 심지, reservoir = 저수조, fan = 팬, sprout = 싹, seedling = 어린 싹. Translate every English word into Korean; leave no English word in the text. Keep numbers as they are. Do not translate "ISS".
4. Keep the order and the number of lines. Reply with JSON only, in the required format.`;

export function buildDiaryTranslationSchema(count: number) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['texts'],
    properties: {
      texts: { type: 'array', minItems: count, maxItems: count, items: { type: 'string' } },
    },
  } as const;
}

export function buildDiaryTranslationMessages(texts: readonly string[]): ChatMessage[] {
  return [
    { role: 'system', content: DIARY_TRANSLATION_SYSTEM_PROMPT },
    { role: 'user', content: `ENGLISH LINES (translate every line, keep the order):\n${JSON.stringify(texts)}` },
  ];
}

export interface DiaryLlmDeps {
  fetchImpl?: typeof fetch;
}

/** The translator for `translateDiaryTexts`, with the same model and connection as the crisis text. */
export function createLlmDiaryTranslator(config: LlmConfig, deps: DiaryLlmDeps = {}): DiaryTranslator {
  const { fetchImpl = fetch } = deps;
  return async (texts, signal) => {
    const raw = await chatJson(
      { ...config, temperature: DIARY_TRANSLATION_TEMPERATURE },
      buildDiaryTranslationMessages(texts),
      buildDiaryTranslationSchema(texts.length),
      signal,
      fetchImpl,
    );
    return (raw as { texts?: unknown }).texts;
  };
}
