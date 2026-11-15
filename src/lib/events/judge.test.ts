import { describe, expect, it } from 'vitest';
import type {
  ConditionalTimelineEvent,
  EventList,
  PlannedEvent,
  PlantState,
} from '@/lib/contract/types';
import { nextRandom } from '@/lib/game/rng';
import { evidence } from '@/lib/evidence';
import { selectCandidates } from '@/lib/evidence/select';
import { DEMO_SEED, INITIAL_PLANT_STATE } from '@/lib/game/rules';
import { eventList } from './index';
import {
  activeFlagEffects,
  conditionHolds,
  eventRngState,
  eventsDueOn,
  findEventAction,
  findTimelineEvent,
  flagsAfterAction,
  flagsAfterOccur,
  gameDayOn,
  isCardKind,
  nextEventOn,
  offeredActionIds,
  planEvent,
  planEvents,
  recordDrawn,
  recordsOn,
  trackEntriesOn,
  trackEntryKey,
  type CardEvent,
} from './judge';

const plant = (patch: Partial<PlantState> = {}): PlantState => ({ ...INITIAL_PLANT_STATE, ...patch });

function conditional(id: string): ConditionalTimelineEvent {
  const event = findTimelineEvent(eventList, id);
  if (!event || event.kind !== 'conditional') throw new Error(`${id} is not a conditional event`);
  return event;
}

function card(id: string): CardEvent {
  const event = findTimelineEvent(eventList, id);
  if (!event || !isCardKind(event)) throw new Error(`${id} is not a card event`);
  return event;
}

/** A plan in which nothing, or only the given events, is planned from the given day. */
function planOf(planned: Record<string, number> = {}): PlannedEvent[] {
  return eventList.events
    .filter((e) => e.kind === 'conditional')
    .map((e) => ({
      event_id: e.event_id,
      planned: e.event_id in planned,
      earliest_day: planned[e.event_id] ?? e.window.from,
    }));
}

const dueIds = (day: number, state: PlantState, plan: PlannedEvent[], occurred: string[] = []) =>
  eventsDueOn(eventList, { cultivation_day: day, plant: state, plan, occurred_event_ids: occurred }).map(
    (e) => e.event_id,
  );

describe('event random numbers', () => {
  it('gives the same plan for the same seed', () => {
    expect(planEvents(eventList, 12345)).toEqual(planEvents(eventList, 12345));
  });

  it('has one plan entry per conditional event, with the day inside the window', () => {
    for (let seed = 0; seed < 500; seed++) {
      const plan = planEvents(eventList, seed);
      expect(plan.map((p) => p.event_id)).toEqual(
        eventList.events.filter((e) => e.kind === 'conditional').map((e) => e.event_id),
      );
      for (const entry of plan) {
        const event = conditional(entry.event_id);
        expect(entry.earliest_day).toBeGreaterThanOrEqual(event.window.from);
        expect(entry.earliest_day).toBeLessThanOrEqual(event.window.to);
      }
    }
  });

  it('does not depend on the other events of the list', () => {
    const fan = conditional('fan_off_after_restart');
    const alone: EventList = { ...eventList, events: [fan] };
    expect(planEvents(alone, 77)[0]).toEqual(planEvent(fan, 77));
    expect(planEvents(eventList, 77).find((p) => p.event_id === fan.event_id)).toEqual(planEvent(fan, 77));
  });

  it('uses a generator state different from the first crisis roll state', () => {
    for (const event of eventList.events) {
      expect(eventRngState(DEMO_SEED, event.event_id)).not.toBe(DEMO_SEED);
      expect(eventRngState(DEMO_SEED, event.event_id)).not.toBe(nextRandom(DEMO_SEED).state);
    }
  });

  it('plans each event in about `probability` of the missions', () => {
    const missions = 20000;
    for (const event of eventList.events) {
      if (event.kind !== 'conditional') continue;
      let planned = 0;
      for (let seed = 1; seed <= missions; seed++) if (planEvent(event, seed).planned) planned++;
      expect(Math.abs(planned / missions - event.probability)).toBeLessThan(0.02);
    }
  });

  it('spreads the planned day over the whole window', () => {
    const fan = conditional('fan_off_after_restart');
    const days = new Set<number>();
    for (let seed = 1; seed <= 2000; seed++) days.add(planEvent(fan, seed).earliest_day);
    expect(days.size).toBe(fan.window.to - fan.window.from + 1);
  });
});

