import { describe, expect, it } from 'vitest';
import type {
  ConditionalTimelineEvent,
  EventList,
  PlannedEvent,
  PlantState,
} from '@/lib/contract/types';
import { nextRandom } from '@/lib/game/rng';
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
  nextEventOn,
  planEvent,
  planEvents,
  trackEntriesOn,
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
  if (!event || event.kind === 'crisis') throw new Error(`${id} is not a card event`);
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
  it('returns the dated track entries of a day with stable keys', () => {
    const day7 = trackEntriesOn(eventList, 7);
    expect(day7.map((e) => e.entry_key)).toEqual(['VEG-01A#1', 'VEG-03J#1']);
    expect(trackEntriesOn(eventList, 2)).toEqual([]);
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
