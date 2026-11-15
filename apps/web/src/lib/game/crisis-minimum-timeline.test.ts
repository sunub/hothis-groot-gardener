import { describe, expect, it } from 'vitest';
import { crisisRequestSchema } from '@/lib/contract/schemas';
import type { CareOp, DayRecord, EventList, MissionState, PlantState } from '@/lib/contract/types';
import { evidence } from '@/lib/evidence';
import { eventList, findEventAction, findTimelineEvent, isCardKind } from '@/lib/events';
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
  harvestCrop,
  projectMissionNight,
  receiveCrisis,
  respondToEvent,
} from './engine';
import { GAME_DAYS, MAX_CARE_OPS_PER_DAY, METRICS, MIN_CRISES_PER_MISSION, zoneOf } from './rules';
import { isMissionState, loadMission, saveMission, type MissionStorage } from './storage';

/**
 * The mission minimum of crises (MIN_CRISES_PER_MISSION) in missions with the
 * cultivation timeline: event cards, flags and the diary around the overnight change.
 * Missions are played only through the engine functions the mission store calls.
 */

const WATER = 'water_shortage';
const MOLD = 'overwater_mold';

function today(state: MissionState): DayRecord {
  return state.days[state.days.length - 1];
}

/** Every field of the plant that differs between two states. */
function changedFields(a: PlantState, b: PlantState): string[] {
  const fields: string[] = [];
  for (const key of ['root_moisture', 'humidity', 'plant_health', 'fan'] as const) {
    if (a[key] !== b[key]) fields.push(key);
  }
  if (a.light.red !== b.light.red || a.light.blue !== b.light.blue) fields.push('light');
  return fields;
}

async function presentCrisis(state: MissionState): Promise<MissionState> {
  const request = crisisRequestSchema.parse(JSON.parse(JSON.stringify(buildCrisisRequest(state, 'en'))));
  const response = await createCrisis(request);
  return receiveCrisis(state, response, evidence);
}

// --- How the player answers ---------------------------------------------------

type CardRule = (offered: readonly string[], eventId: string, events: EventList) => string;

function verdictOf(events: EventList, eventId: string, actionId: string): string | undefined {
  const event = findTimelineEvent(events, eventId);
  if (!event || !isCardKind(event)) return undefined;
  return findEventAction(event, actionId)?.verdict;
}

const CARD_RULES: Record<string, CardRule> = {
  appropriate: (offered, eventId, events) => {
    const found = offered.find((id) => verdictOf(events, eventId, id) === 'appropriate');
    if (!found) throw new Error(`no appropriate action offered for ${eventId}`);
    return found;
  },
  first: (offered) => offered[0],
  // The last action leaves water_blocked and fan_actually_off set (do_nothing, keep_observing).
  last: (offered) => offered[offered.length - 1],
};

const CARE_PLANS: CareOp[][] = [
  [],
  [{ kind: 'water', level: 'normal' }],
  [{ kind: 'water', level: 'heavy' }],
  [{ kind: 'water', level: 'normal' }, { kind: 'water', level: 'normal' }],
  [{ kind: 'water', level: 'heavy' }, { kind: 'water', level: 'normal' }],
  [{ kind: 'water', level: 'heavy' }, { kind: 'water', level: 'heavy' }],
];

type Policy = (state: MissionState) => MissionState;

/** Care that keeps both values normal after tonight, from the mission's own forecast (flag drift included). */
function carefulWith(state: MissionState, moveFan: boolean): MissionState {
  const other = state.plant.fan === 'low' ? 'high' : 'low';
  const plans: CareOp[][] = [
    ...CARE_PLANS,
    ...(moveFan ? CARE_PLANS.slice(0, 3).map((ops): CareOp[] => [{ kind: 'fan', level: other }, ...ops]) : []),
  ];
  for (const ops of plans) {
    if (ops.length > MAX_CARE_OPS_PER_DAY - state.care_ops_used) continue;
    let next = state;
    for (const op of ops) next = applyCare(next, op);
    const zones = projectMissionNight(next).zones;
    if (METRICS.every((m) => zones[m] === 'normal')) return next;
  }
  return state;
}

const careful: Policy = (state) => carefulWith(state, true);

