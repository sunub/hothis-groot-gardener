import { describe, expect, it } from 'vitest';
import { evidence } from '@/lib/evidence';
import { localizeEvidence } from '@/lib/evidence/localize';
import { findCrisis } from '@/lib/evidence/select';
import { getFallbackCrisis } from '../fallback';
import { applyTranslation, buildGlossary, textsOf } from '../translate';
import type { LlmConfig } from './config';
import {
  buildTranslationMessages,
  buildTranslationSchema,
  createLlmTranslator,
  TRANSLATION_TEMPERATURE,
} from './translator';

const config: LlmConfig = {
  provider: 'ollama',
  baseUrl: 'http://ollama.test',
  model: 'gemma4:e4b',
  timeoutMs: 30_000,
  temperature: 0.7,
  numCtx: 8192,
  think: false,
  ragTopN: 4,
  ragTimeoutMs: 1_000,
  repairs: 0,
};

const source = getFallbackCrisis('water_shortage', 1, 'en', [])!;
const korean = getFallbackCrisis('water_shortage', 1, 'ko', [])!;
const crisis = findCrisis(localizeEvidence(evidence, 'ko'), source.crisis_id)!;
const input = { source, glossary: buildGlossary(source, crisis) };

describe('translation prompt', () => {
  it('gives the English texts and the Korean glossary, and no ids', () => {
    const [system, user] = buildTranslationMessages(input);
    expect(system.role).toBe('system');
    expect(user.content).toContain(source.scene);
    expect(user.content).toContain(crisis.name);
    for (const clue of source.clues) expect(user.content).not.toContain(clue.symptom_id);
    for (const option of source.options) expect(user.content).not.toContain(option.action_id);
  });

  it('fixes the clue and option counts in the schema', () => {
    const schema = buildTranslationSchema(2, 3);
    expect(schema.properties.clues).toMatchObject({ minItems: 2, maxItems: 2 });
    expect(schema.properties.options).toMatchObject({ minItems: 3, maxItems: 3 });
  });
});

describe('createLlmTranslator', () => {
  it('asks the model once at a low temperature and returns the parsed texts', async () => {
    const calls: Record<string, unknown>[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ message: { content: JSON.stringify(textsOf(korean)) } }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const raw = await createLlmTranslator(config, { fetchImpl })(input, new AbortController().signal);
    expect(calls).toHaveLength(1);
    expect((calls[0].options as { temperature: number }).temperature).toBe(TRANSLATION_TEMPERATURE);
    expect(applyTranslation(source, raw).ok).toBe(true);
  });

  it('throws when the model server fails', async () => {
    const fetchImpl = (async () => new Response('down', { status: 500 })) as unknown as typeof fetch;
    await expect(
      createLlmTranslator(config, { fetchImpl })(input, new AbortController().signal),
    ).rejects.toThrow(/500/);
  });
});