describe('conditionHolds', () => {
  it('holds for an empty condition', () => {
    expect(conditionHolds({}, plant())).toBe(true);
  });

  it('checks the fan setting', () => {
    expect(conditionHolds({ fan: 'low' }, plant({ fan: 'low' }))).toBe(true);
    expect(conditionHolds({ fan: 'low' }, plant({ fan: 'high' }))).toBe(false);
  });

  it('checks the least plant health, inclusive', () => {
    expect(conditionHolds({ min_health: 70 }, plant({ plant_health: 70 }))).toBe(true);
    expect(conditionHolds({ min_health: 70 }, plant({ plant_health: 69 }))).toBe(false);
  });

  it('needs every listed metric in one of its zones', () => {
    const condition = conditional('mild_tip_burn').condition;
    expect(conditionHolds(condition, plant({ plant_health: 80 }))).toBe(true);
    expect(conditionHolds(condition, plant({ plant_health: 80, humidity: 75 }))).toBe(false);
    expect(conditionHolds(condition, plant({ plant_health: 80, root_moisture: 35 }))).toBe(false);
  });
});

describe('eventsDueOn', () => {
  it('shows a scheduled event on its day only, whatever the plan', () => {
    expect(dueIds(2, plant(), planOf())).toEqual([]);
    expect(dueIds(3, plant(), planOf())).toEqual(['wick_opening']);
    expect(dueIds(4, plant(), planOf())).toEqual([]);
    expect(dueIds(7, plant(), planOf())).toEqual(['thinning']);
  });

  it('shows no card for the harvest link and never judges crisis events', () => {
    expect(dueIds(33, plant(), planOf())).toEqual([]);
    for (let day = 0; day <= 33; day++) {
      const ids = dueIds(day, plant({ root_moisture: 10 }), planOf());
      expect(ids).not.toContain('water_shortage');
      expect(ids).not.toContain('overwater_mold');
    }
  });

  it('shows an event at most once', () => {
    expect(dueIds(3, plant(), planOf(), ['wick_opening'])).toEqual([]);
    const plan = planOf({ fan_off_after_restart: 5 });
    expect(dueIds(5, plant(), plan)).toEqual(['fan_off_after_restart']);
    expect(dueIds(6, plant(), plan, ['fan_off_after_restart'])).toEqual([]);
  });

  it('shows a conditional event only when it is planned for the mission', () => {
    for (let day = 0; day <= 33; day++) {
      expect(dueIds(day, plant(), planOf()).filter((id) => id === 'fan_off_after_restart')).toEqual([]);
    }
  });

  it('waits for the planned day, then for the condition, until the window ends', () => {
    const plan = planOf({ fan_off_after_restart: 9 });
    expect(dueIds(8, plant(), plan)).toEqual([]);
    // Planned day reached but the fan is on high: the event waits.
    expect(dueIds(9, plant({ fan: 'high' }), plan)).toEqual([]);
    expect(dueIds(11, plant({ fan: 'high' }), plan)).toEqual([]);
    // The fan is back on low inside the window: the event occurs.
    expect(dueIds(12, plant({ fan: 'low' }), plan)).toEqual(['fan_off_after_restart']);
    // After the window it never occurs.
    expect(dueIds(18, plant({ fan: 'low' }), plan)).toEqual([]);
  });

  it('lists several events of one day in list order and steps through them', () => {
    const plan = planOf({ fan_off_after_restart: 3 });
    expect(dueIds(3, plant(), plan)).toEqual(['wick_opening', 'fan_off_after_restart']);
    const context = { cultivation_day: 3, plant: plant(), plan, occurred_event_ids: [] as string[] };
    const first = nextEventOn(eventList, context);
    expect(first?.event_id).toBe('wick_opening');
    const second = nextEventOn(eventList, { ...context, occurred_event_ids: ['wick_opening'] });
    expect(second?.event_id).toBe('fan_off_after_restart');
    expect(
      nextEventOn(eventList, { ...context, occurred_event_ids: ['wick_opening', 'fan_off_after_restart'] }),
    ).toBeNull();
  });

  it('gives the same events for the same seed and state', () => {
    const run = (seed: number) => {
      const plan = planEvents(eventList, seed);
      const seen: string[] = [];
      for (let day = 0; day <= 33; day++) {
        for (const event of eventsDueOn(eventList, { cultivation_day: day, plant: plant(), plan, occurred_event_ids: seen })) {
          seen.push(`${day}:${event.event_id}`);
        }
      }
      return seen;
    };
    expect(run(2042)).toEqual(run(2042));
  });
});

