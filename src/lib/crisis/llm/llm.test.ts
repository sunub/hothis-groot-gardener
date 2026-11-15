import { describe, expect, it } from 'vitest';
import type { AiCrisisOutput, CrisisRequest, PlantState } from '@/lib/contract/types';
import { evidence } from '@/lib/evidence';
import { computeStage, selectCandidates } from '@/lib/evidence/select';
import { INITIAL_PLANT_STATE } from '@/lib/game/rules';
import { fallbackCrises, getFallbackCrisis } from '../fallback';
import { buildGenerationInput, type GenerationInput, type StagedCandidate } from '../generator';
import { createCrisis } from '../pipeline';
import { validateAiOutput } from '../validate';
import { chatJson, parseJsonText, warmUp } from './client';
import { readLlmConfig, type LlmConfig } from './config';
import { createLlmGenerator, GenerationRejectedError, shuffle, styleExample } from './generator';
import { checkCopying, checkStructure, checkWording } from './guard';
import { buildOutputSchema, buildUserPrompt } from './prompt';
import { buildRetrievalQuery } from './retrieval';
import { warmUpModel } from './warmup';

// --- helpers -------------------------------------------------------------------

function request(state: Partial<PlantState>, patch: Partial<Omit<CrisisRequest, 'state'>> = {}): CrisisRequest {
  return {
    locale: 'en',
    cultivation_day: 12,
    state: { ...INITIAL_PLANT_STATE, ...state },
    danger_days: { root_moisture: 1, humidity: 0 },
    history: [],
    active: null,
    ...patch,
  };
}

const dry = request({ root_moisture: 20 });
const wet = request({ root_moisture: 85 });

function staged(req: CrisisRequest): StagedCandidate[] {
  return selectCandidates(evidence, req.state, undefined).map(({ crisis }) => ({
    crisis,
    stage: computeStage(crisis, req.state, req.danger_days, 0),
  }));
}

function inputFor(req: CrisisRequest): { input: GenerationInput; candidates: StagedCandidate[] } {
  const candidates = staged(req);
  return { input: buildGenerationInput(req, candidates), candidates };
}

const baseConfig: LlmConfig = {
  provider: 'ollama',
  baseUrl: 'http://ollama.test',
  model: 'gemma4:e4b',
  timeoutMs: 30_000,
  temperature: 0.4,
  numCtx: 8192,
  think: false,
  ragTopN: 4,
  ragTimeoutMs: 1_000,
  repairs: 0,
};

/** A good water_shortage stage 1 text, as a model would return it. */
function goodWaterText(): AiCrisisOutput {
  return {
    crisis_id: 'water_shortage',
    scene: 'The young lettuce plants look smaller than they should at this point. The wicks at the base of the pillows look pale and dry.',
    plant_line: "I'm barely getting any bigger, and the wicks under me feel dry.",
    clues: [
      { symptom_id: 'poor_growth', text: 'The plants have hardly grown since the last check.' },
      { symptom_id: 'dry_wicks', text: 'The pillow wicks look dry.' },
    ],
    options: [
      { action_id: 'add_water_direct', label: 'Add water directly to the plant pillows', result_line: 'That reached my roots. I feel stronger.', why: 'Water added to the pillows reaches the roots without the reservoir.' },
      { action_id: 'refill_reservoir', label: 'Refill the reservoir under the pillows', result_line: 'A little helps, but not much.', why: 'The reservoir does not supply enough through the wicks.' },
      { action_id: 'wait_for_schedule', label: 'Wait for the next scheduled watering', result_line: 'Nothing changed. I feel weaker.', why: 'Waiting lets the roots keep drying.' },
      { action_id: 'fan_high', label: 'Set the fan to high', result_line: 'The moving air makes me feel worse.', why: 'The high fan setting dries moisture and makes the shortage worse.' },
    ],
  };
}

