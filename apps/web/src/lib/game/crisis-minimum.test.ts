import { describe, expect, it } from 'vitest';
import { crisisRequestSchema } from '@/lib/contract/schemas';
import type { CareOp, CrisisRecord, DayRecord, MissionState, PlantState } from '@/lib/contract/types';
import { evidence } from '@/lib/evidence';
import { dayRows } from '@/features/report/view-model';
import { createCrisis } from '@/server/ai/crisis';
import {
  applyCare,
  buildCrisisRequest,
  chooseOption,
  continueAfterResult,
  createMission,
  derivedUnit,
  endDay,
  nextDay,
  planOvernightChange,
  projectMissionNight,
  receiveCrisis,
} from './engine';
import { nextRandom } from './rng';
import {
  cautionMidOf,
  CRISIS_PROBABILITY,
  cultivationDayOf,
  FIRST_CRISIS_DAY,
  INITIAL_PLANT_STATE,
  LAST_CRISIS_DAY,
  METRICS,
  MIN_CRISES_PER_MISSION,
  OVERNIGHT_CHANGE_PROBABILITY,
  sideOf,
  zoneOf,
} from './rules';
import { isMissionState, loadMission, saveMission, type MissionStorage } from './storage';

/**
 * The mission minimum of crises (MIN_CRISES_PER_MISSION): an overnight change
 * moves one watched value into its caution zone on a morning with no candidate.
 */

const WATER = 'water_shortage';
const MOLD = 'overwater_mold';

/** First seed whose first draw satisfies `test`; a mission's first draw comes from its seed. */
function seedWhere(test: (value: number) => boolean): number {
  for (let seed = 1; seed < 10_000; seed++) {
    if (test(nextRandom(seed).value)) return seed;
  }
  throw new Error('no seed found');
}

const LOW_DRAW = seedWhere((v) => v < OVERNIGHT_CHANGE_PROBABILITY);
const HIGH_DRAW = seedWhere((v) => v >= OVERNIGHT_CHANGE_PROBABILITY);

function crisisRecord(crisisId: string): CrisisRecord {
  return { crisis_id: crisisId, name: crisisId, start_stage: 1, max_stage: 1, attempts: [], outcome: 'resolved' };
}

/**
 * A night-phase standard mission on `gameDay` (the next morning is gameDay + 1),
 * with the plant patched and crises on the given earlier days.
 */
function nightOf(
  gameDay: number,
  seed: number,
  patch: Partial<PlantState> = {},
  crises: Record<number, string> = {},
  mode: MissionState['mode'] = 'standard',
): MissionState {
  const base = createMission({ mission_id: 'minimum', mode, seed });
  const plant = { ...base.plant, ...patch };
  const days: DayRecord[] = Array.from({ length: gameDay }, (_, i) => ({
    ...base.days[0],
    game_day: i + 1,
    cultivation_day: cultivationDayOf(i + 1),
    start: plant,
    crisis: crises[i + 1] ? crisisRecord(crises[i + 1]) : null,
  }));
  return { ...base, plant, game_day: gameDay, days, phase: 'night' };
}

function today(state: MissionState): DayRecord {
  return state.days[state.days.length - 1];
}

