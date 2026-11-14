import { describe, expect, it } from 'vitest';
import type { EventCardRequest } from '@/lib/contract/schemas';
import type { LlmConfig } from '@/lib/crisis/llm';
import { eventList } from '@/lib/events';
import { INITIAL_PLANT_STATE } from '@/lib/game/rules';
import { buildEventCardGenerationInput } from './generator';
import {
  allowedSymptomText,
  checkEventCardWording,
  createEventCardLlmGenerator,
  styleExample,
  type EventCardModelReply,
} from './llm-generator';
import { createEventCard, isCardEvent } from './pipeline';
import { getPremadeEventCard, premadeEventCards } from './premade';

// --- helpers -------------------------------------------------------------------

const cardEvents = eventList.events.filter(isCardEvent);

/** A request inside the event's window, offering every action unless told otherwise. */
function requestFor(eventId: string, offered?: string[]): EventCardRequest {
  const event = cardEvents.find((e) => e.event_id === eventId)!;
  return {
    locale: 'en',
    cultivation_day: event.window.from,
    state: { ...INITIAL_PLANT_STATE },
    event_id: eventId,
    ...(offered ? { offered_action_ids: offered } : {}),
  };
}

const config: LlmConfig = {
  provider: 'ollama',
  baseUrl: 'http://ollama.test',
  model: 'test-model',
  timeoutMs: 30_000,
  temperature: 0.4,
  numCtx: 8192,
  think: false,
  ragTopN: 4,
  ragTimeoutMs: 1_000,
};

/** A good reply for the event, built from its reviewed text with new wording in the scene. */
function goodReply(eventId: string, offered?: string[]): EventCardModelReply {
  const ids = offered ?? cardEvents.find((e) => e.event_id === eventId)!.actions.map((a) => a.action_id);
  const premade = getPremadeEventCard(eventId, ids)!;
  return {
    ...styleExample(premade),
    scene: `Generated scene. ${premade.scene}`,
  };
}

interface Call {
  url: string;
  raw: string;
  body: Record<string, unknown>;
}

/** Fake fetch for the model URL. Each reply is a JSON value, a Response, or an Error to throw. */
function fakeFetch(...replies: unknown[]) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = String(init?.body ?? '');
    calls.push({ url: String(input), raw, body: JSON.parse(raw) as Record<string, unknown> });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (reply instanceof Error) throw reply;
    if (reply instanceof Response) return reply;
    return Response.json({ message: { role: 'assistant', content: JSON.stringify(reply) } });
  }) as typeof fetch;
  return { impl, calls };
}

function generatorWith(...replies: unknown[]) {
  const { impl, calls } = fakeFetch(...replies);
  return { generator: createEventCardLlmGenerator(config, { fetchImpl: impl }), calls };
}

const VERDICT_WORDS = /\b(appropriate|inappropriate|partial|verdict)\b/i;

// --- request -------------------------------------------------------------------

describe('event card request to the model', () => {
  it.each(cardEvents.map((e) => [e.event_id]))(
    '%s: enumerates exactly the offered ids and sends no verdict, why or event name',
    async (eventId) => {
      const { generator, calls } = generatorWith(goodReply(eventId));
      const response = await createEventCard(requestFor(eventId), { generator });
      expect(response.origin).toBe('generated');
      expect(calls).toHaveLength(1);
      const call = calls[0];
      expect(call.url).toBe('http://ollama.test/api/chat');

      const event = cardEvents.find((e) => e.event_id === eventId)!;
      const ids = event.actions.map((a) => a.action_id);
      const format = call.body.format as {
        required: string[];
        properties: { options: { minItems: number; maxItems: number; items: { required: string[]; properties: Record<string, { enum?: string[] }> } } };
      };
      expect(format.required).toEqual(['scene', 'plant_line', 'options']);
      expect(format.properties.options.minItems).toBe(ids.length);
      expect(format.properties.options.maxItems).toBe(ids.length);
      expect(format.properties.options.items.required).toEqual(['action_id', 'label', 'result_line']);
      expect(Object.keys(format.properties.options.items.properties)).not.toContain('why');
      expect(format.properties.options.items.properties.action_id.enum).toEqual(ids);

      // The whole serialized request: messages and schema.
      expect(call.raw).not.toMatch(VERDICT_WORDS);
      for (const option of getPremadeEventCard(eventId, ids)!.options) {
        expect(call.raw).not.toContain(option.why);
      }
      expect(call.raw).not.toContain('game value');
      expect(call.raw).not.toContain(event.name!);

      const user = (call.body.messages as { role: string; content: string }[])[1].content;
      expect(user).toContain(event.summary);
      if (event.scene_hint) expect(user).toContain(event.scene_hint);
      for (const id of ids) expect(user).toContain(`- ${id}: `);
    },
  );

  it('enumerates only an offered subset, in the offered order', async () => {
    const offered = ['water_heavy_instead', 'thin_to_one'];
    const { generator, calls } = generatorWith(goodReply('thinning', offered));
    const response = await createEventCard(requestFor('thinning', offered), { generator });
    const format = calls[0].body.format as { properties: { options: { maxItems: number; items: { properties: { action_id: { enum: string[] } } } } } };
    expect(format.properties.options.items.properties.action_id.enum).toEqual(offered);
    expect(format.properties.options.maxItems).toBe(2);
    expect(calls[0].raw).not.toContain('keep_both');
    expect(response.options.map((o) => o.action_id)).toEqual(offered);
  });
});