const POLICIES: Record<string, Policy> = {
  careful,
  nothing: (m) => m,
  fan_high_heavy_water: (m) => {
    if (m.plant.fan === 'low') m = applyCare(m, { kind: 'fan', level: 'high' });
    while (m.care_ops_used < 2) m = applyCare(m, { kind: 'water', level: 'heavy' });
    return m;
  },
};

// --- Playing one mission ------------------------------------------------------

interface ChangeSeen {
  game_day: number;
  crisis_id: string;
  start_stage: number | null;
  flags: string[];
}

interface Played {
  mission: MissionState;
  cards: number;
  changes: ChangeSeen[];
}

/**
 * Play a standard mission with the timeline to the report (or failure).
 * Every check that needs the state just before a morning is made here.
 */
async function playTimeline(seed: number, care: Policy, cardRule: CardRule): Promise<Played> {
  let m = createMission({ mission_id: `tl-${seed}`, mode: 'standard', seed, timeline: true });
  let cards = 0;
  const changes: ChangeSeen[] = [];
  let pendingChange: ChangeSeen | null = null;
  for (let guard = 0; guard < 400; guard++) {
    const pending = m.timeline?.pending_event;
    if (pending) {
      cards += 1;
      m = respondToEvent(m, cardRule(pending.offered_action_ids, pending.event_id, eventList));
      continue;
    }
    switch (m.phase) {
      case 'care':
        m = endDay(care(m));
        break;
      case 'night': {
        const before = m;
        m = advanceDay(m, evidence);
        if (m.game_day === before.game_day) break;
        // A new morning: the record starts from the state the crisis is computed from.
        const day = today(m);
        expect(day.start).toEqual(m.plant);
        expect(m.timeline!.cultivation_day).toBe(day.cultivation_day);
        const change = day.overnight_change;
        if (change) {
          // Exactly one value differs from the plant the night (and any card answered since) left.
          expect(changedFields(before.plant, day.start)).toEqual([change.metric]);
          expect(change.from).toBe(before.plant[change.metric]);
          expect(day.start[change.metric]).toBe(change.to);
          expect(m.phase).toBe('crisis_pending');
          expect(m.active_crisis?.candidates).toContain(change.crisis_id);
          pendingChange = {
            game_day: day.game_day,
            crisis_id: change.crisis_id,
            start_stage: null,
            flags: [...m.timeline!.flags],
          };
          changes.push(pendingChange);
        } else {
          expect(changedFields(before.plant, day.start)).toEqual([]);
        }
        break;
      }
      case 'crisis_pending': {
        if (m.active_crisis!.attempt === 1) {
          expect(buildCrisisRequest(m, 'en').state).toEqual(today(m).start);
        }
        m = await presentCrisis(m);
        if (pendingChange) {
          pendingChange.start_stage = today(m).crisis!.start_stage;
          expect(m.active_crisis?.crisis_id).toBe(pendingChange.crisis_id);
          pendingChange = null;
        }
        break;
      }
      case 'crisis': {
        const fix = m.active_crisis!.response!.options.find((o) => o.verdict === 'appropriate');
        expect(fix).toBeDefined();
        m = chooseOption(m, fix!.action_id, evidence);
        break;
      }
      case 'crisis_result':
        m = continueAfterResult(m, evidence);
        break;
      case 'harvest':
        // Crisis days are counted before the harvest screens; the report keeps the same days.
        m = harvestCrop(m, { sanitize: false });
        break;
      case 'freeze':
        m = confirmFreeze(m);
        break;
      case 'report':
      case 'failed':
        return { mission: m, cards, changes };
    }
  }
  throw new Error(`mission ${seed} did not end`);
}

interface SweepResult {
  missions: number;
  failed: number;
  harvested: number;
  crisisCounts: Record<number, number>;
  crisisDays: Record<number, number>;
  cardCounts: Record<number, number>;
  changes: number;
  changeStages: Record<string, number>;
  changesWithFlags: Record<string, number>;
}

function bump(record: Record<string | number, number>, key: string | number): void {
  record[key] = (record[key] ?? 0) + 1;
}

