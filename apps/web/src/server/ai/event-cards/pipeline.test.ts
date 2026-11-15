import { describe, expect, it } from 'vitest';
import { eventCardResponseSchema, type EventCardRequest } from '@/lib/contract/schemas';
import type { EventList } from '@/lib/contract/types';
import { eventList } from '@/lib/events';
import { INITIAL_PLANT_STATE } from '@/lib/game/rules';
import type { EventCardGenerationInput, EventCardGenerator } from './generator';
import { createEventCard, InvalidEventRequestError, isCardEvent } from './pipeline';
import { getPremadeEventCard } from './premade';

function request(patch: Partial<EventCardRequest> = {}): EventCardRequest {
  return {
    locale: 'en',
    cultivation_day: 7,
    state: { ...INITIAL_PLANT_STATE },
    event_id: 'thinning',
    ...patch,
  };
}

const cardEvents = eventList.events.filter(isCardEvent);

/** A fake generator that returns the given results in order and records its calls. */
function scripted(...results: (() => Promise<unknown>)[]) {
  const calls: { input: EventCardGenerationInput; signal: AbortSignal }[] = [];
  const generator: EventCardGenerator = (input, signal) => {
    calls.push({ input, signal });
    const next = results[Math.min(calls.length - 1, results.length - 1)];
    return next();
  };
  return { generator, calls };
}

function generatedThinning(ids = ['thin_to_one', 'keep_both', 'water_heavy_instead']) {
  return { ...getPremadeEventCard('thinning', ids)!, scene: 'Generated scene. Two shoots lean together.' };
}

const valid = () => Promise.resolve(generatedThinning());
const invalid = () => Promise.resolve({ event_id: 'thinning', scene: 'Only a scene.' });
const throws = () => Promise.reject(new Error('generator failed'));
const never = () => new Promise<unknown>(() => undefined);

describe('createEventCard without a generator', () => {
  it.each(cardEvents.map((e) => [e.event_id, e] as const))(
    '%s returns the pre-made card with the event list values',
    async (_, event) => {
      const card = await createEventCard(request({ event_id: event.event_id, cultivation_day: event.window.from }));
      expect(eventCardResponseSchema.parse(card)).toEqual(card);
      const premade = getPremadeEventCard(event.event_id, event.actions.map((a) => a.action_id))!;
      expect(card).toMatchObject({
        event_id: event.event_id,
        kind: event.kind,
        name: event.name,
        cultivation_day: event.window.from,
        scene: premade.scene,
        plant_line: premade.plant_line,
        summary: event.summary,
        source_chunks: event.source_chunks,
        draft: true,
        origin: 'fallback',
      });
      expect(card.options.map((o) => o.action_id)).toEqual(event.actions.map((a) => a.action_id));
      card.options.forEach((option, i) => {
        const action = event.actions[i];
        expect(option).toEqual({
          ...premade.options[i],
          op: action.op,
          verdict: action.verdict,
          effect: action.effect,
          value_type: 'game_value',
        });
      });
    },
  );

  it('offers a subset in the offered order', async () => {
    const card = await createEventCard(request({ offered_action_ids: ['water_heavy_instead', 'thin_to_one'] }));
    expect(card.options.map((o) => [o.action_id, o.verdict])).toEqual([
      ['water_heavy_instead', 'inappropriate'],
      ['thin_to_one', 'appropriate'],
    ]);
  });

  it('accepts any day inside a conditional event window', async () => {
    for (const day of [2, 17]) {
      const card = await createEventCard(request({ event_id: 'fan_off_after_restart', cultivation_day: day }));
      expect(card.cultivation_day).toBe(day);
    }
  });

  it('returns copies, so the event list cannot be changed through a response', async () => {
    const card = await createEventCard(request({ event_id: 'pillow_no_flow', cultivation_day: 1 }));
    card.options[0].effect.clear_flags!.push('changed');
    card.source_chunks.push('changed');
    const again = await createEventCard(request({ event_id: 'pillow_no_flow', cultivation_day: 1 }));
    expect(again.options[0].effect.clear_flags).toEqual(['water_blocked']);
    expect(again.source_chunks).not.toContain('changed');
  });

  it.each([
    ['an unknown event', request({ event_id: 'no_such_event' })],
    ['a crisis event', request({ event_id: 'water_shortage', cultivation_day: 12 })],
    ['a scheduled event without a card', request({ event_id: 'harvest_procedure', cultivation_day: 33 })],
    ['a day before the window', request({ cultivation_day: 6 })],
    ['a day after the window', request({ cultivation_day: 8 })],
    ['an action of another event', request({ offered_action_ids: ['thin_to_one', 'open_wicks'] })],
    ['an unknown action', request({ offered_action_ids: ['nope'] })],
    ['a repeated action', request({ offered_action_ids: ['thin_to_one', 'thin_to_one'] })],
  ])('rejects %s', async (_, req) => {
    await expect(createEventCard(req)).rejects.toBeInstanceOf(InvalidEventRequestError);
  });

  it('uses deps.events when given', async () => {
    const list: EventList = { ...eventList, events: eventList.events.filter((e) => e.event_id !== 'thinning') };
    await expect(createEventCard(request(), { events: list })).rejects.toBeInstanceOf(InvalidEventRequestError);
  });

  it('throws a plain error when a card event has no pre-made text', async () => {
    const list: EventList = {
      ...eventList,
      events: eventList.events.map((e) => (e.event_id === 'thinning' ? { ...e, event_id: 'thinning_copy' } : e)),
    };
    const failure = createEventCard(request({ event_id: 'thinning_copy' }), { events: list });
    await expect(failure).rejects.toThrow(/No pre-made card text/);
    await expect(failure).rejects.not.toBeInstanceOf(InvalidEventRequestError);
  });
});