describe('overnight change for the mission minimum (위기 최소 횟수)', () => {
  it('uses the game values set by the team', () => {
    expect(MIN_CRISES_PER_MISSION).toBe(2);
    expect(OVERNIGHT_CHANGE_PROBABILITY).toBe(0.3);
  });

  it('the caution midpoint comes from the zone boundaries and lies in the caution zone', () => {
    expect(cautionMidOf('root_moisture', 'low')).toBe(33);
    for (const metric of METRICS) {
      for (const side of ['low', 'high'] as const) {
        const zone = zoneOf(metric, cautionMidOf(metric, side));
        expect(zone).toBe(side === 'low' ? 'caution_low' : 'caution_high');
      }
    }
  });

  it('a normal morning gets an overnight change when the draw is below the chance', () => {
    const before = nightOf(1, LOW_DRAW, { root_moisture: 45, humidity: 55 });
    const after = nextDay(before, evidence);
    const change = today(after).overnight_change;
    expect(change).toBeDefined();
    expect(after.phase).toBe('crisis_pending');
    expect(after.active_crisis?.candidates).toEqual([change!.crisis_id]);
  });

  it('a normal morning passes as before when the draw is not below the chance', () => {
    const before = nightOf(1, HIGH_DRAW, { root_moisture: 45 });
    const after = nextDay(before, evidence);
    expect(today(after).overnight_change).toBeUndefined();
    expect(today(after).roll).toEqual({
      candidates: [],
      probability: 0,
      roll: nextRandom(HIGH_DRAW).value,
      occurred: false,
    });
    expect(after.phase).toBe('care');
    expect(after.plant).toEqual(before.plant);
  });

  it('forces the change on the last possible mornings, whatever the draw', () => {
    // Day 5 with no crisis yet: two needed, two mornings left.
    const day5 = nextDay(nightOf(4, HIGH_DRAW), evidence);
    expect(today(day5).overnight_change).toBeDefined();
    expect(today(day5).roll).toMatchObject({ probability: 1, occurred: true });
    // Day 6 with one crisis: one needed, one morning left.
    const day6 = nextDay(nightOf(5, HIGH_DRAW, {}, { 3: WATER }), evidence);
    expect(today(day6).overnight_change).toBeDefined();
    // Day 4 with no crisis: two needed, three mornings left, so the draw decides.
    const day4 = nextDay(nightOf(3, HIGH_DRAW), evidence);
    expect(today(day4).overnight_change).toBeUndefined();
    expect(day4.phase).toBe('care');
  });

  it('a candidate from the state occurs on a forced morning even when the roll fails, with no change', () => {
    const before = nightOf(5, HIGH_DRAW, { root_moisture: 35 }, { 3: MOLD });
    expect(nextRandom(HIGH_DRAW).value).toBeGreaterThanOrEqual(CRISIS_PROBABILITY.caution);
    const after = nextDay(before, evidence);
    expect(today(after).overnight_change).toBeUndefined();
    expect(today(after).roll).toMatchObject({ candidates: [WATER], probability: 1, occurred: true });
    expect(after.plant).toEqual(before.plant);
  });

  it('a candidate from the state keeps its own roll when nothing forces it', () => {
    const before = nightOf(1, HIGH_DRAW, { root_moisture: 35 });
    const after = nextDay(before, evidence);
    expect(today(after).overnight_change).toBeUndefined();
    expect(today(after).roll).toMatchObject({ probability: CRISIS_PROBABILITY.caution, occurred: false });
    expect(after.phase).toBe('care');
  });

  it('with the fan on high only the water shortage can be chosen', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const after = nextDay(nightOf(4, seed, { fan: 'high' }), evidence);
      expect(today(after).overnight_change?.crisis_id).toBe(WATER);
    }
    // Even when the water shortage already occurred.
    expect(planOvernightChange(evidence, { ...INITIAL_PLANT_STATE, fan: 'high' }, [WATER], 0.9)?.crisis_id).toBe(
      WATER,
    );
  });

  it('prefers a crisis that has not occurred yet, and picks with the derived number otherwise', () => {
    const plant = INITIAL_PLANT_STATE;
    for (const pick of [0, 0.49, 0.5, 0.99]) {
      expect(planOvernightChange(evidence, plant, [WATER], pick)?.crisis_id).toBe(MOLD);
      expect(planOvernightChange(evidence, plant, [MOLD], pick)?.crisis_id).toBe(WATER);
    }
    expect(planOvernightChange(evidence, plant, [], 0.1)?.crisis_id).toBe(WATER);
    expect(planOvernightChange(evidence, plant, [], 0.9)?.crisis_id).toBe(MOLD);
    expect(derivedUnit(0.25)).toBeGreaterThanOrEqual(0);
    expect(derivedUnit(0.25)).toBeLessThan(1);
  });

  it('with the fan on high and root moisture high, the water shortage still applies', () => {
    // No candidate (excess water needs the fan on low), so root moisture moves to the low caution band.
    const after = nextDay(nightOf(4, HIGH_DRAW, { fan: 'high', root_moisture: 85 }), evidence);
    expect(today(after).overnight_change).toEqual({ crisis_id: WATER, metric: 'root_moisture', from: 85, to: 33 });
    expect(after.phase).toBe('crisis_pending');
  });

  it('chooses nothing when no crisis can hold after moving one value, and the day passes as before', () => {
    // A list with the excess-water crisis only, and the fan on high: nothing is eligible.
    const moldOnly = { ...evidence, crises: evidence.crises.filter((c) => c.crisis_id === MOLD) };
    const plant = { ...INITIAL_PLANT_STATE, fan: 'high' as const };
    expect(planOvernightChange(moldOnly, plant, [], 0)).toBeNull();
    const after = nextDay(nightOf(4, HIGH_DRAW, { fan: 'high' }), moldOnly);
    expect(today(after).overnight_change).toBeUndefined();
    expect(after.phase).toBe('care');
  });

  it('moves exactly one metric into its caution band; the record, the morning and the roll agree', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const before = nightOf(4, seed, { root_moisture: 50, humidity: 60, plant_health: 64 });
      const after = nextDay(before, evidence);
      const day = today(after);
      const change = day.overnight_change!;
      expect(change).toBeDefined();
      const crisis = evidence.crises.find((c) => c.crisis_id === change.crisis_id)!;
      const condition = crisis.trigger.any_of[0];
      expect(change.metric).toBe(condition.metric);
      expect(change.from).toBe(before.plant[change.metric]);
      expect(change.to).toBe(cautionMidOf(condition.metric, condition.side));
      expect(sideOf(zoneOf(change.metric, change.to))).toBe(condition.side);
      // Only that one metric changed.
      expect(after.plant).toEqual({ ...before.plant, [change.metric]: change.to });
      expect(day.start).toEqual(after.plant);
      const draw = nextRandom(seed);
      expect(day.roll).toEqual({ candidates: [change.crisis_id], probability: 1, roll: draw.value, occurred: true });
      expect(after.rng_state).toBe(draw.state);
      expect(after.active_crisis?.candidates).toEqual([change.crisis_id]);
      // The previous night still holds what it measured.
      expect(after.days[after.days.length - 2]).toEqual(before.days[before.days.length - 1]);
    }
    // On a morning that is not forced the probability is the chance of the change.
    const free = nextDay(nightOf(1, LOW_DRAW), evidence);
    expect(today(free).roll?.probability).toBe(OVERNIGHT_CHANGE_PROBABILITY);
    expect(today(free).roll!.roll).toBeLessThan(today(free).roll!.probability);
  });

  it('after the minimum is reached mornings behave as before', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const after = nextDay(nightOf(5, seed, {}, { 2: WATER, 4: MOLD }), evidence);
      expect(today(after).overnight_change).toBeUndefined();
      expect(after.phase).toBe('care');
      expect(today(after).roll).toMatchObject({ candidates: [], probability: 0, occurred: false });
    }
  });

  it('demo missions are untouched', () => {
    for (let gameDay = FIRST_CRISIS_DAY - 1; gameDay < LAST_CRISIS_DAY; gameDay++) {
      const after = nextDay(nightOf(gameDay, 1, {}, {}, 'demo'), evidence);
      expect(today(after).overnight_change).toBeUndefined();
      expect(after.phase).toBe('care');
    }
  });

  /** The night before `gameDay + 1` with a timeline that has reached that morning's cultivation day. */
  function timelineNightOf(gameDay: number, seed: number, mode: MissionState['mode']): MissionState {
    const started = createMission({ mission_id: 'timeline', mode, seed, timeline: true });
    return {
      ...nightOf(gameDay, seed, {}, {}, mode),
      schema_version: 2,
      timeline: {
        ...started.timeline!,
        cultivation_day: cultivationDayOf(gameDay + 1),
        status: 'milestone',
        pending_event: null,
      },
    };
  }

  it('applies to standard missions with the timeline (50 seeds)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      // Day 5 with no crisis yet: two needed, two mornings left, so the change is forced.
      const night = timelineNightOf(4, seed, 'standard');
      const after = nextDay(night, evidence);
      const change = today(after).overnight_change!;
      expect(change).toBeDefined();
      expect(after.phase).toBe('crisis_pending');
      expect(after.active_crisis?.candidates).toEqual([change.crisis_id]);
      expect(after.plant).toEqual({ ...night.plant, [change.metric]: change.to });
      expect(today(after).start).toEqual(after.plant);
      // The timeline itself is not touched by the change.
      expect(after.timeline).toEqual({ ...night.timeline, status: 'milestone' });
    }
  });

  it('demo missions with the timeline are untouched', () => {
    for (let gameDay = FIRST_CRISIS_DAY - 1; gameDay < LAST_CRISIS_DAY; gameDay++) {
      const after = nextDay(timelineNightOf(gameDay, 1, 'demo'), evidence);
      expect(today(after).overnight_change).toBeUndefined();
      expect(after.phase).toBe('care');
    }
  });

  it('a mission saved before this rule (no overnight_change field) loads and continues', () => {
    const saved = nightOf(3, LOW_DRAW);
    const json = JSON.stringify(saved);
    expect(json).not.toContain('overnight_change');
    const store = new Map<string, string>();
    const storage: MissionStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => void store.delete(k),
    };
    expect(saveMission(storage, JSON.parse(json))).toBe(true);
    const loaded = loadMission(storage);
    expect(loaded).not.toBeNull();
    const after = nextDay(loaded!, evidence);
    expect(after.game_day).toBe(4);
    // A save with the new field also passes the shape check.
    expect(isMissionState(JSON.parse(JSON.stringify(after)))).toBe(true);
    // The report's cultivation record shows the change on its day only.
    const rows = dayRows(after);
    expect(rows.slice(0, -1).every((row) => row.overnightChange === null)).toBe(true);
    expect(rows[rows.length - 1].overnightChange).toEqual(today(after).overnight_change);
  });
});

