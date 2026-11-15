import { describe, expect, it, vi } from 'vitest';
import type { LlmConfig } from '../crisis/llm/config';
import {
  buildDiaryTranslationMessages,
  buildDiaryTranslationSchema,
  createLlmDiaryTranslator,
  DIARY_TRANSLATION_TEMPERATURE,
} from './llm';

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

describe('diary translator (LLM)', () => {
  it('asks for exactly one text per line', () => {
    const schema = buildDiaryTranslationSchema(3);
    expect(schema.properties.texts.minItems).toBe(3);
    expect(schema.properties.texts.maxItems).toBe(3);
  });

  it('puts the fixed terms in the prompt and the lines in the user message', () => {
    const [system, user] = buildDiaryTranslationMessages(['The wick tips look dry.']);
    expect(system.content).toContain('상추');
    expect(system.content).toContain('식물 필로우');
    expect(user.content).toContain('The wick tips look dry.');
  });

  it('calls the model with a low temperature and returns the texts list', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.options.temperature).toBe(DIARY_TRANSLATION_TEMPERATURE);
      return Response.json({ message: { content: JSON.stringify({ texts: ['심지 끝이 말라 보인다.'] }) } });
    });
    const translate = createLlmDiaryTranslator(config, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(await translate(['The wick tips look dry.'], new AbortController().signal)).toEqual(['심지 끝이 말라 보인다.']);
  });
});
