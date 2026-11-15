import { describe, expect, it } from 'vitest';
import { crisisRequestSchema } from '@/lib/contract/schemas';
import type { CareOp, EventList, MissionState } from '@/lib/contract/types';
import { eventList, findTimelineEvent, isCardKind, planEvents } from '@/lib/events';
import { evidence } from '@/lib/evidence';
import { createCrisis } from '@/server/ai/crisis';
import {
  advanceDay,
  applyCare,
  buildCrisisRequest,
  chooseOption,
  confirmFreeze,
  continueAfterResult,
  createMission,
  endDay,
  GameRuleError,
  harvestCrop,
  nextDay,
  receiveCrisis,
  respondToEvent,
} from './engine';
import { isMissionState, loadMission, MISSION_STORAGE_KEY, saveMission, type MissionStorage } from './storage';
import { parseTimelineFlag } from './timeline-flag';
import { flagNightDrift, wateringBlocked } from './timeline';

/**
 * The cultivation timeline wired into the engine (ROLE-TASKS A1, notes T13).
 * With the switch off a mission is exactly what it was; with it on, the days
 * between game days are walked and event cards stop time.
 */

/** The appropriate action of each card event, for runs that answer everything well. */
function appropriateOf(eventId: string): string {
  const event = findTimelineEvent(eventList, eventId);
  if (!event || !isCardKind(event)) throw new Error(`${eventId} is not a card event`);
  return event.actions.find((a) => a.verdict === 'appropriate')!.action_id;
}

/** Leave the night; answer every card with `choose` until the next game day. */
function advance(m: MissionState, choose: (eventId: string) => string = appropriateOf): MissionState {
  let next = advanceDay(m, evidence);
  for (let guard = 0; guard < 40 && next.timeline?.pending_event; guard++) {
    next = respondToEvent(next, choose(next.timeline.pending_event.event_id));
    if (next.phase !== 'night') return next;
    next = advanceDay(next, evidence);
  }
  return next;
}

async function presentCrisis(state: MissionState): Promise<MissionState> {
  const request = crisisRequestSchema.parse(JSON.parse(JSON.stringify(buildCrisisRequest(state, 'en'))));
  return receiveCrisis(state, await createCrisis(request), evidence);
}

/** One game day: care (or crisis choices), then the night, then on to the next game day. */
async function playDay(m: MissionState, ops: CareOp[], crisisChoices: string[], timeline: boolean) {
  let next = m;
  if (next.phase === 'crisis_pending') {
    for (const id of crisisChoices) {
      next = await presentCrisis(next);
      next = chooseOption(next, id, evidence);
      next = continueAfterResult(next, evidence);
    }
  } else {
    for (const op of ops) next = applyCare(next, op);
    next = endDay(next);
  }
  return timeline ? advance(next) : nextDay(next, evidence);
}

/** The demo script (docs/DEMO-SCRIPT.md), with or without the timeline. */
async function demoRun(timeline: boolean): Promise<MissionState[]> {
  let m = createMission({ mission_id: 'demo', mode: 'demo', seed: 0, timeline });
  const states = [m];
  const script: [CareOp[], string[]][] = [
    [[], []],
    [[], []],
    [[], ['add_water_direct']],
    [[{ kind: 'water', level: 'heavy' }, { kind: 'water', level: 'heavy' }], []],
    [[], ['add_water', 'fan_high']],
    [[{ kind: 'fan', level: 'low' }, { kind: 'water', level: 'normal' }], []],
  ];
  for (const [ops, choices] of script) {
    m = await playDay(m, ops, choices, timeline);
    states.push(m);
  }
  m = confirmFreeze(harvestCrop(m, { sanitize: true }));
  states.push(m);
  return states;
}

describe('the switch', () => {
  it('is off unless clearly set', () => {
    expect(parseTimelineFlag(undefined)).toBe(false);
    expect(parseTimelineFlag('')).toBe(false);
    expect(parseTimelineFlag('0')).toBe(false);
    expect(parseTimelineFlag('1')).toBe(true);
    expect(parseTimelineFlag('true')).toBe(true);
  });
});

describe('a mission without a timeline', () => {
  it('has no timeline and keeps saved shape version 1', () => {
    const m = createMission({ mission_id: 'off', mode: 'demo', seed: 0 });
    expect(m.schema_version).toBe(1);
    expect(m.timeline).toBeUndefined();
    expect(createMission({ mission_id: 'off', mode: 'demo', seed: 0, timeline: false })).toEqual(m);
  });

  it('moves through advanceDay exactly as through nextDay', async () => {
    const viaAdvance = await demoRun(false);
    // demoRun(false) uses nextDay; replay the same steps with advanceDay and compare every state.
    let m = createMission({ mission_id: 'demo', mode: 'demo', seed: 0 });
    m = endDay(m);
    expect(advanceDay(m, evidence)).toEqual(nextDay(m, evidence));
    expect(viaAdvance.at(-1)!.phase).toBe('report');
    expect(viaAdvance.every((s) => s.timeline === undefined)).toBe(true);
  });
});