// ---------------------------------------------------------------------------
// End to end through the crisis pipeline (the function POST /api/crisis wraps)
// ---------------------------------------------------------------------------

async function presentCrisis(state: MissionState): Promise<MissionState> {
  const request = crisisRequestSchema.parse(JSON.parse(JSON.stringify(buildCrisisRequest(state, 'en'))));
  const response = await createCrisis(request);
  return receiveCrisis(state, response, evidence);
}

describe('overnight change through the crisis pipeline', () => {
  it('the server accepts the changed morning and the crisis starts at stage 1', async () => {
    const seen = new Set<string>();
    for (const fan of ['low', 'high'] as const) {
      for (let seed = 1; seed <= 20; seed++) {
        // From the normal start state, walk to the first morning with an overnight change.
        let m = createMission({ mission_id: 'e2e', mode: 'standard', seed });
        if (fan === 'high') m = applyCare(m, { kind: 'fan', level: 'high' });
        m = { ...m, plant: { ...m.plant, root_moisture: 55, humidity: 55 } };
        while (m.phase === 'care') {
          m = nextDay(endDay({ ...m, plant: { ...m.plant, root_moisture: 55, humidity: 55 } }), evidence);
        }
        expect(m.phase).toBe('crisis_pending');
        const change = today(m).overnight_change!;
        expect(change).toBeDefined();
        const shown = await presentCrisis(m);
        expect(shown.phase).toBe('crisis');
        expect(shown.active_crisis?.crisis_id).toBe(change.crisis_id);
        expect(shown.active_crisis?.stage).toBe(1);
        expect(today(shown).crisis?.start_stage).toBe(1);
        seen.add(change.crisis_id);
      }
    }
    expect([...seen].sort()).toEqual([MOLD, WATER]);
  });
});