// --- accepted answers ----------------------------------------------------------

describe('createEventCard with the event card generator', () => {
  it('serves the model text with why taken from the pre-made card', async () => {
    const reply = goodReply('thinning');
    // The model may answer in another order; the card keeps the offered order.
    const { generator } = generatorWith({ ...reply, options: [...reply.options].reverse() });
    const response = await createEventCard(requestFor('thinning'), { generator });
    const premade = getPremadeEventCard('thinning', ['thin_to_one', 'keep_both', 'water_heavy_instead'])!;
    expect(response.origin).toBe('generated');
    expect(response.scene).toBe(reply.scene);
    expect(response.options.map((o) => o.action_id)).toEqual(['thin_to_one', 'keep_both', 'water_heavy_instead']);
    expect(response.options.map((o) => o.why)).toEqual(premade.options.map((o) => o.why));
    expect(response.options.map((o) => o.verdict)).toEqual(['appropriate', 'partial', 'inappropriate']);
  });

  it('uses the second attempt when only the first fails', async () => {
    const bad = { ...goodReply('thinning'), plant_line: 'My leaves are starting to wilt.' };
    const { generator, calls } = generatorWith(bad, goodReply('thinning'));
    const response = await createEventCard(requestFor('thinning'), { generator });
    expect(response.origin).toBe('generated');
    expect(calls).toHaveLength(2);
  });
});

// --- rejected answers ----------------------------------------------------------

describe('rejected answers fall back to the pre-made card after two attempts', () => {
  const good = goodReply('thinning');
  const [first, second, third] = good.options;
  const cases: [string, unknown][] = [
    ['an invented symptom in the plant line', { ...good, plant_line: 'My leaves are starting to wilt.' }],
    ['an invented symptom in the scene', { ...good, scene: 'Two seedlings share one pillow. One of them is drooping.' }],
    ['an invented symptom in a label', { ...good, options: [{ ...first, label: 'Remove the yellowing seedling' }, second, third] }],
    ['an invented symptom in a result line', { ...good, options: [first, second, { ...third, result_line: 'My roots are starting to rot.' }] }],
    ['a foreign action', { ...good, options: [first, second, { ...third, action_id: 'fan_high' }] }],
    ['a missing action (repeated id)', { ...good, options: [first, second, { ...third, action_id: first.action_id }] }],
    ['a missing action (too few options)', { ...good, options: [first, second] }],
    ['a reveal word in a label', { ...good, options: [{ ...first, label: 'Take the recommended step' }, second, third] }],
    ['a banned claim', { ...good, options: [first, second, { ...third, result_line: 'Now I am edible.' }] }],
    ['an extra why field', { ...good, options: [{ ...first, why: 'Invented reason.' }, second, third] }],
    ['an empty scene', { ...good, scene: ' ' }],
    ['text that is not JSON', 'not json'],
    ['a network error', new TypeError('fetch failed')],
    ['an HTTP error', new Response('model not found', { status: 404 })],
  ];

  it.each(cases)('%s', async (_, reply) => {
    // A Response body can be read once, so each attempt gets a fresh one.
    const replies = reply instanceof Response ? [reply, new Response('model not found', { status: 404 })] : [reply];
    const { generator, calls } = generatorWith(...replies);
    const response = await createEventCard(requestFor('thinning'), { generator });
    expect(response.origin).toBe('fallback');
    expect(calls).toHaveLength(2);
    const premade = getPremadeEventCard('thinning', ['thin_to_one', 'keep_both', 'water_heavy_instead'])!;
    expect(response.scene).toBe(premade.scene);
    expect(response.options.map((o) => o.label)).toEqual(premade.options.map((o) => o.label));
  });
});

// --- wording check -------------------------------------------------------------

describe('checkEventCardWording', () => {
  it('passes the model-written fields of every pre-made card', () => {
    for (const card of premadeEventCards.cards) {
      const event = cardEvents.find((e) => e.event_id === card.event_id)!;
      const ids = event.actions.map((a) => a.action_id);
      const input = buildEventCardGenerationInput(requestFor(event.event_id), event, event.name!, ids);
      expect(checkEventCardWording(styleExample(card), allowedSymptomText(input, card))).toEqual([]);
    }
  });

  it('allows a symptom group only when the event records it', () => {
    const tipBurn = cardEvents.find((e) => e.event_id === 'mild_tip_burn')!;
    const thinning = cardEvents.find((e) => e.event_id === 'thinning')!;
    const allowed = (event: typeof tipBurn) =>
      allowedSymptomText(
        buildEventCardGenerationInput(requestFor(event.event_id), event, event.name!, event.actions.map((a) => a.action_id)),
        getPremadeEventCard(event.event_id, event.actions.map((a) => a.action_id))!,
      );
    const reply = { ...goodReply('mild_tip_burn'), plant_line: 'My leaf edges look brown and a little burnt.' };
    expect(checkEventCardWording(reply, allowed(tipBurn))).toEqual([]);
    const issues = checkEventCardWording({ ...goodReply('thinning'), plant_line: reply.plant_line }, allowed(thinning));
    expect(issues.join(' ')).toMatch(/discoloration/);
    expect(issues.join(' ')).toMatch(/burn/);
  });
});