interface Call {
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

/** Fake fetch: answers the model URL and the search URL, and records every call. */
function fakeFetch(opts: {
  modelReplies: unknown[];
  rag?: 'ok' | 'down';
}) {
  const calls: Call[] = [];
  let modelCall = 0;
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    calls.push({ url, body, headers: (init?.headers ?? {}) as Record<string, string> });
    if (url.endsWith('/retrieve')) {
      if (opts.rag === 'down') throw new TypeError('fetch failed');
      return Response.json({
        query: body.query,
        mode: 'keyword',
        results: [
          {
            rank: 1,
            id: 'veg01-stall-a',
            section: 'VEG-01',
            subsection: 'Growth stall',
            text: 'VEG-01\nGrowth stall\n\nPhotos at 14 days showed stunted plants.',
            source_url: 'https://doi.org/10.1515/opag-2017-0003',
            source_location: '§2.1, p. 35',
            source_license: null,
          },
        ],
      });
    }
    const reply = opts.modelReplies[Math.min(modelCall, opts.modelReplies.length - 1)];
    modelCall++;
    if (reply instanceof Response) return reply;
    return Response.json({ message: { role: 'assistant', content: typeof reply === 'string' ? reply : JSON.stringify(reply) } });
  }) as typeof fetch;
  return { impl, calls };
}

const inOrder = () => 0.999; // shuffle keeps the order when random() is always close to 1

// --- config --------------------------------------------------------------------

describe('readLlmConfig', () => {
  it('is off without LLM_MODEL', () => {
    expect(readLlmConfig({})).toBeNull();
    expect(readLlmConfig({ LLM_MODEL: '  ' })).toBeNull();
  });

  it('uses Ollama defaults with thinking off', () => {
    const config = readLlmConfig({ LLM_MODEL: 'gemma4:e4b' })!;
    expect(config).toMatchObject({
      provider: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'gemma4:e4b',
      timeoutMs: 30_000,
      numCtx: 8192,
      think: false,
      keepAlive: '30m',
    });
    expect(config.ragUrl).toBeUndefined();
    expect(readLlmConfig({ LLM_MODEL: 'm', LLM_KEEP_ALIVE: 'omit' })!.keepAlive).toBeUndefined();
    // Digits only become a number: Ollama reads a string as a duration with a unit.
    expect(readLlmConfig({ LLM_MODEL: 'm', LLM_KEEP_ALIVE: '-1' })!.keepAlive).toBe(-1);
    expect(readLlmConfig({ LLM_MODEL: 'm', LLM_KEEP_ALIVE: '-1m' })!.keepAlive).toBe('-1m');
  });

  it('reads every setting and trims trailing slashes', () => {
    const config = readLlmConfig({
      LLM_PROVIDER: 'openai',
      LLM_BASE_URL: 'https://pod-8000.proxy.runpod.net/v1/',
      LLM_MODEL: 'google/gemma-4-e4b-it',
      LLM_API_KEY: 'k',
      LLM_TIMEOUT_MS: '45000',
      LLM_TEMPERATURE: '0.2',
      LLM_THINK: 'omit',
      RAG_URL: 'http://127.0.0.1:8000/',
      RAG_TOP_N: '3',
      LLM_LOG_DIR: 'logs',
    })!;
    expect(config).toMatchObject({
      provider: 'openai',
      baseUrl: 'https://pod-8000.proxy.runpod.net/v1',
      apiKey: 'k',
      timeoutMs: 45_000,
      temperature: 0.2,
      think: undefined,
      ragUrl: 'http://127.0.0.1:8000',
      ragTopN: 3,
      logDir: 'logs',
    });
  });

  it('rejects bad values with a clear message', () => {
    expect(() => readLlmConfig({ LLM_MODEL: 'm', LLM_PROVIDER: 'other' })).toThrow(/LLM_PROVIDER/);
    expect(() => readLlmConfig({ LLM_MODEL: 'm', LLM_PROVIDER: 'openai' })).toThrow(/LLM_BASE_URL/);
    expect(() => readLlmConfig({ LLM_MODEL: 'm', LLM_TIMEOUT_MS: '-1' })).toThrow(/LLM_TIMEOUT_MS/);
    expect(() => readLlmConfig({ LLM_MODEL: 'm', LLM_TEMPERATURE: '3' })).toThrow(/LLM_TEMPERATURE/);
  });
});