describe('createEventCard with a generator', () => {
  it('returns valid generated output as generated', async () => {
    const { generator, calls } = scripted(valid);
    const card = await createEventCard(request(), { generator });
    expect(card.origin).toBe('generated');
    expect(card.scene).toBe('Generated scene. Two shoots lean together.');
    expect(calls).toHaveLength(1);
    expect(calls[0].input.actions.map((a) => a.action_id)).toEqual(['thin_to_one', 'keep_both', 'water_heavy_instead']);
  });

  it('puts generated options in the offered order and takes values from the event list', async () => {
    const out = generatedThinning();
    out.options.reverse();
    const { generator } = scripted(() => Promise.resolve(out));
    const card = await createEventCard(request(), { generator });
    expect(card.options.map((o) => o.action_id)).toEqual(['thin_to_one', 'keep_both', 'water_heavy_instead']);
    expect(card.options[0]).toMatchObject({ op: 'thin_to_one', verdict: 'appropriate', effect: { plant_health: 2 } });
  });

  it('retries once after invalid output', async () => {
    const { generator, calls } = scripted(invalid, valid);
    const card = await createEventCard(request(), { generator });
    expect(card.origin).toBe('generated');
    expect(calls).toHaveLength(2);
  });

  it('falls back to the pre-made card after two invalid outputs', async () => {
    const { generator, calls } = scripted(invalid, invalid);
    const card = await createEventCard(request(), { generator });
    expect(card.origin).toBe('fallback');
    expect(card.scene).toBe(getPremadeEventCard('thinning', ['thin_to_one'])!.scene);
    expect(calls).toHaveLength(2);
  });

  it('falls back after a throwing and a timed-out generator', async () => {
    const { generator, calls } = scripted(throws, never);
    const card = await createEventCard(request(), { generator, timeoutMs: 20 });
    expect(card.origin).toBe('fallback');
    expect(calls).toHaveLength(2);
    expect(calls[1].signal.aborted).toBe(true);
  });

  it.each([
    ['an extra action', () => {
      const out = generatedThinning(['thin_to_one', 'keep_both']);
      return { ...out, options: [...out.options, { ...out.options[0], action_id: 'water_heavy_instead' }] };
    }],
    ['a missing action', () => generatedThinning(['thin_to_one'])],
    ['a foreign action', () => {
      const out = generatedThinning(['thin_to_one', 'keep_both']);
      return { ...out, options: [out.options[0], { ...out.options[1], action_id: 'open_wicks' }] };
    }],
    ['a reveal word in a label', () => {
      const out = generatedThinning(['thin_to_one', 'keep_both']);
      out.options[1].label = 'Keep both, the optimal move';
      return out;
    }],
    ['a banned claim', () => {
      const out = generatedThinning(['thin_to_one', 'keep_both']);
      out.options[0].result_line = 'Now I am safe to eat.';
      return out;
    }],
  ])('rejects generated output with %s', async (_, make) => {
    const { generator, calls } = scripted(() => Promise.resolve(make()));
    const card = await createEventCard(request({ offered_action_ids: ['thin_to_one', 'keep_both'] }), {
      generator,
    });
    expect(card.origin).toBe('fallback');
    expect(calls).toHaveLength(2);
  });
});

describe('createEventCard in Korean', () => {
  it('returns the Korean name and pre-made text, skipping the English-only generator', async () => {
    const { generator, calls } = scripted(valid);
    const ko = await createEventCard(request({ locale: 'ko' }), { generator });
    const en = await createEventCard(request());
    expect(calls).toHaveLength(0);
    expect(ko.origin).toBe('fallback');
    expect(ko.name).toMatch(/[가-힣]/);
    expect(ko.scene).toMatch(/[가-힣]/);
    const rule = (r: typeof en) => r.options.map((o) => [o.action_id, o.op, o.verdict, o.effect]);
    expect(rule(ko)).toEqual(rule(en));
  });
});
