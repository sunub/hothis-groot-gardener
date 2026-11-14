import { describe, expect, it } from 'vitest';
import { crisisRequestSchema } from '@/lib/contract/schemas';
import type {
  CrisisRecord,
  CrisisResponse,
  EvidenceAction,
  EvidenceCrisis,
  DayRecord,
  MissionState,
  NightRecord,
  PlantState,
  Zone,
} from '@/lib/contract/types';
import { evidence, findAction, findCrisis } from '@/lib/evidence';
import {
  applyCare,
  buildCrisisRequest,
  chooseOption,
  classifyMicrobial,
  computeMicrobial,
  computeReportMetrics,
  confirmFreeze,
  continueAfterResult,
  createMission,
  endDay,
  GameRuleError,
  harvestCrop,
  nextDay,
  projectNight,
  receiveCrisis,
} from './engine';
import { nextRandom } from './rng';
import {
  CRISIS_PROBABILITY,
  CULTIVATION_DAYS,
  DEMO_SEED,
  FIRST_CRISIS_DAY,
  GAME_DAYS,
  GROUND_SUPPORT_HEALTH,
  GROWTH_STAGES,
  INITIAL_PLANT_STATE,
  LAST_CRISIS_DAY,
  MAX_CARE_OPS_PER_DAY,
  MICROBIAL,
  NIGHT_DRIFT,
  NIGHT_HEALTH,
  NORMAL_MID,
  SANITIZE_ACTION_ID,
  WATER_AMOUNT,
} from './rules';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const WATER = 'water_shortage';
const MOLD = 'overwater_mold';

function requireCrisis(crisisId: string): EvidenceCrisis {
  const crisis = findCrisis(evidence, crisisId);
  if (!crisis) throw new Error(`unknown crisis ${crisisId}`);
  return crisis;
}

/** Action ids come from the evidence list by role, so renamed ids do not break the tests. */
function actionWhere(crisisId: string, test: (a: EvidenceAction) => boolean): string {
  const action = requireCrisis(crisisId).actions.find(test);
  if (!action) throw new Error(`no matching action in ${crisisId}`);
  return action.action_id;
}

/** Water shortage: the appropriate fix (to_mid, +5). */
const W_FIX = actionWhere(WATER, (a) => a.verdict === 'appropriate');
/** Water shortage: the partial fix (half_to_mid). */
const W_HALF = actionWhere(WATER, (a) => a.verdict === 'partial');
/** Water shortage: inappropriate, root moisture -10, fan unchanged. */
const W_WAIT = actionWhere(WATER, (a) => a.verdict === 'inappropriate' && a.delta.fan === undefined);
/** Water shortage: inappropriate, root moisture -10, fan high. */
const W_FAN = actionWhere(WATER, (a) => a.verdict === 'inappropriate' && a.delta.fan === 'high');
/** Overwater and mold: the appropriate fix (fan high, both to_mid). */
const M_FIX = actionWhere(MOLD, (a) => a.verdict === 'appropriate');
/** Overwater and mold: inappropriate, adds water. */
const M_WATER = actionWhere(
  MOLD,
  (a) => a.verdict === 'inappropriate' && typeof a.delta.root_moisture === 'number' && a.delta.root_moisture > 0,
);

function mission(seed = 7): MissionState {
  return createMission({ mission_id: 'test-mission', mode: 'standard', seed });
}

function withPlant(state: MissionState, patch: Partial<PlantState>): MissionState {
  return { ...state, plant: { ...state.plant, ...patch } };
}

/** A night-phase mission on the given day whose next morning starts with this plant. */
function nightBefore(
  patch: Partial<PlantState>,
  extra: Partial<MissionState> = {},
  seed = 7,
): MissionState {
  const base = mission(seed);
  return { ...withPlant(base, patch), ...extra, phase: 'night' };
}

/** Same day count as `nextDay` would make, without rolling: a care-phase next day. */
function skipToCare(state: MissionState): MissionState {
  const gameDay = state.game_day + 1;
  const day: DayRecord = {
    game_day: gameDay,
    cultivation_day: CULTIVATION_DAYS[gameDay - 1],
    growth_stage: GROWTH_STAGES[gameDay - 1],
    start: state.plant,
    roll: null,
    care: [],
    crisis: null,
    night: null,
  };
  return { ...state, phase: 'care', game_day: gameDay, care_ops_used: 0, days: [...state.days, day] };
}

/** Crisis response built from the evidence list: every action of the crisis is an option. */
function responseFor(crisisId: string, stage = 1, attempt = 1): CrisisResponse {
  const crisis = findCrisis(evidence, crisisId);
  if (!crisis) throw new Error(`unknown crisis ${crisisId}`);
  return {
    crisis_id: crisis.crisis_id,
    name: crisis.name,
    stage,
    attempt,
    scene: 'scene',
    plant_line: 'plant line',
    clues: [{ symptom_id: crisis.symptoms[0].symptom_id, text: 'clue' }],
    options: crisis.actions.map((a) => ({
      action_id: a.action_id,
      label: `label ${a.action_id}`,
      result_line: 'result',
      why: 'why',
      verdict: a.verdict,
      reason: a.reason,
      delta: a.delta,
      value_type: a.value_type,
      source: a.source,
    })),
    record_note: '',
    crisis_source: crisis.source,
    origin: 'fallback',
  };
}

/** Mission in crisis_pending on game day 2 (a danger zone makes the crisis certain). */
function pending(patch: Partial<PlantState>, extra: Partial<MissionState> = {}): MissionState {
  const next = nextDay(nightBefore(patch, extra), evidence);
  if (next.phase !== 'crisis_pending') throw new Error(`expected crisis_pending, got ${next.phase}`);
  return next;
}

function present(state: MissionState, crisisId?: string): MissionState {
  const id = crisisId ?? state.active_crisis?.candidates[0];
  if (!id) throw new Error('no candidate');
  return receiveCrisis(state, responseFor(id), evidence);
}