// --- prompt and schema ---------------------------------------------------------

describe('prompt and output schema', () => {
  it('limits ids to the candidate in the schema', () => {
    const { input } = inputFor(dry);
    const candidate = input.candidates[0];
    const schema = buildOutputSchema(candidate, input.limits.clues_max);
    expect(schema.properties.crisis_id.enum).toEqual(['water_shortage']);
    expect(schema.properties.clues.items.properties.symptom_id.enum).toEqual(
      candidate.symptoms.map((s) => s.symptom_id),
    );
    expect(schema.properties.options.items.properties.action_id.enum).toEqual(
      candidate.actions.map((a) => a.action_id),
    );
    expect(schema.properties.options.minItems).toBe(Math.min(3, candidate.actions.length));
  });

  it('puts the allowed symptoms, every action with its verdict, the example and the excerpts in the prompt', () => {
    const { input } = inputFor(dry);
    const candidate = input.candidates[0];
    const prompt = buildUserPrompt({
      input,
      candidate,
      excerpts: [{ id: 'x', subsection: 'Growth stall', text: 'Plants were stunted.', source_url: 'u', source_location: 'p', source_license: null }],
      example: styleExample(candidate),
    });
    for (const s of candidate.symptoms) expect(prompt).toContain(`${s.symptom_id}: ${s.name}`);
    for (const a of candidate.actions) expect(prompt).toContain(`${a.action_id}: ${a.name} | verdict: ${a.verdict}`);
    expect(prompt).toContain('STYLE EXAMPLE');
    // Option text is left out of the example: the model copied it word for word.
    const premade = getFallbackCrisis('water_shortage', 1, 'en', [])!;
    expect(prompt).toContain(premade.scene);
    for (const option of premade.options) expect(prompt).not.toContain(option.result_line);
    expect(prompt).toContain('[1] Growth stall: Plants were stunted.');
    expect(prompt).toContain('root moisture is far too low');
  });

  it('builds an English search query from the crisis', () => {
    const { input } = inputFor(dry);
    const query = buildRetrievalQuery(input.candidates[0]);
    expect(query).toContain('Water shortage');
    expect(query).toContain('Dry pillow wicks');
    expect(query).toContain('Add water directly to the plant pillows');
  });
});

// --- wording guard -------------------------------------------------------------