async function sweepTimeline(care: Policy, cardRule: CardRule, seeds = 300): Promise<SweepResult> {
  const result: SweepResult = {
    missions: 0,
    failed: 0,
    harvested: 0,
    crisisCounts: {},
    crisisDays: {},
    cardCounts: {},
    changes: 0,
    changeStages: {},
    changesWithFlags: {},
  };
  for (let seed = 1; seed <= seeds; seed++) {
    const { mission, cards, changes } = await playTimeline(seed, care, cardRule);
    result.missions += 1;
    expect(['report', 'failed']).toContain(mission.phase);
    bump(result.cardCounts, cards);
    for (const c of changes) {
      result.changes += 1;
      bump(result.changeStages, String(c.start_stage));
      for (const flag of c.flags) bump(result.changesWithFlags, flag);
    }
    if (mission.phase === 'failed') {
      result.failed += 1;
      continue;
    }
    result.harvested += 1;
    expect(mission.game_day).toBe(GAME_DAYS);
    const crisisDays = mission.days.filter((d) => d.crisis).map((d) => d.game_day);
    expect(crisisDays.length).toBeGreaterThanOrEqual(MIN_CRISES_PER_MISSION);
    bump(result.crisisCounts, crisisDays.length);
    for (const d of crisisDays) bump(result.crisisDays, d);
  }
  if (process.env.SWEEP_REPORT) console.log(JSON.stringify(result));
  return result;
}

// --- Tests --------------------------------------------------------------------

describe('timeline seed sweeps (300 standard missions with the timeline each)', () => {
  for (const [policyName, policy] of Object.entries(POLICIES)) {
    for (const [ruleName, rule] of Object.entries(CARD_RULES)) {
      it(`${policyName} care, ${ruleName} card answers: every harvested mission has the minimum of crises`, async () => {
        const result = await sweepTimeline(policy, rule);
        expect(result.missions).toBe(300);
        // Every overnight change raised a crisis that started at stage 1.
        expect(Object.keys(result.changeStages)).toEqual(result.changes > 0 ? ['1'] : []);
        // No mission fails in these sweeps; a failure would be a change in the game balance worth a look.
        expect(result.failed).toBe(0);
        expect(result.harvested).toBe(300);
        if (policyName === 'careful') expect(result.changes).toBeGreaterThan(0);
      }, 60_000);
    }
  }

  it('the overnight change still raises a crisis while water_blocked or fan_actually_off is set', async () => {
    const result = await sweepTimeline(careful, CARD_RULES.last);
    expect(result.changesWithFlags.water_blocked ?? 0).toBeGreaterThan(0);
    expect(result.changesWithFlags.fan_actually_off ?? 0).toBeGreaterThan(0);
  }, 60_000);
});

describe('overnight change with the timeline through the crisis pipeline', () => {
  it('from a careful start, every overnight-change crisis is accepted at stage 1, for both crises', async () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      let m = createMission({ mission_id: `e2e-tl-${seed}`, mode: 'standard', seed, timeline: true });
      let changesInMission = 0;
      for (let guard = 0; guard < 400 && m.phase !== 'harvest' && m.phase !== 'failed'; guard++) {
        const pending = m.timeline?.pending_event;
        if (pending) {
          m = respondToEvent(m, CARD_RULES.appropriate(pending.offered_action_ids, pending.event_id, eventList));
        } else if (m.phase === 'care') {
          m = endDay(careful(m));
        } else if (m.phase === 'night') {
          const before = m;
          m = advanceDay(m, evidence);
          const change = m.game_day !== before.game_day ? today(m).overnight_change : undefined;
          if (!change) continue;
          changesInMission += 1;
          // The morning before the change was normal: only the change put a value out of the normal zone.
          for (const metric of METRICS) expect(zoneOf(metric, before.plant[metric])).toBe('normal');
          expect(m.phase).toBe('crisis_pending');
          const shown = await presentCrisis(m);
          expect(shown.phase).toBe('crisis');
          expect(shown.active_crisis?.crisis_id).toBe(change.crisis_id);
          expect(shown.active_crisis?.stage).toBe(1);
          expect(today(shown).crisis?.start_stage).toBe(1);
          seen.add(change.crisis_id);
          m = shown;
        } else if (m.phase === 'crisis_pending') {
          m = await presentCrisis(m);
        } else if (m.phase === 'crisis') {
          const fix = m.active_crisis!.response!.options.find((o) => o.verdict === 'appropriate')!;
          m = chooseOption(m, fix.action_id, evidence);
        } else if (m.phase === 'crisis_result') {
          m = continueAfterResult(m, evidence);
        }
      }
      expect(m.phase).toBe('harvest');
      expect(m.days.filter((d) => d.crisis).length).toBeGreaterThanOrEqual(MIN_CRISES_PER_MISSION);
      // A careful player keeps the state normal, so at least the first crisis comes from an overnight change.
      // (A crisis day has no care, so the night after it can leave a value in a caution zone.)
      expect(changesInMission).toBeGreaterThanOrEqual(1);
    }
    expect([...seen].sort()).toEqual([MOLD, WATER]);
  });
});