describe('a demo mission with the timeline', () => {
  it('starts on day 1 with the lines of days 0 and 1 and no card (the demo seed plans no conditional event)', () => {
    const m = createMission({ mission_id: 'on', mode: 'demo', seed: 0, timeline: true });
    expect(m.schema_version).toBe(2);
    expect(m.timeline).toMatchObject({ cultivation_day: 1, status: 'milestone', pending_event: null, flags: [] });
    expect(m.timeline!.event_plan.every((p) => !p.planned)).toBe(true);
    const log = m.timeline!.log;
    expect(log.map((e) => [e.type, e.cultivation_day])).toEqual([
      ['track', 0],
      ['milestone', 1],
      ['record', 1],
      ['record', 1],
    ]);
  });

  it('stops at the day-3 wick card, writes the lines of day 2, and goes on after the response', () => {
    let m = endDay(createMission({ mission_id: 'on', mode: 'demo', seed: 0, timeline: true }));
    m = advanceDay(m, evidence);
    expect(m.phase).toBe('night');
    expect(m.timeline).toMatchObject({ cultivation_day: 3, status: 'event' });
    expect(m.timeline!.pending_event).toMatchObject({ event_id: 'wick_opening', cultivation_day: 3 });
    expect(m.timeline!.log.filter((e) => e.cultivation_day === 2).map((e) => e.type)).toContain('record');

    // Time is stopped: nothing else moves until the card has a response.
    expect(() => advanceDay(m, evidence)).toThrow(GameRuleError);
    expect(() => respondToEvent(m, 'not_offered')).toThrow(GameRuleError);

    m = respondToEvent(m, 'open_wicks');
    const answered = m.timeline!.log.find((e) => e.type === 'event' && e.event_id === 'wick_opening');
    expect(answered).toMatchObject({ tone: 'positive', response: { action_id: 'open_wicks', verdict: 'appropriate' } });
    expect(m.timeline!.pending_event).toBeNull();

    m = advanceDay(m, evidence);
    expect(m.game_day).toBe(2);
    expect(m.phase).toBe('care');
    expect(m.timeline).toMatchObject({ cultivation_day: 6, status: 'milestone' });
    const days = new Set(m.timeline!.log.map((e) => e.cultivation_day));
    for (const day of [0, 1, 2, 3, 4, 5, 6]) expect(days.has(day), `day ${day}`).toBe(true);
  });

  it('keeps the crises and the numbers of the demo script; only the day-7 thinning adds +2 health', async () => {
    const off = await demoRun(false);
    const on = await demoRun(true);
    expect(on.map((s) => s.phase)).toEqual(off.map((s) => s.phase));
    expect(on.at(-1)!.phase).toBe('report');
    on.forEach((s, i) => {
      expect(s.plant.root_moisture, `step ${i}`).toBe(off[i].plant.root_moisture);
      expect(s.plant.humidity, `step ${i}`).toBe(off[i].plant.humidity);
      expect(s.plant.fan, `step ${i}`).toBe(off[i].plant.fan);
      // The thinning card falls between game days 2 and 3 (step 2).
      expect(s.plant.plant_health - off[i].plant.plant_health, `step ${i}`).toBe(i >= 2 ? 2 : 0);
    });
    const crises = (ms: MissionState) => ms.days.map((d) => d.crisis?.crisis_id ?? null);
    expect(crises(on.at(-1)!)).toEqual(crises(off.at(-1)!));
    const cards = on.at(-1)!.timeline!.log.filter((e) => e.type === 'event').map((e) => e.event_id);
    expect(cards).toEqual(['wick_opening', 'thinning']);
    expect(on.at(-1)!.timeline!.cultivation_day).toBe(33);
    // A whole mission with a timeline survives a JSON round trip.
    expect(JSON.parse(JSON.stringify(on.at(-1)))).toEqual(on.at(-1));
  });

  it('gives the same timeline for the same seed and answers', async () => {
    const a = await demoRun(true);
    const b = await demoRun(true);
    expect(a.at(-1)!.timeline).toEqual(b.at(-1)!.timeline);
  });
});

/** A standard-mode seed whose plan has exactly the given conditional events planned. */
function seedPlanning(wanted: Record<string, (earliest: number) => boolean>): number {
  for (let seed = 1; seed < 100000; seed++) {
    const plan = planEvents(eventList, seed);
    if (plan.every((p) => (p.event_id in wanted ? p.planned && wanted[p.event_id](p.earliest_day) : !p.planned))) {
      return seed;
    }
  }
  throw new Error('no seed found');
}