describe('checkWording', () => {
  it('passes every reviewed pre-made crisis', () => {
    for (const entry of fallbackCrises.crises) {
      const req = entry.output.crisis_id === 'water_shortage' ? dry : wet;
      const candidates = staged(req).map((c) => ({ ...c, stage: entry.stage }));
      const input = buildGenerationInput(req, candidates);
      const candidate = input.candidates.find((c) => c.crisis_id === entry.output.crisis_id)!;
      expect(checkWording(entry.output, candidate), `${entry.output.crisis_id} stage ${entry.stage}`).toEqual([]);
    }
  });

  it('catches a symptom that is not allowed', () => {
    const { input } = inputFor(dry);
    const text = { ...goodWaterText(), scene: 'The lettuce is wilting badly. The wicks look dry.' };
    expect(checkWording(text, input.candidates[0]).join(' ')).toMatch(/wilting/);
  });

  it('allows fungus words only from the stage where fungal growth is a symptom', () => {
    const { input } = inputFor(wet);
    const stage1 = input.candidates[0];
    const stage2 = { ...stage1, stage: 2, symptoms: evidence.crises[1].symptoms.filter((s) => s.stage <= 2).map((s) => ({ symptom_id: s.symptom_id, name: s.name, stage: s.stage })) };
    const out = { ...getFallbackCrisis('overwater_mold', 1, 'en', [])!, scene: 'White mold covers the stems. Droplets sit on the leaves.' };
    expect(checkWording(out, stage1).join(' ')).toMatch(/mold/);
    expect(checkWording(out, stage2).filter((i) => i.includes('mold'))).toEqual([]);
  });

  it('catches a scene that names the fan setting (seen in a real Gemma run)', () => {
    const { input } = inputFor(dry);
    const text = {
      ...goodWaterText(),
      scene: 'The lettuce plants are not showing expected growth. The wicks appear dry. The fan remains on a low setting.',
    };
    expect(checkWording(text, input.candidates[0]).join(' ')).toMatch(/fan/);
  });

  it('catches "soil" (seen in a real Gemma run; Veggie uses a clay substrate)', () => {
    const { input } = inputFor(dry);
    const text = { ...goodWaterText(), plant_line: 'The soil around me feels dry.' };
    expect(checkWording(text, input.candidates[0]).join(' ')).toMatch(/soil/);
  });

  it('catches water behaving as under gravity (seen in a real Gemma run)', () => {
    const { input } = inputFor(wet);
    const out = { ...getFallbackCrisis('overwater_mold', 1, 'en', [])!, scene: 'Excess moisture is pooling around the base of the plants. Drops sit on the leaves.' };
    const line = { ...out, scene: getFallbackCrisis('overwater_mold', 1, 'en', [])!.scene, plant_line: 'My leaves are dripping.' };
    expect(checkWording(out, input.candidates[0]).join(' ')).toMatch(/pooling.*microgravity/);
    expect(checkWording(line, input.candidates[0]).join(' ')).toMatch(/dripping/);
  });

  it('catches what the third logged run let through: "lack turgidity" and "dehydration" in the scene', () => {
    const { input } = inputFor(dry);
    const text = {
      ...goodWaterText(),
      scene: 'The overall appearance of the unit suggests the plants are struggling with dehydration.',
      clues: [
        { symptom_id: 'poor_growth', text: 'Plant growth has significantly slowed down.' },
        { symptom_id: 'dry_wicks', text: 'The plants appear distressed and lack turgidity.' },
      ],
    };
    const issues = checkWording(text, input.candidates[0]).join(' ');
    expect(issues).toMatch(/turgidity.*wilting/);
    expect(issues).toMatch(/scene: "dehydration" names the cause/);
  });

  it('catches short and repeated result lines (third logged run: "I feel worse." twice)', () => {
    const { input } = inputFor(dry);
    const text = goodWaterText();
    text.options[2] = { ...text.options[2], result_line: 'I feel worse.' };
    text.options[3] = { ...text.options[3], result_line: 'I feel worse.' };
    expect(checkWording(text, input.candidates[0]).join(' ')).toMatch(/too short/);
    expect(checkStructure(text, input.candidates[0]).join(' ')).toMatch(/two result_line texts are the same/);
  });

  it('lists the banned words for this stage in the prompt', () => {
    const { input } = inputFor(dry);
    const prompt = buildUserPrompt({ input, candidate: input.candidates[0], excerpts: [] });
    expect(prompt).toMatch(/DO NOT USE these words in the scene, plant line, clues or result lines:[^\n]*wilting[^\n]*turgidity/);
    expect(prompt).toMatch(/ALSO DO NOT USE these words in the scene, plant line or clues:[^\n]*dehydrated/);
    expect(prompt).not.toMatch(/result lines:[^\n]*dehydrated/);
  });

  it('catches structure problems so the model can fix them', () => {
    const { input } = inputFor(dry);
    const text = goodWaterText();
    text.options = [text.options[1], text.options[1], text.options[2]];
    const issues = checkStructure(text, input.candidates[0]).join(' ');
    expect(issues).toMatch(/refill_reservoir.*more than once/);
    expect(issues).toMatch(/appropriate action \(add_water_direct\)/);
  });

  it('catches a safety or edibility claim anywhere in the text', () => {
    const { input } = inputFor(dry);
    const text = goodWaterText();
    text.options[0] = { ...text.options[0], why: 'This keeps the leaves edible.' };
    expect(checkWording(text, input.candidates[0]).join(' ')).toMatch(/edible/);
  });

  it('catches labels that hint at the answer and a plant line that names the cause', () => {
    const { input } = inputFor(dry);
    const text = goodWaterText();
    text.options[0] = { ...text.options[0], label: 'Best: add water to the pillows' };
    text.plant_line = 'I need more water.';
    const issues = checkWording(text, input.candidates[0]).join(' ');
    expect(issues).toMatch(/Best/);
    expect(issues).toMatch(/names the cause/);
  });

  it('catches labels that no longer name their action (fourth logged run)', () => {
    const { input } = inputFor(dry);
    const text = goodWaterText();
    text.options[0] = { ...text.options[0], label: 'Add liquid directly into the planting pillows' };
    text.options[1] = { ...text.options[1], label: 'Replenish the main liquid supply in the unit' };
    text.options[2] = { ...text.options[2], label: 'Wait for the next scheduled maintenance period' };
    text.options[3] = { ...text.options[3], label: 'Increase the airflow rate in the chamber' };
    const issues = checkWording(text, input.candidates[0]);
    expect(issues.filter((i) => i.includes('no longer names the action'))).toHaveLength(4);
    expect(issues.join(' ')).toMatch(/maintenance period.*"Wait for the next scheduled watering"; use the word "water"/);
    expect(issues.join(' ')).toMatch(/airflow rate.*use the word "fan"/);
    // The reviewed label keeps one of the two key words of its action, which is enough.
    expect(checkWording(goodWaterText(), input.candidates[0]).join(' ')).not.toMatch(/no longer names/);
  });

  it('catches result lines told by a narrator, but allows one line without I, me or my', () => {
    const { input } = inputFor(wet);
    const out = getFallbackCrisis('overwater_mold', 1, 'en', [])!;
    const fromLog = [
      'The wetness around the plants appears to diminish noticeably.',
      'The moisture around the plants remains high, and the fuzzy growth seems to spread.',
    ];
    const narrator = { ...out, options: out.options.map((o, i) => (i < 2 ? { ...o, result_line: fromLog[i] } : o)) };
    const issues = checkWording(narrator, input.candidates[0]).filter((i) => i.includes('narrator'));
    expect(issues).toHaveLength(2);
    const one = { ...out, options: out.options.map((o, i) => (i === 0 ? { ...o, result_line: 'Nothing changed, and the soft spots feel worse.' } : o)) };
    expect(checkWording(one, input.candidates[0]).join(' ')).not.toMatch(/narrator/);
    expect(checkWording({ ...out, plant_line: 'The leaves stay wet all day.' }, input.candidates[0]).join(' ')).toMatch(
      /plant_line: the lettuce speaks for itself/,
    );
  });

  it('catches a scene or plant line copied from the style example (fourth logged run)', () => {
    const { input } = inputFor(wet);
    const example = styleExample(input.candidates[0]);
    const out = {
      ...getFallbackCrisis('overwater_mold', 1, 'en', [])!,
      scene: 'Small droplets of moisture sit on the lettuce leaves and do not dry off. The entire planting area looks damp.',
      plant_line: 'My leaves stay wet, and the droplets on them never seem to go away. Everything around me feels damp.',
    };
    const issues = checkCopying(out, example).join(' ');
    expect(issues).toMatch(/scene: "the lettuce leaves and do not dry off" is copied/);
    expect(issues).toMatch(/plant_line: .* is copied/);
    expect(checkCopying(goodWaterText(), styleExample(inputFor(dry).input.candidates[0]))).toEqual([]);
    expect(checkCopying(out, undefined)).toEqual([]);
  });

  it('keeps the banned describing words out of labels in the prompt, and names each key word', () => {
    const { input } = inputFor(dry);
    const prompt = buildUserPrompt({ input, candidate: input.candidates[0], excerpts: [] });
    expect(prompt).toMatch(/ALSO DO NOT USE[^\n]*These words are fine in labels and why lines\./);
    expect(prompt).toMatch(/- fan_high: Set the fan to high \| verdict: inappropriate \|[^\n]*\| the label keeps the word "fan"/);
    expect(prompt).toMatch(/- refill_reservoir:[^\n]*the label keeps the word "water" or "reservoir"/);
  });
  it('catches "lack ... moisture" as naming the cause of a water shortage (fourth and fifth logs)', () => {
    const { input } = inputFor(dry);
    const text = {
      ...goodWaterText(),
      scene: 'The plants look stressed. The unit seems to lack proper moisture circulation.',
      plant_line: 'I feel that the substrate below me is lacking moisture.',
    };
    const issues = checkWording(text, input.candidates[0]).join(' ');
    expect(issues).toMatch(/scene: "lack proper moisture" names the cause/);
    expect(issues).toMatch(/plant_line: "lacking moisture" names the cause/);
  });
});