describe('recordsOn', () => {
  const recordIds = (day: number, heading: PlantState, seed = 1) =>
    recordsOn(eventList, { cultivation_day: day, heading, seed }).map((e) => e.event_id);

  /** Every state the heading can be in, by zone: 0-100 in steps of 5 for both metrics, both fan settings. */
  const headings: PlantState[] = [];
  for (let m = 0; m <= 100; m += 5) {
    for (let h = 0; h <= 100; h += 5) {
      for (const fan of ['low', 'high'] as const) headings.push(plant({ root_moisture: m, humidity: h, fan }));
    }
  }

  it('writes at least one line on every day between game days 1 and 2 (days 2 to 5, except the wick card day)', () => {
    for (const heading of headings) {
      for (const day of [2, 4, 5]) expect(recordIds(day, heading).length, `day ${day}`).toBeGreaterThan(0);
    }
  });

  it('writes one line per group per day', () => {
    for (const heading of headings) {
      for (let day = 0; day <= 33; day++) {
        const groups = recordsOn(eventList, { cultivation_day: day, heading, seed: 1 })
          .map((e) => e.group)
          .filter((g): g is string => g !== undefined);
        expect(new Set(groups).size).toBe(groups.length);
      }
    }
  });

  it('leads up to the crisis that the next game day can raise, and only to that', () => {
    for (const heading of headings) {
      const candidates = new Set(selectCandidates(evidence, heading).map((c) => c.crisis.crisis_id));
      for (const day of [4, 5]) {
        const foreshadowed = recordsOn(eventList, { cultivation_day: day, heading, seed: 1 }).flatMap(
          (e) => e.foreshadows ?? [],
        );
        // No hint of a crisis that cannot occur, and a hint whenever one can.
        for (const id of foreshadowed) expect(candidates.has(id), `day ${day}: ${id}`).toBe(true);
        expect(foreshadowed.length > 0, `day ${day}, ${JSON.stringify(heading)}`).toBe(candidates.size > 0);
      }
    }
  });

  it('shows the dry hints before a water shortage and the wet hints before excess water', () => {
    expect(recordIds(4, plant({ root_moisture: 35 }))).toContain('record_wicks_look_dry');
    expect(recordIds(5, plant({ root_moisture: 35 }))).toContain('record_growth_slow');
    expect(recordIds(4, plant({ root_moisture: 75, fan: 'low' }))).toContain('record_droplets_on_leaves');
    expect(recordIds(5, plant({ humidity: 75, fan: 'low' }))).toContain('record_humidity_reading_high');
    expect(recordIds(4, plant())).toContain('record_sprouts_even');
    expect(recordIds(5, plant())).toContain('record_seedlings_growing');
  });

  it('falls back to a plain line when the state is off but no crisis can follow', () => {
    // Excess water with the fan on high does not meet the overwater_mold trigger.
    expect(recordIds(4, plant({ root_moisture: 75, fan: 'high' }))).toEqual(['record_seedlings_checked']);
  });

  it('draws a record with a probability from the seed, in about that share of missions', () => {
    const event = eventList.events.find((e) => e.event_id === 'record_pillow_not_sprouting');
    if (!event || event.kind !== 'record' || event.probability === undefined) throw new Error('missing record');
    expect(recordDrawn(event, 42)).toBe(recordDrawn(event, 42));
    let drawn = 0;
    for (let seed = 1; seed <= 20000; seed++) if (recordDrawn(event, seed)) drawn++;
    expect(Math.abs(drawn / 20000 - event.probability)).toBeLessThan(0.02);
  });

  it('never shows a record as a card', () => {
    for (let day = 0; day <= 33; day++) {
      const due = eventsDueOn(eventList, { cultivation_day: day, plant: plant(), plan: planOf(), occurred_event_ids: [] });
      for (const event of due) expect(event.kind).not.toBe('record');
    }
  });
});