describe('timeline missions saved before the rule', () => {
  function memoryStorage(): MissionStorage {
    const store = new Map<string, string>();
    return {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => void store.delete(k),
    };
  }

  /** A careful timeline mission played to the night of `gameDay`, cards answered as appropriate. */
  function nightOfTimeline(seed: number, gameDay: number): MissionState {
    let m = createMission({ mission_id: `saved-${seed}`, mode: 'standard', seed, timeline: true });
    for (let guard = 0; guard < 200; guard++) {
      const pending = m.timeline?.pending_event;
      if (pending) {
        m = respondToEvent(m, CARD_RULES.appropriate(pending.offered_action_ids, pending.event_id, eventList));
      } else if (m.phase === 'care') {
        m = endDay(careful(m));
        if (m.game_day === gameDay) return m;
      } else if (m.phase === 'night') {
        m = advanceDay(m, evidence);
        // Stop before any crisis: this helper is for the mornings before the rule applies.
        if (m.phase !== 'care' && !m.timeline?.pending_event) throw new Error('unexpected crisis');
      }
    }
    throw new Error('night not reached');
  }

  it('a saved timeline mission without overnight_change loads and continues to the next morning', () => {
    let checked = 0;
    for (let seed = 1; seed <= 30; seed++) {
      // The night of game day 1: no crisis morning has passed, so no record can hold the new field.
      const saved = nightOfTimeline(seed, 1);
      const json = JSON.stringify(saved);
      expect(json).not.toContain('overnight_change');
      expect(saved.schema_version).toBe(2);
      const storage = memoryStorage();
      expect(saveMission(storage, JSON.parse(json))).toBe(true);
      let m = loadMission(storage)!;
      expect(m).not.toBeNull();
      expect(m).toEqual(saved);
      for (let guard = 0; guard < 20 && m.game_day === 1; guard++) {
        const pending = m.timeline?.pending_event;
        m = pending
          ? respondToEvent(m, CARD_RULES.appropriate(pending.offered_action_ids, pending.event_id, eventList))
          : advanceDay(m, evidence);
      }
      expect(m.game_day).toBe(2);
      expect(['care', 'crisis_pending']).toContain(m.phase);
      if (today(m).overnight_change) checked += 1;
      // A save with the new field passes the shape check too.
      expect(isMissionState(JSON.parse(JSON.stringify(m)))).toBe(true);
    }
    // Some of these mornings got an overnight change (30% chance on game day 2).
    expect(checked).toBeGreaterThan(0);
  });

  it('a saved timeline mission with an event card waiting at night continues', () => {
    let found = 0;
    for (let seed = 1; seed <= 60 && found < 5; seed++) {
      const night = nightOfTimeline(seed, 1);
      const waiting = advanceDay(night, evidence);
      if (!waiting.timeline?.pending_event) continue;
      found += 1;
      const storage = memoryStorage();
      expect(saveMission(storage, JSON.parse(JSON.stringify(waiting)))).toBe(true);
      let m = loadMission(storage)!;
      for (let guard = 0; guard < 20 && m.game_day === 1; guard++) {
        const pending = m.timeline?.pending_event;
        m = pending
          ? respondToEvent(m, CARD_RULES.appropriate(pending.offered_action_ids, pending.event_id, eventList))
          : advanceDay(m, evidence);
      }
      expect(m.game_day).toBe(2);
    }
    expect(found).toBe(5);
  });
});