// --- model client --------------------------------------------------------------

describe('chatJson', () => {
  it('calls Ollama with the schema, thinking off and the context size', async () => {
    const { impl, calls } = fakeFetch({ modelReplies: [{ ok: true }] });
    const out = await chatJson(baseConfig, [{ role: 'user', content: 'hi' }], { type: 'object' }, new AbortController().signal, impl);
    expect(out).toEqual({ ok: true });
    expect(calls[0].url).toBe('http://ollama.test/api/chat');
    expect(calls[0].body).toMatchObject({ model: 'gemma4:e4b', stream: false, think: false, format: { type: 'object' }, options: { num_ctx: 8192 } });
    expect(calls[0].body).not.toHaveProperty('keep_alive');
    const kept = fakeFetch({ modelReplies: [{ ok: true }] });
    await chatJson({ ...baseConfig, keepAlive: '30m' }, [], {}, new AbortController().signal, kept.impl);
    expect(kept.calls[0].body.keep_alive).toBe('30m');
  });

  it('calls an OpenAI-compatible server with response_format and a key', async () => {
    const calls: Call[] = [];
    const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)), headers: init?.headers as Record<string, string> });
      return Response.json({ choices: [{ message: { content: '```json\n{"a":1}\n```' } }] });
    }) as typeof fetch;
    const config: LlmConfig = { ...baseConfig, provider: 'openai', baseUrl: 'https://pod.test/v1', apiKey: 'secret' };
    const out = await chatJson(config, [], { type: 'object' }, new AbortController().signal, impl);
    expect(out).toEqual({ a: 1 });
    expect(calls[0].url).toBe('https://pod.test/v1/chat/completions');
    expect(calls[0].body.response_format).toMatchObject({ type: 'json_schema' });
    expect(calls[0].headers.Authorization).toBe('Bearer secret');
    expect(calls[0].body).not.toHaveProperty('think');
  });

  it('throws on an HTTP error and on text that is not JSON', async () => {
    const http = fakeFetch({ modelReplies: [new Response('model not found', { status: 404 })] });
    await expect(chatJson(baseConfig, [], {}, new AbortController().signal, http.impl)).rejects.toThrow(/404/);
    expect(() => parseJsonText('not json')).toThrow(/not valid JSON/);
  });
});