function choose(state: MissionState, actionId: string): MissionState {
  return chooseOption(state, actionId, evidence);
}

function today(state: MissionState): DayRecord {
  return state.days[state.days.length - 1];
}

function todayCrisis(state: MissionState): CrisisRecord {
  const crisis = today(state).crisis;
  if (!crisis) throw new Error('no crisis record');
  return crisis;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function night(humidity: Zone, rootMoisture: Zone = 'normal'): NightRecord {
  return {
    drift: { root_moisture: 0, humidity: 0 },
    zones: { root_moisture: rootMoisture, humidity },
    health_change: 0,
    end: INITIAL_PLANT_STATE,
  };
}

/** Cultivation record with the given nights and crises, for the microbial and report rules. */
function recordWith(nights: NightRecord[], crises: (CrisisRecord | null)[] = []): MissionState {
  const base = mission();
  const days: DayRecord[] = nights.map((n, i) => ({
    ...base.days[0],
    game_day: i + 1,
    cultivation_day: CULTIVATION_DAYS[i],
    growth_stage: GROWTH_STAGES[i],
    night: n,
    crisis: crises[i] ?? null,
  }));
  return { ...base, days };
}

function moldRecord(
  patch: Partial<CrisisRecord>,
  attempts: { action_id: string; verdict: 'appropriate' | 'partial' | 'inappropriate' }[] = [],
): CrisisRecord {
  return {
    crisis_id: MOLD,
    name: 'mold',
    start_stage: 1,
    max_stage: 1,
    outcome: 'resolved',
    attempts: attempts.map((a, i) => ({
      attempt: i + 1,
      stage: 1,
      offered_action_ids: [],
      action_id: a.action_id,
      label: a.action_id,
      verdict: a.verdict,
      delta: {},
      before: INITIAL_PLANT_STATE,
      after: INITIAL_PLANT_STATE,
      ground_support: false,
    })),
    ...patch,
  };
}

function factor(state: MissionState, key: string, sanitize = false) {
  const found = computeMicrobial(state, sanitize).factors.find((f) => f.key === key);
  if (!found) throw new Error(`missing factor ${key}`);
  return found;
}

// ---------------------------------------------------------------------------
// 임무 길이와 날짜
// ---------------------------------------------------------------------------

describe('mission length and dates (임무 길이와 날짜)', () => {
  it('starts on game day 1 in daily care with an empty record', () => {
    const m = mission(99);
    expect(m.schema_version).toBe(1);
    expect(m.game_day).toBe(1);
    expect(m.phase).toBe('care');
    expect(m.seed).toBe(99);
    expect(m.rng_state).toBe(99);
    expect(m.care_ops_used).toBe(0);
    expect(m.danger_days).toEqual({ root_moisture: 0, humidity: 0 });
    expect(m.recurrence).toBeNull();
    expect(m.active_crisis).toBeNull();
    expect(m.harvest).toBeNull();
    expect(m.days).toEqual([
      {
        game_day: 1,
        cultivation_day: 1,
        growth_stage: 'germination',
        start: INITIAL_PLANT_STATE,
        roll: null,
        care: [],
        crisis: null,
        night: null,
      },
    ]);
  });

  it('copies the start values instead of sharing them', () => {
    const m = mission();
    expect(m.plant).toEqual(INITIAL_PLANT_STATE);
    expect(m.plant).not.toBe(INITIAL_PLANT_STATE);
    expect(m.plant.light).not.toBe(INITIAL_PLANT_STATE.light);
  });

  it('demo mode always uses the fixed seed', () => {
    const m = createMission({ mission_id: 'demo', mode: 'demo', seed: 123456 });
    expect(m.mode).toBe('demo');
    expect(m.seed).toBe(DEMO_SEED);
    expect(m.rng_state).toBe(DEMO_SEED);
  });

  it('day 1 has no crisis roll', () => {
    expect(mission().days[0].roll).toBeNull();
  });

  it('records cultivation day and growth stage for each game day', () => {
    let m = endDay(mission());
    for (let day = 2; day <= GAME_DAYS; day++) {
      // Keep the plant normal so no crisis interrupts the walk.
      m = nextDay(withPlant(m, { root_moisture: 55, humidity: 55 }), evidence);
      expect(m.game_day).toBe(day);
      expect(today(m).cultivation_day).toBe(CULTIVATION_DAYS[day - 1]);
      expect(today(m).growth_stage).toBe(GROWTH_STAGES[day - 1]);
      if (day < GAME_DAYS) {
        expect(m.phase).toBe('care');
        m = endDay(m);
      }
    }
    expect(m.days).toHaveLength(GAME_DAYS);
    expect(CULTIVATION_DAYS).toEqual([1, 6, 12, 17, 22, 28, 33]);
  });

  it('crises are rolled on days 2-6 only: day 7 goes straight to harvest without drawing', () => {
    const day6 = { ...nightBefore({ root_moisture: 10 }), game_day: LAST_CRISIS_DAY };
    const day7 = nextDay(day6, evidence);
    expect(day7.game_day).toBe(GAME_DAYS);
    expect(day7.phase).toBe('harvest');
    expect(today(day7).roll).toBeNull();
    expect(day7.rng_state).toBe(day6.rng_state);
    expect(day7.active_crisis).toBeNull();
  });

  it('draws exactly one number on each crisis day, even without candidates', () => {
    for (let day = FIRST_CRISIS_DAY - 1; day < LAST_CRISIS_DAY; day++) {
      const before = { ...nightBefore({}), game_day: day };
      const after = nextDay(before, evidence);
      const expected = nextRandom(before.rng_state);
      expect(after.rng_state).toBe(expected.state);
      expect(today(after).roll).toEqual({
        candidates: [],
        probability: 0,
        roll: expected.value,
        occurred: false,
      });
      expect(after.phase).toBe('care');
    }
  });

  it('starts each day with fresh care ops and the current plant as the start state', () => {
    const m = applyCare(mission(), { kind: 'water', level: 'normal' });
    const next = nextDay(endDay(m), evidence);
    expect(next.care_ops_used).toBe(0);
    expect(today(next).start).toEqual(next.plant);
    expect(today(next).care).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 시작값과 상태 구간
// ---------------------------------------------------------------------------

describe('start values and zones (시작값과 상태 구간)', () => {
  it('starts with health 70, root moisture 55, humidity 55, fan low', () => {
    const { plant } = mission();
    expect(plant.plant_health).toBe(70);
    expect(plant.root_moisture).toBe(55);
    expect(plant.humidity).toBe(55);
    expect(plant.fan).toBe('low');
  });

  it('keeps metrics within 0-100', () => {
    const high = applyCare(
      applyCare(withPlant(mission(), { root_moisture: 90 }), { kind: 'water', level: 'heavy' }),
      { kind: 'water', level: 'heavy' },
    );
    expect(high.plant.root_moisture).toBe(100);
    const low = endDay(withPlant(mission(), { root_moisture: 3, fan: 'high', humidity: 4 }));
    expect(low.plant.root_moisture).toBe(0);
    expect(low.plant.humidity).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 하루 진행과 일상 돌봄
// ---------------------------------------------------------------------------

describe('day progress and daily care (하루 진행과 일상 돌봄)', () => {
  it('overnight with fan low: root moisture -10, humidity +5', () => {
    const m = endDay(mission());
    expect(NIGHT_DRIFT.low).toEqual({ root_moisture: -10, humidity: 5 });
    expect(m.plant.root_moisture).toBe(45);
    expect(m.plant.humidity).toBe(60);
    expect(today(m).night?.drift).toEqual({ root_moisture: -10, humidity: 5 });
  });

  it('overnight with fan high: root moisture -15, humidity -10', () => {
    const m = endDay(applyCare(mission(), { kind: 'fan', level: 'high' }));
    expect(NIGHT_DRIFT.high).toEqual({ root_moisture: -15, humidity: -10 });
    expect(m.plant.root_moisture).toBe(40);
    expect(m.plant.humidity).toBe(45);
  });

  it('the fan setting stays until it is changed', () => {
    const m = endDay(applyCare(mission(), { kind: 'fan', level: 'high' }));
    const next = nextDay(m, evidence);
    expect(next.plant.fan).toBe('high');
    expect(today(next).start.fan).toBe('high');
  });

  it('watering adds normal +10 and heavy +20', () => {
    expect(WATER_AMOUNT).toEqual({ normal: 10, heavy: 20 });
    expect(applyCare(mission(), { kind: 'water', level: 'normal' }).plant.root_moisture).toBe(65);
    expect(applyCare(mission(), { kind: 'water', level: 'heavy' }).plant.root_moisture).toBe(75);
  });

  it(`allows at most ${MAX_CARE_OPS_PER_DAY} operations per day`, () => {
    const two = applyCare(applyCare(mission(), { kind: 'water', level: 'normal' }), {
      kind: 'fan',
      level: 'high',
    });
    expect(two.care_ops_used).toBe(2);
    expect(() => applyCare(two, { kind: 'water', level: 'normal' })).toThrow(GameRuleError);
  });

  it('allows the same kind twice (note 4): heavy watering twice is +40', () => {
    const m = applyCare(applyCare(mission(), { kind: 'water', level: 'heavy' }), {
      kind: 'water',
      level: 'heavy',
    });
    expect(m.plant.root_moisture).toBe(95);
    expect(today(m).care).toEqual([
      { kind: 'water', level: 'heavy' },
      { kind: 'water', level: 'heavy' },
    ]);
  });

  it('rejects an operation that changes nothing', () => {
    expect(() => applyCare(mission(), { kind: 'fan', level: 'low' })).toThrow(GameRuleError);
    expect(() =>
      applyCare(mission(), { kind: 'light', ...INITIAL_PLANT_STATE.light }),
    ).toThrow(GameRuleError);
  });

  it('lighting is recorded but changes no number (note 5) and counts as an operation', () => {
    const m = applyCare(mission(), { kind: 'light', red: 'high', blue: 'low' });
    expect(m.plant.light).toEqual({ red: 'high', blue: 'low' });
    expect(m.care_ops_used).toBe(1);
    const lit = endDay(m);
    const plain = endDay(mission());
    expect({ ...lit.plant, light: plain.plant.light }).toEqual(plain.plant);
  });

  it('allows care in the care phase only', () => {
    const atNight = endDay(mission());
    expect(() => applyCare(atNight, { kind: 'water', level: 'normal' })).toThrow(GameRuleError);
    expect(() => endDay(atNight)).toThrow(GameRuleError);
    expect(() => nextDay(mission(), evidence)).toThrow(GameRuleError);
  });

  it('projectNight shows the values after tonight without changing the mission', () => {
    const m = mission();
    const projection = projectNight(m.plant);
    expect(projection.plant.root_moisture).toBe(45);
    expect(projection.health_change).toBe(NIGHT_HEALTH.all_normal);
    expect(endDay(m).plant).toEqual(projection.plant);
  });
});

// ---------------------------------------------------------------------------
// 위기 발생
// ---------------------------------------------------------------------------

describe('crisis occurrence (위기 발생)', () => {
  it('a danger zone always makes a crisis', () => {
    for (let seed = 0; seed < 50; seed++) {
      const next = nextDay(nightBefore({ root_moisture: 20 }, {}, seed), evidence);
      expect(next.phase).toBe('crisis_pending');
      expect(today(next).roll?.probability).toBe(CRISIS_PROBABILITY.danger);
      expect(today(next).roll?.occurred).toBe(true);
    }
  });

  it('a caution zone makes a crisis when the roll is below 30%', () => {
    const outcomes = new Set<boolean>();
    for (let seed = 0; seed < 60; seed++) {
      const before = nightBefore({ root_moisture: 30 }, {}, seed);
      const next = nextDay(before, evidence);
      const roll = today(next).roll;
      const expected = nextRandom(before.rng_state).value;
      expect(roll?.roll).toBe(expected);
      expect(roll?.probability).toBe(CRISIS_PROBABILITY.caution);
      expect(roll?.occurred).toBe(expected < CRISIS_PROBABILITY.caution);
      expect(next.phase).toBe(roll?.occurred ? 'crisis_pending' : 'care');
      outcomes.add(roll?.occurred ?? false);
    }
    expect(outcomes).toEqual(new Set([true, false]));
  });

  it('water shortage is a candidate when root moisture is low', () => {
    const next = pending({ root_moisture: 20 });
    expect(next.active_crisis).toEqual({
      candidates: [WATER],
      crisis_id: null,
      attempt: 1,
      stage: 0,
      inappropriate_action_ids: [],
      response: null,
    });
  });

  it('overwater and mold needs high moisture or humidity and the fan on low', () => {
    expect(pending({ root_moisture: 85 }).active_crisis?.candidates).toEqual([MOLD]);
    expect(pending({ humidity: 85 }).active_crisis?.candidates).toEqual([MOLD]);
    const fanHigh = nextDay(nightBefore({ root_moisture: 85, fan: 'high' }), evidence);
    expect(fanHigh.phase).toBe('care');
    expect(today(fanHigh).roll?.candidates).toEqual([]);
  });

  it('a partial verdict raises the same crisis by 30 points on the next day only (note 8)', () => {
    const recurrence = { crisis_id: WATER, game_day: 2 };
    const next = nextDay(nightBefore({ root_moisture: 30 }, { recurrence }), evidence);
    expect(today(next).roll?.probability).toBeCloseTo(
      CRISIS_PROBABILITY.caution + CRISIS_PROBABILITY.recurrence_bonus,
    );
    expect(next.recurrence).toBeNull();

    const stale = { crisis_id: WATER, game_day: 5 };
    const other = nextDay(nightBefore({ root_moisture: 30 }, { recurrence: stale }), evidence);
    expect(today(other).roll?.probability).toBe(CRISIS_PROBABILITY.caution);
    expect(other.recurrence).toBeNull();
  });

  it('the bonus does not create a crisis when the state is normal (note 8)', () => {
    const recurrence = { crisis_id: WATER, game_day: 2 };
    const next = nextDay(nightBefore({}, { recurrence }), evidence);
    expect(today(next).roll?.probability).toBe(0);
    expect(next.phase).toBe('care');
  });

  it('one crisis per day at most: after it ends the day ends', () => {
    const resolved = continueAfterResult(choose(present(pending({ root_moisture: 20 })), W_FIX), evidence);
    expect(resolved.phase).toBe('night');
    expect(resolved.active_crisis).toBeNull();
  });

  it('there is no daily care on a crisis day (note 3)', () => {
    const p = pending({ root_moisture: 20 });
    expect(() => applyCare(p, { kind: 'water', level: 'normal' })).toThrow(GameRuleError);
    expect(() => endDay(p)).toThrow(GameRuleError);
  });

  it('builds the crisis request from the record', () => {
    const p = pending({ root_moisture: 20 }, { danger_days: { root_moisture: 1, humidity: 0 } });
    const request = buildCrisisRequest(p, 'en');
    expect(crisisRequestSchema.safeParse(request).success).toBe(true);
    expect(request).toEqual({
      locale: 'en',
      cultivation_day: 6,
      state: p.plant,
      danger_days: { root_moisture: 1, humidity: 0 },
      history: [],
      active: null,
    });
    expect(() => buildCrisisRequest(mission(), 'en')).toThrow(GameRuleError);
  });

  it('the request carries the active crisis after an inappropriate choice and the finished history', () => {
    const shown = present(pending({ root_moisture: 20 }));
    const again = continueAfterResult(choose(shown, W_WAIT), evidence);
    const request = buildCrisisRequest(again, 'ko');
    expect(crisisRequestSchema.safeParse(request).success).toBe(true);
    expect(request.active).toEqual({
      crisis_id: WATER,
      attempt: 2,
      chosen_action_ids: [W_WAIT],
    });
    expect(request.history).toEqual([]);

    // Finish it, then start another crisis two days later.
    const done = continueAfterResult(
      choose(receiveCrisis(again, responseFor(WATER), evidence), W_FIX),
      evidence,
    );
    const later = nextDay(withPlant(done, { root_moisture: 10 }), evidence);
    const history = buildCrisisRequest(later, 'en').history;
    expect(history).toEqual([
      {
        crisis_id: WATER,
        cultivation_day: 6,
        choices: [
          { action_id: W_WAIT, verdict: 'inappropriate' },
          { action_id: W_FIX, verdict: 'appropriate' },
        ],
        outcome: 'resolved',
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 위기 응답 받기 (crisis API contract)
// ---------------------------------------------------------------------------

describe('receiving the crisis (백엔드가 하는 일 > 요청과 응답)', () => {
  it('shows the crisis and starts its record', () => {
    const shown = present(pending({ root_moisture: 20 }));
    expect(shown.phase).toBe('crisis');
    expect(shown.active_crisis?.crisis_id).toBe(WATER);
    expect(shown.active_crisis?.stage).toBe(1);
    expect(shown.active_crisis?.response?.crisis_id).toBe(WATER);
    expect(todayCrisis(shown)).toEqual({
      crisis_id: WATER,
      name: findCrisis(evidence, WATER)?.name,
      start_stage: 1,
      max_stage: 1,
      attempts: [],
      outcome: null,
    });
  });

  it('uses its own stage, not the one in the response', () => {
    const p = pending({ root_moisture: 20 });
    const shown = receiveCrisis(p, responseFor(WATER, 2), evidence);
    expect(shown.active_crisis?.stage).toBe(1);
  });

  it('rejects a crisis that is not a candidate', () => {
    const p = pending({ root_moisture: 20 });
    expect(() => receiveCrisis(p, responseFor(MOLD), evidence)).toThrow(GameRuleError);
  });

  it('rejects an unknown crisis or action', () => {
    const p = pending({ root_moisture: 20 });
    const unknownCrisis = { ...responseFor(WATER), crisis_id: 'nope' };
    expect(() => receiveCrisis(p, unknownCrisis, evidence)).toThrow(GameRuleError);
    const r = responseFor(WATER);
    const unknownAction = { ...r, options: [...r.options, { ...r.options[0], action_id: 'nope' }] };
    expect(() => receiveCrisis(p, unknownAction, evidence)).toThrow(GameRuleError);
  });

  it('rejects a different crisis on a later presentation', () => {
    const p = pending({ root_moisture: 85 });
    const again = continueAfterResult(choose(present(p), M_WATER), evidence);
    const forged: MissionState = {
      ...again,
      active_crisis: again.active_crisis && { ...again.active_crisis, candidates: [MOLD, WATER] },
    };
    expect(() => receiveCrisis(forged, responseFor(WATER), evidence)).toThrow(GameRuleError);
  });

  it('is allowed in crisis_pending only', () => {
    const shown = present(pending({ root_moisture: 20 }));
    expect(() => receiveCrisis(shown, responseFor(WATER), evidence)).toThrow(GameRuleError);
  });
});

// ---------------------------------------------------------------------------
// 판정별 효과
// ---------------------------------------------------------------------------

describe('verdict effects (판정별 효과)', () => {
  it('appropriate: the crisis ends, the related metric moves to 55, health +5', () => {
    const shown = present(pending({ root_moisture: 20 }));
    const result = choose(shown, W_FIX);
    expect(result.phase).toBe('crisis_result');
    expect(result.plant.root_moisture).toBe(NORMAL_MID);
    expect(result.plant.plant_health).toBe(shown.plant.plant_health + 5);
    expect(todayCrisis(result).outcome).toBe('resolved');
    expect(result.recurrence).toBeNull();
  });

  it('appropriate for mold: both metrics move to 55 only when outside normal, fan goes high (note 9)', () => {
    const result = choose(present(pending({ root_moisture: 85, humidity: 60 })), M_FIX);
    expect(result.plant.root_moisture).toBe(NORMAL_MID);
    expect(result.plant.humidity).toBe(60);
    expect(result.plant.fan).toBe('high');
  });

  it('partial: the crisis ends, the metric moves half way to 55, recurrence tomorrow', () => {
    const shown = present(pending({ root_moisture: 20 }));
    const result = choose(shown, W_HALF);
    // 20 + (55 - 20) / 2 = 37.5, rounded.
    expect(result.plant.root_moisture).toBe(38);
    expect(result.plant.plant_health).toBe(shown.plant.plant_health);
    expect(todayCrisis(result).outcome).toBe('partial');
    expect(result.recurrence).toEqual({ crisis_id: WATER, game_day: shown.game_day + 1 });
  });

  it('inappropriate: the crisis continues, the delta applies, health -10', () => {
    const shown = present(pending({ root_moisture: 20 }));
    const result = choose(shown, W_WAIT);
    expect(result.phase).toBe('crisis_result');
    expect(result.plant.root_moisture).toBe(10);
    expect(result.plant.plant_health).toBe(shown.plant.plant_health - 10);
    expect(todayCrisis(result).outcome).toBeNull();
    expect(result.active_crisis?.inappropriate_action_ids).toEqual([W_WAIT]);
  });

  it('inappropriate: the crisis is shown again with the next symptom stage (note 10)', () => {
    const result = choose(present(pending({ root_moisture: 20 })), W_WAIT);
    const again = continueAfterResult(result, evidence);
    expect(again.phase).toBe('crisis_pending');
    expect(again.active_crisis?.attempt).toBe(2);
    expect(again.active_crisis?.response).toBeNull();
    const shownAgain = receiveCrisis(again, responseFor(WATER, 2, 2), evidence);
    expect(shownAgain.active_crisis?.stage).toBe(2);
    expect(todayCrisis(shownAgain).start_stage).toBe(1);
    expect(todayCrisis(shownAgain).max_stage).toBe(2);
  });

  it('two inappropriate choices end the crisis with ground control support, -15 on top (note 11)', () => {
    const shown = present(pending({ root_moisture: 20 }));
    const start = shown.plant.plant_health;
    const second = receiveCrisis(
      continueAfterResult(choose(shown, W_WAIT), evidence),
      responseFor(WATER),
      evidence,
    );
    const result = choose(second, W_FAN);
    expect(result.plant.plant_health).toBe(start - 10 - 10 + GROUND_SUPPORT_HEALTH);
    expect(result.plant.root_moisture).toBe(NORMAL_MID);
    // Ground support leaves the fan as the action set it.
    expect(result.plant.fan).toBe('high');
    const record = todayCrisis(result);
    expect(record.outcome).toBe('ground_support');
    expect(record.attempts.map((a) => a.ground_support)).toEqual([false, true]);
    expect(record.attempts[1].after).toEqual(result.plant);
    expect(record.attempts[1].before).toEqual(second.plant);

    const ended = continueAfterResult(result, evidence);
    expect(ended.phase).toBe('night');
    expect(ended.active_crisis).toBeNull();
  });

  it('ground support moves only trigger metrics that are outside normal', () => {
    const shown = present(pending({ root_moisture: 85, humidity: 60 }));
    const second = receiveCrisis(
      continueAfterResult(choose(shown, M_WATER), evidence),
      responseFor(MOLD),
      evidence,
    );
    const result = choose(second, M_WATER);
    expect(result.plant.root_moisture).toBe(NORMAL_MID);
    expect(result.plant.humidity).toBe(60);
    expect(result.plant.fan).toBe('low');
  });

  it('takes verdict and delta from the evidence list, not from the response', () => {
    const p = pending({ root_moisture: 20 });
    const r = responseFor(WATER);
    const forged: CrisisResponse = {
      ...r,
      options: r.options.map((o) => ({ ...o, verdict: 'appropriate', delta: { plant_health: 50 } })),
    };
    const result = choose(receiveCrisis(p, forged, evidence), W_WAIT);
    expect(result.plant.plant_health).toBe(p.plant.plant_health - 10);
    expect(todayCrisis(result).attempts[0].verdict).toBe('inappropriate');
  });

  it('records each attempt', () => {
    const shown = present(pending({ root_moisture: 20 }));
    const result = choose(shown, W_FIX);
    expect(todayCrisis(result).attempts).toEqual([
      {
        attempt: 1,
        stage: 1,
        offered_action_ids: findCrisis(evidence, WATER)?.actions.map((a) => a.action_id),
        action_id: W_FIX,
        label: `label ${W_FIX}`,
        verdict: 'appropriate',
        delta: findAction(requireCrisis(WATER), W_FIX)?.delta,
        before: shown.plant,
        after: result.plant,
        ground_support: false,
      },
    ]);
  });

  it('rejects an action that was not offered, and choices outside the crisis phase', () => {
    const p = pending({ root_moisture: 20 });
    const r = responseFor(WATER);
    const shown = receiveCrisis(p, { ...r, options: r.options.slice(0, 3) }, evidence);
    expect(() => choose(shown, r.options[3].action_id)).toThrow(GameRuleError);
    expect(() => choose(p, W_FIX)).toThrow(GameRuleError);
    expect(() => continueAfterResult(shown, evidence)).toThrow(GameRuleError);
  });

  it('after a crisis the night runs and the next morning follows', () => {
    const done = continueAfterResult(choose(present(pending({ root_moisture: 20 })), W_FIX), evidence);
    expect(today(done).night?.drift).toEqual(NIGHT_DRIFT.low);
    expect(done.plant.root_moisture).toBe(NORMAL_MID - 10);
    expect(nextDay(done, evidence).game_day).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 증상 진행
// ---------------------------------------------------------------------------

describe('symptom progression (증상 진행)', () => {
  it('mold stage follows the nights in danger: 1, 2, then 3', () => {
    for (const [days, stage] of [
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 3],
    ] as const) {
      const shown = present(pending({ root_moisture: 85 }, { danger_days: { root_moisture: days, humidity: 0 } }));
      expect(shown.active_crisis?.stage).toBe(stage);
    }
  });

  it('two inappropriate choices in a mold crisis reach stage 3 (note 14)', () => {
    const shown = present(pending({ root_moisture: 85 }, { danger_days: { root_moisture: 1, humidity: 0 } }));
    const first = choose(shown, M_WATER);
    expect(todayCrisis(first).max_stage).toBe(2);
    const second = choose(receiveCrisis(continueAfterResult(first, evidence), responseFor(MOLD), evidence), M_WATER);
    expect(todayCrisis(second).max_stage).toBe(3);
    expect(todayCrisis(second).outcome).toBe('ground_support');
  });

  it('humidity reaches danger only on night 6 with the fan on low from the start (note 13)', () => {
    let m = mission();
    const zones: Zone[] = [];
    for (let day = 1; day <= LAST_CRISIS_DAY; day++) {
      // Hold root moisture normal so no crisis interrupts; only humidity drifts.
      m = endDay(withPlant(m, { root_moisture: 55 }));
      zones.push(today(m).night?.zones.humidity ?? 'normal');
      if (day < LAST_CRISIS_DAY) m = skipToCare(m);
    }
    expect(zones).toEqual(['normal', 'normal', 'normal', 'caution_high', 'caution_high', 'danger_high']);
  });

  it('counts consecutive danger nights per metric', () => {
    let m = endDay(withPlant(mission(), { root_moisture: 30 }));
    expect(m.plant.root_moisture).toBe(20);
    expect(m.danger_days).toEqual({ root_moisture: 1, humidity: 0 });
    m = endDay(skipToCare(m));
    expect(m.danger_days.root_moisture).toBe(2);
    m = endDay(withPlant(skipToCare(m), { root_moisture: 60 }));
    expect(m.danger_days.root_moisture).toBe(0);
  });

  it('restarts the count when the danger zone switches side', () => {
    const first = endDay(withPlant(mission(), { root_moisture: 95 }));
    expect(today(first).night?.zones.root_moisture).toBe('danger_high');
    const switched = endDay(withPlant(skipToCare(first), { root_moisture: 20 }));
    expect(today(switched).night?.zones.root_moisture).toBe('danger_low');
    expect(switched.danger_days.root_moisture).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 식물 건강과 수확
// ---------------------------------------------------------------------------

describe('plant health and harvest (식물 건강과 수확)', () => {
  it.each([
    ['both normal', { root_moisture: 55, humidity: 55 }, NIGHT_HEALTH.all_normal],
    ['one caution', { root_moisture: 45, humidity: 55 }, NIGHT_HEALTH.per_caution_metric],
    ['one danger', { root_moisture: 30, humidity: 55 }, NIGHT_HEALTH.per_danger_metric],
    [
      'danger and caution',
      { root_moisture: 30, humidity: 70 },
      NIGHT_HEALTH.per_danger_metric + NIGHT_HEALTH.per_caution_metric,
    ],
    ['two dangers', { root_moisture: 30, humidity: 80 }, 2 * NIGHT_HEALTH.per_danger_metric],
  ] as const)('night health: %s', (_label, patch, change) => {
    const m = endDay(withPlant(mission(), patch));
    expect(today(m).night?.health_change).toBe(change);
    expect(m.plant.plant_health).toBe(70 + change);
    expect(today(m).night?.end).toEqual(m.plant);
  });

  it('night health uses the values after the drift (note 2)', () => {
    // 45 is normal in the morning but caution (35) after the night.
    const m = endDay(withPlant(mission(), { root_moisture: 45 }));
    expect(today(m).night?.zones.root_moisture).toBe('caution_low');
  });

  it('keeps health within 0-100', () => {
    const m = endDay(withPlant(mission(), { plant_health: 99 }));
    expect(m.plant.plant_health).toBe(100);
  });

  it('health 0 at night ends the mission (note 12)', () => {
    const m = endDay(withPlant(mission(), { plant_health: 8, root_moisture: 30 }));
    expect(m.plant.plant_health).toBe(0);
    expect(m.phase).toBe('failed');
    expect(today(m).night).not.toBeNull();
  });

  it('health 0 during a crisis ends the mission on the spot (note 12)', () => {
    const shown = present(pending({ root_moisture: 20, plant_health: 10 }));
    const result = choose(shown, W_WAIT);
    expect(result.plant.plant_health).toBe(0);
    expect(result.phase).toBe('failed');
    expect(todayCrisis(result).outcome).toBe('mission_failed');
    expect(todayCrisis(result).attempts).toHaveLength(1);
  });

  it('health 0 from ground support also ends the mission', () => {
    const shown = present(pending({ root_moisture: 20, plant_health: 30 }));
    const second = receiveCrisis(continueAfterResult(choose(shown, W_WAIT), evidence), responseFor(WATER), evidence);
    const result = choose(second, W_WAIT);
    expect(result.plant.plant_health).toBe(0);
    expect(result.phase).toBe('failed');
    expect(todayCrisis(result).outcome).toBe('mission_failed');
    expect(todayCrisis(result).attempts[1].ground_support).toBe(true);
  });

  function atHarvest(health: number): MissionState {
    const day6 = { ...nightBefore({ plant_health: health }), game_day: LAST_CRISIS_DAY };
    return nextDay(day6, evidence);
  }

  it.each([
    [100, 'excellent'],
    [80, 'excellent'],
    [79, 'success'],
    [50, 'success'],
    [49, 'fail'],
    [1, 'fail'],
  ] as const)('harvest grade for health %i is %s', (health, grade) => {
    const harvested = harvestCrop(atHarvest(health), { sanitize: false });
    expect(harvested.phase).toBe('freeze');
    expect(harvested.harvest?.final_health).toBe(health);
    expect(harvested.harvest?.grade).toBe(grade);
    expect(harvested.harvest?.sanitized).toBe(false);
  });

  it('harvest, freeze and report follow in order', () => {
    const harvested = harvestCrop(atHarvest(70), { sanitize: true });
    expect(harvested.harvest?.sanitized).toBe(true);
    expect(harvested.harvest?.microbial).toEqual(computeMicrobial(harvested, true));
    expect(() => harvestCrop(harvested, { sanitize: true })).toThrow(GameRuleError);
    const report = confirmFreeze(harvested);
    expect(report.phase).toBe('report');
    expect(() => confirmFreeze(report)).toThrow(GameRuleError);
    expect(() => harvestCrop(mission(), { sanitize: false })).toThrow(GameRuleError);
  });
});

// ---------------------------------------------------------------------------
// 수확물의 미생물 수치
// ---------------------------------------------------------------------------

describe('microbial value of the harvest (수확물의 미생물 수치)', () => {
  it('starts from the 3.0 baseline and always lists all factors in order', () => {
    const result = computeMicrobial(recordWith([night('normal')]), false);
    expect(result.value).toBe(MICROBIAL.baseline);
    expect(result.factors).toEqual([
      { key: 'baseline', count: 1, change: 3 },
      { key: 'humidity_caution_days', count: 0, change: 0 },
      { key: 'humidity_danger_days', count: 0, change: 0 },
      { key: 'mold_partial_end', count: 0, change: 0 },
      { key: 'mold_inappropriate', count: 0, change: 0 },
      { key: 'mold_stage_3', count: 0, change: 0 },
      { key: 'crisis_sanitize', count: 0, change: 0 },
      { key: 'harvest_sanitize', count: 0, change: 0 },
    ]);
    expect(result.classification).toBe('within_range');
  });

  it('humidity caution (high) nights +0.1 each, danger (high) nights +0.2 each (note 20.1)', () => {
    const state = recordWith([
      night('caution_high'),
      night('caution_high'),
      night('caution_high'),
      night('danger_high'),
      night('caution_low'),
      night('danger_low'),
    ]);
    expect(factor(state, 'humidity_caution_days')).toEqual({ key: 'humidity_caution_days', count: 3, change: 0.3 });
    expect(factor(state, 'humidity_danger_days')).toEqual({ key: 'humidity_danger_days', count: 1, change: 0.2 });
    expect(computeMicrobial(state, false).value).toBe(3.5);
  });

  it('mold crisis ended partially +0.3 each', () => {
    const state = recordWith(
      [night('normal'), night('normal'), night('normal')],
      [null, moldRecord({ outcome: 'partial' }), moldRecord({ outcome: 'partial' })],
    );
    expect(factor(state, 'mold_partial_end')).toEqual({ key: 'mold_partial_end', count: 2, change: 0.6 });
  });

  it('inappropriate choices in a mold crisis +0.5 each; other crises do not count', () => {
    const waterCrisis: CrisisRecord = {
      ...moldRecord({}, [{ action_id: W_WAIT, verdict: 'inappropriate' }]),
      crisis_id: WATER,
    };
    const state = recordWith(
      [night('normal'), night('normal')],
      [
        moldRecord({}, [
          { action_id: M_WATER, verdict: 'inappropriate' },
          { action_id: M_WATER, verdict: 'inappropriate' },
        ]),
        waterCrisis,
      ],
    );
    expect(factor(state, 'mold_inappropriate')).toEqual({ key: 'mold_inappropriate', count: 2, change: 1 });
  });

  it('reaching the mold stage adds +0.5 once per mission (note 20.2)', () => {
    const state = recordWith(
      [night('normal'), night('normal')],
      [moldRecord({ max_stage: 3 }), moldRecord({ max_stage: 3 })],
    );
    expect(factor(state, 'mold_stage_3')).toEqual({ key: 'mold_stage_3', count: 1, change: 0.5 });
    const below = recordWith([night('normal')], [moldRecord({ max_stage: 2 })]);
    expect(factor(below, 'mold_stage_3').count).toBe(0);
  });

  it('surface sanitizing during a crisis -0.2 each, at most -0.6 (note 20.3)', () => {
    const sanitize = { action_id: SANITIZE_ACTION_ID, verdict: 'partial' } as const;
    const state = recordWith(
      [night('normal'), night('normal'), night('normal'), night('normal')],
      [
        moldRecord({ outcome: 'resolved' }, [sanitize]),
        moldRecord({ outcome: 'resolved' }, [sanitize]),
        moldRecord({ outcome: 'resolved' }, [sanitize]),
        moldRecord({ outcome: 'resolved' }, [sanitize]),
      ],
    );
    expect(factor(state, 'crisis_sanitize')).toEqual({ key: 'crisis_sanitize', count: 4, change: -0.6 });
    const two = recordWith([night('normal'), night('normal')], [moldRecord({}, [sanitize]), moldRecord({}, [sanitize])]);
    expect(factor(two, 'crisis_sanitize').change).toBe(-0.4);
  });

  it('sanitizing at harvest -0.3', () => {
    const state = recordWith([night('normal')]);
    expect(factor(state, 'harvest_sanitize', true)).toEqual({ key: 'harvest_sanitize', count: 1, change: -0.3 });
    expect(computeMicrobial(state, true).value).toBe(2.7);
  });

  it('clamps the value to 1.5-6.0 (note 20.4)', () => {
    const wet = recordWith(
      Array.from({ length: 6 }, () => night('danger_high')),
      Array.from({ length: 6 }, () =>
        moldRecord({ outcome: 'partial', max_stage: 3 }, [
          { action_id: M_WATER, verdict: 'inappropriate' },
          { action_id: M_WATER, verdict: 'inappropriate' },
        ]),
      ),
    );
    expect(computeMicrobial(wet, false).value).toBe(MICROBIAL.max);
    expect(computeMicrobial(wet, false).classification).toBe('above_range');
  });

  it('classifies against the measured range, ends inclusive (note 20.4)', () => {
    const { min, max } = evidence.harvest.microbial_range;
    expect(classifyMicrobial(min - 0.01)).toBe('below_range');
    expect(classifyMicrobial(min)).toBe('within_range');
    expect(classifyMicrobial(max)).toBe('within_range');
    expect(classifyMicrobial(max + 0.01)).toBe('above_range');
  });

  it('uses the real record: a mold crisis with two inappropriate choices', () => {
    const shown = present(pending({ root_moisture: 85 }, { danger_days: { root_moisture: 1, humidity: 0 } }));
    const second = receiveCrisis(continueAfterResult(choose(shown, M_WATER), evidence), responseFor(MOLD), evidence);
    const done = continueAfterResult(choose(second, M_WATER), evidence);
    const result = computeMicrobial(done, false);
    expect(factor(done, 'mold_inappropriate').count).toBe(2);
    expect(factor(done, 'mold_stage_3').count).toBe(1);
    expect(result.value).toBeGreaterThanOrEqual(4.5);
  });
});

// ---------------------------------------------------------------------------
// 보고서 지표
// ---------------------------------------------------------------------------

describe('report metrics (보고서 지표)', () => {
  it('counts verdicts, attempts per crisis and danger nights', () => {
    const shown = present(pending({ root_moisture: 20 }));
    const again = receiveCrisis(continueAfterResult(choose(shown, W_WAIT), evidence), responseFor(WATER), evidence);
    const done = continueAfterResult(choose(again, W_HALF), evidence);
    const metrics = computeReportMetrics(done);
    expect(metrics.verdict_counts).toEqual({ appropriate: 0, partial: 1, inappropriate: 1 });
    expect(metrics.total_choices).toBe(2);
    expect(metrics.attempts_per_crisis).toEqual([
      { crisis_id: WATER, name: findCrisis(evidence, WATER)?.name, game_day: 2, attempts: 2, outcome: 'partial' },
    ]);
    // 20 -> 10 (inappropriate) -> 33 (half way, rounded) -> 23 after the night (danger).
    expect(done.plant.root_moisture).toBe(23);
    expect(metrics.danger_nights).toBe(1);
    expect(metrics.danger_nights_by_metric).toEqual({ root_moisture: 1, humidity: 0 });
  });

  it('counts a night once even when both metrics are in danger', () => {
    const state = recordWith([night('danger_high', 'danger_low'), night('normal', 'danger_low'), night('normal')]);
    const metrics = computeReportMetrics(state);
    expect(metrics.danger_nights).toBe(2);
    expect(metrics.danger_nights_by_metric).toEqual({ root_moisture: 2, humidity: 1 });
    expect(metrics.total_choices).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------------

describe('pure transitions', () => {
  it('never changes the input state', () => {
    const care = deepFreeze(mission());
    applyCare(care, { kind: 'water', level: 'heavy' });
    applyCare(care, { kind: 'light', red: 'high', blue: 'high' });
    const atNight = deepFreeze(endDay(care));
    nextDay(atNight, evidence);

    const p = deepFreeze(pending({ root_moisture: 85 }));
    buildCrisisRequest(p, 'en');
    const shown = deepFreeze(receiveCrisis(p, deepFreeze(responseFor(MOLD)), evidence));
    for (const action of [M_FIX, SANITIZE_ACTION_ID, M_WATER]) choose(shown, action);
    const bad = deepFreeze(choose(shown, M_WATER));
    const again = deepFreeze(continueAfterResult(bad, evidence));
    const second = deepFreeze(receiveCrisis(again, responseFor(MOLD), evidence));
    const ground = deepFreeze(choose(second, M_WATER));
    continueAfterResult(ground, evidence);
    computeMicrobial(ground, true);
    computeReportMetrics(ground);

    const harvest = deepFreeze({ ...nightBefore({}), game_day: LAST_CRISIS_DAY });
    const atHarvest = deepFreeze(nextDay(harvest, evidence));
    const frozenHarvest = deepFreeze(harvestCrop(atHarvest, { sanitize: true }));
    confirmFreeze(frozenHarvest);
  });
});