// ---------------------------------------------------------------------------
// Seed sweeps: every mission that reaches harvest has the minimum of crises
// ---------------------------------------------------------------------------

const CARE_PLANS: CareOp[][] = [
  [],
  [{ kind: 'water', level: 'normal' }],
  [{ kind: 'water', level: 'heavy' }],
  [{ kind: 'water', level: 'normal' }, { kind: 'water', level: 'normal' }],
  [{ kind: 'water', level: 'heavy' }, { kind: 'water', level: 'normal' }],
  [{ kind: 'water', level: 'heavy' }, { kind: 'water', level: 'heavy' }],
];

/** Care that keeps both values normal after tonight, from the engine's own forecast. */
function carefulCare(state: MissionState): MissionState {
  const other = state.plant.fan === 'low' ? 'high' : 'low';
  const plans: CareOp[][] = [
    ...CARE_PLANS,
    ...CARE_PLANS.slice(0, 3).map((ops): CareOp[] => [{ kind: 'fan', level: other }, ...ops]),
  ];
  for (const ops of plans) {
    let next = state;
    for (const op of ops) next = applyCare(next, op);
    const zones = projectMissionNight(next).zones;
    if (METRICS.every((m) => zones[m] === 'normal')) return next;
  }
  return state;
}

type Policy = (state: MissionState) => MissionState;