// --- generator -----------------------------------------------------------------

describe('warmUp', () => {
  it('loads the model with an empty chat call and keeps it loaded', async () => {
    const { impl, calls } = fakeFetch({ modelReplies: [{}] });
    const ms = await warmUp({ ...baseConfig, keepAlive: '30m' }, new AbortController().signal, impl);
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://ollama.test/api/chat');
    expect(calls[0].body).toEqual({ model: 'gemma4:e4b', messages: [], keep_alive: '30m' });
  });

  it('does nothing for an OpenAI-compatible server or without a model, and never throws', async () => {
    const { impl, calls } = fakeFetch({ modelReplies: [{}] });
    expect(await warmUp({ ...baseConfig, provider: 'openai' }, new AbortController().signal, impl)).toBeNull();
    await warmUpModel({}, impl);
    await warmUpModel({ LLM_MODEL: 'm', LLM_PROVIDER: 'openai', LLM_BASE_URL: 'http://x.test/v1' }, impl);
    expect(calls).toHaveLength(0);
    const down = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    await expect(warmUpModel({ LLM_MODEL: 'm' }, down)).resolves.toBeUndefined();
  });
});

describe('createLlmGenerator', () => {
  it('returns text that passes validation, with excerpts from the search in the prompt', async () => {
    const { impl, calls } = fakeFetch({ modelReplies: [goodWaterText()], rag: 'ok' });
    const generator = createLlmGenerator({ ...baseConfig, ragUrl: 'http://rag.test' }, { fetchImpl: impl, random: inOrder });
    const { input, candidates } = inputFor(dry);
    const out = await generator(input, new AbortController().signal);
    expect(validateAiOutput(out, { candidates, excludedActionIds: [] }).ok).toBe(true);
    expect(calls.map((c) => c.url)).toEqual(['http://rag.test/retrieve', 'http://ollama.test/api/chat']);
    const userPrompt = (calls[1].body.messages as { content: string }[])[1].content;
    expect(userPrompt).toContain('Photos at 14 days showed stunted plants.');
    expect(userPrompt).not.toContain('VEG-01\nGrowth stall');
  });

  it('goes on without excerpts when the search server is down', async () => {
    const { impl, calls } = fakeFetch({ modelReplies: [goodWaterText()], rag: 'down' });
    const generator = createLlmGenerator({ ...baseConfig, ragUrl: 'http://rag.test' }, { fetchImpl: impl });
    const out = await generator(inputFor(dry).input, new AbortController().signal);
    expect(out).toMatchObject({ crisis_id: 'water_shortage' });
    const userPrompt = (calls[1].body.messages as { content: string }[])[1].content;
    expect(userPrompt).not.toContain('BACKGROUND EXCERPTS');
  });

  it('shuffles the options', async () => {
    const { impl } = fakeFetch({ modelReplies: [goodWaterText()] });
    const generator = createLlmGenerator(baseConfig, { fetchImpl: impl, random: () => 0 });
    const out = (await generator(inputFor(dry).input, new AbortController().signal)) as AiCrisisOutput;
    expect(out.options.map((o) => o.action_id)).not.toEqual(goodWaterText().options.map((o) => o.action_id));
    expect(new Set(out.options.map((o) => o.action_id))).toEqual(new Set(goodWaterText().options.map((o) => o.action_id)));
  });

  it('rejects text that invents a symptom', async () => {
    const bad = { ...goodWaterText(), plant_line: 'My leaves are drooping.' };
    const { impl } = fakeFetch({ modelReplies: [bad] });
    const generator = createLlmGenerator(baseConfig, { fetchImpl: impl });
    await expect(generator(inputFor(dry).input, new AbortController().signal)).rejects.toBeInstanceOf(GenerationRejectedError);
  });
});