describe('offeredActionIds', () => {
  it('offers every action when none is a no-op', () => {
    const fan = card('fan_off_after_restart');
    expect(offeredActionIds(fan, plant({ fan: 'low' }))).toEqual(fan.actions.map((a) => a.action_id));
    const wicks = card('wick_opening');
    expect(offeredActionIds(wicks, plant({ fan: 'high' }))).toEqual(wicks.actions.map((a) => a.action_id));
  });

  it('drops "fan high" from the tip-burn card when the fan is already high', () => {
    const tip = card('mild_tip_burn');
    const highOps = tip.actions.filter((a) => a.op === 'fan_high').map((a) => a.action_id);
    expect(highOps.length).toBeGreaterThan(0);
    const offered = offeredActionIds(tip, plant({ fan: 'high', plant_health: 80 }));
    for (const id of highOps) expect(offered).not.toContain(id);
    expect(offeredActionIds(tip, plant({ fan: 'low', plant_health: 80 }))).toEqual(tip.actions.map((a) => a.action_id));
  });

  it('keeps an appropriate action and at least two options', () => {
    for (const event of eventList.events) {
      if (!isCardKind(event) || event.actions.length === 0) continue;
      for (const fan of ['low', 'high'] as const) {
        const ids = offeredActionIds(event, plant({ fan }));
        expect(ids.length, `${event.event_id} fan ${fan}`).toBeGreaterThanOrEqual(Math.min(2, event.actions.length));
        expect(ids.some((id) => findEventAction(event, id)?.verdict === 'appropriate'), event.event_id).toBe(true);
      }
    }
  });

  it('keeps everything when dropping would leave too few options', () => {
    const tip = card('mild_tip_burn');
    const onlyTwo: CardEvent = { ...tip, actions: tip.actions.filter((a) => a.op === 'fan_high' || a.verdict === 'appropriate') };
    expect(offeredActionIds(onlyTwo, plant({ fan: 'high' }))).toEqual(onlyTwo.actions.map((a) => a.action_id));
  });
});

describe('flags', () => {
  it('has no effect when no flag is set', () => {
    expect(activeFlagEffects(eventList, [])).toEqual({
      night_drift: { root_moisture: 0, humidity: 0 },
      blocks_watering: false,
    });
  });

  it('adds the night drift of a set flag from the event list', () => {
    const extra = conditional('fan_off_after_restart').flag_effects?.fan_actually_off.night_drift?.humidity;
    expect(extra).toBeGreaterThan(0);
    expect(activeFlagEffects(eventList, ['fan_actually_off']).night_drift).toEqual({
      root_moisture: 0,
      humidity: extra,
    });
  });

  it('ignores a flag that has no effect entry', () => {
    expect(activeFlagEffects(eventList, ['no_such_flag'])).toEqual(activeFlagEffects(eventList, []));
  });

  it('sets the flags of a conditional event once and none for a scheduled event', () => {
    const fan = card('fan_off_after_restart');
    expect(flagsAfterOccur([], fan)).toEqual(['fan_actually_off']);
    expect(flagsAfterOccur(['fan_actually_off'], fan)).toEqual(['fan_actually_off']);
    expect(flagsAfterOccur(['fan_actually_off'], card('wick_opening'))).toEqual(['fan_actually_off']);
  });

  it('clears a flag only by an action that lists it', () => {
    const fan = card('fan_off_after_restart');
    const check = findEventAction(fan, 'check_fan_running')!;
    const observe = findEventAction(fan, 'keep_observing')!;
    expect(flagsAfterAction(['fan_actually_off', 'water_blocked'], check)).toEqual(['water_blocked']);
    expect(flagsAfterAction(['fan_actually_off'], observe)).toEqual(['fan_actually_off']);
  });
});

describe('records and lookups', () => {
  it('returns the dated track entries of a day, in list order', () => {
    const day7 = trackEntriesOn(eventList, 7);
    expect(day7.map((e) => e.experiment)).toEqual(['VEG-01A', 'VEG-03J']);
    for (const found of day7) {
      const track = eventList.parallel_tracks.find((t) => t.experiment === found.experiment)!;
      const index = track.entries.indexOf(found.entry);
      expect(found.entry_key).toBe(trackEntryKey(found.experiment, found.entry, index));
    }
    expect(trackEntriesOn(eventList, 2)).toEqual([]);
  });

  it('keys a track entry by its entry_id, or by experiment and position without one', () => {
    const entry = { day: 7, source_chunk: 'VEG-03J-06', source_check: 'not_checked' as const };
    expect(trackEntryKey('VEG-03J', entry, 1)).toBe('VEG-03J#1');
    expect(trackEntryKey('VEG-03J', { ...entry, entry_id: 'veg03j_d7' }, 1)).toBe('veg03j_d7');
  });

  it('gives every track entry of the list a different key', () => {
    const keys = eventList.parallel_tracks.flatMap((t) => t.entries.map((e, i) => trackEntryKey(t.experiment, e, i)));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('never returns an undated entry', () => {
    for (let day = 0; day <= 33; day++) {
      for (const found of trackEntriesOn(eventList, day)) expect(found.entry.day).toBe(day);
    }
  });

  it('maps cultivation days to game days', () => {
    expect(gameDayOn(1)).toBe(1);
    expect(gameDayOn(6)).toBe(2);
    expect(gameDayOn(33)).toBe(7);
    expect(gameDayOn(0)).toBeNull();
    expect(gameDayOn(7)).toBeNull();
  });
});