/** Play a standard mission to harvest; every crisis is answered with its appropriate action. */
async function play(seed: number, care: Policy): Promise<MissionState> {
  let m = createMission({ mission_id: `sweep-${seed}`, mode: 'standard', seed });
  for (let guard = 0; guard < 60; guard++) {
    if (m.phase === 'care') m = endDay(care(m));
    else if (m.phase === 'night') m = nextDay(m, evidence);
    else if (m.phase === 'crisis_pending') m = await presentCrisis(m);
    else if (m.phase === 'crisis') {
      const fix = m.active_crisis!.response!.options.find((o) => o.verdict === 'appropriate')!;
      m = chooseOption(m, fix.action_id, evidence);
    } else if (m.phase === 'crisis_result') m = continueAfterResult(m, evidence);
    else break;
  }
  return m;
}

async function sweep(care: Policy) {
  const counts: Record<number, number> = {};
  const days: Record<number, number> = {};
  let harvested = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const m = await play(seed, care);
    if (m.phase !== 'harvest') continue;
    harvested += 1;
    const crisisDays = m.days.filter((d) => d.crisis).map((d) => d.game_day);
    expect(crisisDays.length).toBeGreaterThanOrEqual(MIN_CRISES_PER_MISSION);
    counts[crisisDays.length] = (counts[crisisDays.length] ?? 0) + 1;
    for (const d of crisisDays) days[d] = (days[d] ?? 0) + 1;
  }
  return { harvested, counts, days };
}

describe('seed sweeps (300 standard missions each)', () => {
  it('a careful player meets at least the minimum of crises, on spread days', async () => {
    const result = await sweep(carefulCare);
    expect(result.harvested).toBe(300);
    // Crises do not all fall on the last two mornings.
    for (let day = FIRST_CRISIS_DAY; day <= LAST_CRISIS_DAY; day++) expect(result.days[day] ?? 0).toBeGreaterThan(0);
  });

  it('a player who keeps the fan on high and overwaters also meets at least the minimum', async () => {
    const overwater: Policy = (m) => {
      if (m.plant.fan === 'low') m = applyCare(m, { kind: 'fan', level: 'high' });
      while (m.care_ops_used < 2) m = applyCare(m, { kind: 'water', level: 'heavy' });
      return m;
    };
    const result = await sweep(overwater);
    expect(result.harvested).toBeGreaterThan(0);
  });

  it('a player who does nothing also meets at least the minimum', async () => {
    const result = await sweep((m) => m);
    expect(result.harvested).toBeGreaterThan(0);
  });
});