describe('rewrite within an attempt', () => {
  const limp = { ...goodWaterText(), scene: 'The plants are not growing well. The wicks look dry and limp.' };

  it('sends the broken rules back and uses the rewrite', async () => {
    const { impl, calls } = fakeFetch({ modelReplies: [limp, goodWaterText()] });
    const generator = createLlmGenerator({ ...baseConfig, repairs: 1 }, { fetchImpl: impl, random: inOrder });
    const out = (await generator(inputFor(dry).input, new AbortController().signal)) as AiCrisisOutput;
    expect(out.scene).toBe(goodWaterText().scene);
    const chats = calls.filter((c) => c.url.endsWith('/api/chat'));
    expect(chats).toHaveLength(2);
    const second = chats[1].body.messages as { role: string; content: string }[];
    expect(second.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(second[2].content).toContain('dry and limp');
    expect(second[3].content).toMatch(/broke these rules[\s\S]*limp/);
  });

  it('sends a copied scene back for a rewrite', async () => {
    const copied = { ...goodWaterText(), scene: styleExample(inputFor(dry).input.candidates[0])!.scene };
    const { impl, calls } = fakeFetch({ modelReplies: [copied, goodWaterText()] });
    const generator = createLlmGenerator({ ...baseConfig, repairs: 1 }, { fetchImpl: impl, random: inOrder });
    const out = (await generator(inputFor(dry).input, new AbortController().signal)) as AiCrisisOutput;
    expect(out.scene).toBe(goodWaterText().scene);
    const second = calls.filter((c) => c.url.endsWith('/api/chat'))[1].body.messages as { content: string }[];
    expect(second[3].content).toMatch(/copied from the example/);
  });

  it('still throws when the rewrite breaks a rule too', async () => {
    const { impl, calls } = fakeFetch({ modelReplies: [limp, limp] });
    const generator = createLlmGenerator({ ...baseConfig, repairs: 1 }, { fetchImpl: impl });
    await expect(generator(inputFor(dry).input, new AbortController().signal)).rejects.toBeInstanceOf(GenerationRejectedError);
    expect(calls.filter((c) => c.url.endsWith('/api/chat'))).toHaveLength(2);
  });

  it('reads LLM_REPAIRS and defaults to one rewrite', () => {
    expect(readLlmConfig({ LLM_MODEL: 'm' })!.repairs).toBe(1);
    expect(readLlmConfig({ LLM_MODEL: 'm', LLM_REPAIRS: '0' })!.repairs).toBe(0);
    expect(() => readLlmConfig({ LLM_MODEL: 'm', LLM_REPAIRS: '-1' })).toThrow(/LLM_REPAIRS/);
  });
});

describe('createCrisis with the model generator', () => {
  it('serves generated text with verdicts and sources from the evidence list', async () => {
    const { impl } = fakeFetch({ modelReplies: [goodWaterText()] });
    const response = await createCrisis(dry, { generator: createLlmGenerator(baseConfig, { fetchImpl: impl, random: inOrder }) });
    expect(response.origin).toBe('generated');
    expect(response.scene).toBe(goodWaterText().scene);
    const direct = response.options.find((o) => o.action_id === 'add_water_direct')!;
    expect(direct.verdict).toBe('appropriate');
    expect(direct.source).not.toBeNull();
  });

  it('retries once, then falls back to the pre-made crisis when the text keeps failing the guard', async () => {
    const bad = { ...goodWaterText(), scene: 'The lettuce is wilting.' };
    const { impl, calls } = fakeFetch({ modelReplies: [bad, bad] });
    const response = await createCrisis(dry, { generator: createLlmGenerator(baseConfig, { fetchImpl: impl }) });
    expect(response.origin).toBe('fallback');
    expect(calls.filter((c) => c.url.endsWith('/api/chat'))).toHaveLength(2);
  });

  it('uses the second attempt when only the first fails', async () => {
    const bad = { ...goodWaterText(), scene: 'The lettuce is wilting.' };
    const { impl } = fakeFetch({ modelReplies: [bad, goodWaterText()] });
    const response = await createCrisis(dry, { generator: createLlmGenerator(baseConfig, { fetchImpl: impl, random: inOrder }) });
    expect(response.origin).toBe('generated');
  });
});

describe('shuffle', () => {
  it('keeps every item', () => {
    expect(shuffle([1, 2, 3, 4], Math.random).sort()).toEqual([1, 2, 3, 4]);
  });
});
