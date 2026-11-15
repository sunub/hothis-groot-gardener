import type { CrisisTranslator, CrisisTexts, TranslationInput } from '../translate';
import { textsOf } from '../translate';
import { chatJson } from './client';
import type { LlmConfig } from './config';
import type { ChatMessage } from './prompt';

/**
 * Korean translation of one validated English crisis text, with the same
 * model and connection as the generator. Only the text fields go in and come
 * out; the ids stay in the code (../translate.ts).
 */

/** Temperature for translation: close to the source, little room for new content. */
export const TRANSLATION_TEMPERATURE = 0.2;

export const TRANSLATION_SYSTEM_PROMPT = `You translate short game text from English to Korean for Space Garden Simulator, a training game about growing red romaine lettuce on the ISS.
Translate only what is given. Do not add, drop or change any fact, symptom, cause, action, number or hint.

Rules:
1. Natural Korean in the polite 해요체 ("~해요", "~있어요"). The lettuce speaks in the first person ("저", "제").
2. Keep the meaning and the length close to the English. Do not make a sentence longer than it is.
3. Use the Korean names from GLOSSARY for the crisis, the symptoms and the actions. An option label must name the same action as its glossary name, using the same key words.
4. Do not say a harvest is safe, passed, approved, certified or can be eaten. Do not call an option correct, wrong, best, recommended or a mistake.
5. Keep numbers as they are. Do not translate "ISS" or other acronyms.
6. Keep the order and the number of clues and options. Reply with JSON only, in the required format.`;

/** JSON schema of the reply: texts only, with the same counts as the source. */
export function buildTranslationSchema(clueCount: number, optionCount: number) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['scene', 'plant_line', 'clues', 'options'],
    properties: {
      scene: { type: 'string' },
      plant_line: { type: 'string' },
      clues: { type: 'array', minItems: clueCount, maxItems: clueCount, items: { type: 'string' } },
      options: {
        type: 'array',
        minItems: optionCount,
        maxItems: optionCount,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['label', 'result_line', 'why'],
          properties: {
            label: { type: 'string' },
            result_line: { type: 'string' },
            why: { type: 'string' },
          },
        },
      },
    },
  } as const;
}

export function buildTranslationMessages({ source, glossary }: TranslationInput): ChatMessage[] {
  const lines: string[] = [];
  lines.push(`GLOSSARY (Korean names from the game's evidence list):`);
  lines.push(`- crisis: ${glossary.crisis}`);
  glossary.symptoms.forEach((name, i) => lines.push(`- symptom of clue ${i + 1}: ${name}`));
  glossary.actions.forEach((name, i) => lines.push(`- action of option ${i + 1}: ${name}`));
  lines.push('');
  lines.push('ENGLISH TEXT (translate every field, keep the order):');
  lines.push(JSON.stringify(textsOf(source)));
  return [
    { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
    { role: 'user', content: lines.join('\n') },
  ];
}

export interface LlmTranslatorDeps {
  fetchImpl?: typeof fetch;
}

/** The translator for `createCrisis`. */
export function createLlmTranslator(config: LlmConfig, deps: LlmTranslatorDeps = {}): CrisisTranslator {
  const { fetchImpl = fetch } = deps;
  return async (input, signal): Promise<CrisisTexts> => {
    const schema = buildTranslationSchema(input.source.clues.length, input.source.options.length);
    const messages = buildTranslationMessages(input);
    const raw = await chatJson(
      { ...config, temperature: TRANSLATION_TEMPERATURE },
      messages,
      schema,
      signal,
      fetchImpl,
    );
    return raw as CrisisTexts;
  };
}