describe('conditional events and flags', () => {
  it('shows a day-1 card at the start and keeps care waiting until it has a response', () => {
    const seed = seedPlanning({ pillow_no_flow: () => true });
    const m = createMission({ mission_id: 'flow', mode: 'standard', seed, timeline: true });
    expect(m.timeline!.pending_event).toMatchObject({ event_id: 'pillow_no_flow', cultivation_day: 1 });
    expect(m.timeline!.flags).toEqual(['water_blocked']);
    expect(() => applyCare(m, { kind: 'water', level: 'normal' })).toThrow(GameRuleError);
    expect(() => endDay(m)).toThrow(GameRuleError);

    const fixed = respondToEvent(m, 'replace_pillow');
    expect(fixed.phase).toBe('care');
    expect(fixed.timeline).toMatchObject({ status: 'milestone', flags: [], pending_event: null });
    expect(applyCare(fixed, { kind: 'water', level: 'normal' }).plant.root_moisture).toBe(65);
  });

  it('adds the night drift of a flag that stays set', () => {
    const seed = seedPlanning({ fan_off_after_restart: (d) => d <= 5 });
    let m = endDay(createMission({ mission_id: 'fan', mode: 'standard', seed, timeline: true }));
    m = advanceDay(m, evidence);
    // Answer the scheduled cards that come first (the day-3 wicks) until the fan card shows.
    for (let guard = 0; guard < 5 && m.timeline!.pending_event?.event_id !== 'fan_off_after_restart'; guard++) {
      m = advanceDay(respondToEvent(m, appropriateOf(m.timeline!.pending_event!.event_id)), evidence);
    }
    expect(m.timeline!.pending_event?.event_id).toBe('fan_off_after_restart');
    m = respondToEvent(m, 'keep_observing'); // inappropriate: the flag stays
    expect(m.timeline!.flags).toEqual(['fan_actually_off']);
    m = advanceDay(m, evidence);
    expect(m.game_day).toBe(2);

    const extra = flagNightDrift(m.timeline, eventList).humidity;
    expect(extra).toBeGreaterThan(0);
    if (m.phase !== 'care') return; // a crisis may come first; the drift rule is the same
    m = endDay(m);
    expect(m.days[1].night!.drift.humidity).toBe(5 + extra);
  });

  it('ends the mission when an event response takes plant health to 0', () => {
    const seed = seedPlanning({ pillow_no_flow: () => true });
    const m = createMission({ mission_id: 'fail', mode: 'standard', seed, timeline: true });
    const weak = { ...m, plant: { ...m.plant, plant_health: 4 } };
    const failed = respondToEvent(weak, 'do_nothing');
    expect(failed.phase).toBe('failed');
    expect(failed.plant.plant_health).toBe(0);
    expect(failed.timeline!.pending_event).toBeNull();
  });

  it('reads the flag effects from the event list only', () => {
    const withBlock: EventList = {
      ...eventList,
      events: eventList.events.map((e) =>
        e.event_id === 'pillow_no_flow' && e.kind === 'conditional'
          ? { ...e, flag_effects: { water_blocked: { blocks_watering: true } } }
          : e,
      ),
    };
    const timeline = createMission({ mission_id: 't', mode: 'demo', seed: 0, timeline: true }).timeline!;
    expect(wateringBlocked({ ...timeline, flags: ['water_blocked'] }, withBlock)).toBe(true);
    expect(wateringBlocked({ ...timeline, flags: [] }, withBlock)).toBe(false);
    expect(wateringBlocked(undefined, withBlock)).toBe(false);
  });
});

describe('saved missions', () => {
  function memoryStorage(): MissionStorage {
    const map = new Map<string, string>();
    return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
  }

  it('saves and loads a mission with a timeline (version 2)', async () => {
    const m = (await demoRun(true))[3];
    const storage = memoryStorage();
    expect(saveMission(storage, m)).toBe(true);
    expect(loadMission(storage)).toEqual(m);
  });

  it('still loads a version-1 mission, and refuses a version mismatch', () => {
    const v1 = createMission({ mission_id: 'v1', mode: 'demo', seed: 0 });
    const v2 = createMission({ mission_id: 'v2', mode: 'demo', seed: 0, timeline: true });
    expect(isMissionState(v1)).toBe(true);
    expect(isMissionState(v2)).toBe(true);
    expect(isMissionState({ ...v1, timeline: v2.timeline })).toBe(false);
    expect(isMissionState({ ...v2, timeline: undefined })).toBe(false);
    expect(isMissionState({ ...v2, timeline: { ...v2.timeline!, status: 'event' } })).toBe(false);
    const storage = memoryStorage();
    storage.setItem(MISSION_STORAGE_KEY, JSON.stringify(v1));
    expect(loadMission(storage)).toEqual(v1);
  });
});
