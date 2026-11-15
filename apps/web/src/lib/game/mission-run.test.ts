import { describe, expect, it } from 'vitest';
import type { CareOp, MissionState } from '@/lib/contract/types';
import { createCrisis } from '@/server/ai/crisis';
import { evidence } from '@/lib/evidence';
import { crisisRequestSchema } from '@/lib/contract/schemas';
import {
  applyCare,
  buildCrisisRequest,
  chooseOption,
  computeReportMetrics,
  confirmFreeze,
  continueAfterResult,
  createMission,
  endDay,
  harvestCrop,
  nextDay,
  receiveCrisis,
} from './engine';
import { nextRandom } from './rng';
import { CRISIS_PROBABILITY, DEMO_SEED } from './rules';

/**
 * One whole mission from game day 1 to the report with the random seed fixed.
 * The crisis comes from createCrisis, the same function that POST /api/crisis
 * wraps, so this run crosses the same boundary as the real app.
 *
 * The care steps are the demo script in docs/DEMO-SCRIPT.md.
 */

/** Ask for the crisis the way the screen does, through the request schema. */
async function presentCrisis(state: MissionState): Promise<MissionState> {
  const request = crisisRequestSchema.parse(
    JSON.parse(JSON.stringify(buildCrisisRequest(state, 'en'))),
  );
  const response = await createCrisis(request);
  return receiveCrisis(state, response, evidence);
}

function careDay(state: MissionState, ops: CareOp[]): MissionState {
  let next = state;
  for (const op of ops) next = applyCare(next, op);
  return nextDay(endDay(next), evidence);
}

async function crisisDay(state: MissionState, actionIds: string[]): Promise<MissionState> {
  let next = state;
  for (const actionId of actionIds) {
    expect(next.phase).toBe('crisis_pending');
    next = await presentCrisis(next);
    expect(next.phase).toBe('crisis');
    next = chooseOption(next, actionId, evidence);
    if (next.phase === 'failed') return next;
    next = continueAfterResult(next, evidence);
  }
  expect(next.phase).toBe('night');
  return nextDay(next, evidence);
}

describe('demo seed (planning document: 위기 발생, 시연 모드)', () => {
  it('makes the caution-zone rolls on game days 3 and 5 succeed', () => {
    // One number is drawn per game day from day 2 to day 6.
    const rolls: number[] = [];
    let rng = DEMO_SEED;
    for (let day = 2; day <= 6; day += 1) {
      const step = nextRandom(rng);
      rolls.push(step.value);
      rng = step.state;
    }
    const [, day3, , day5] = rolls;
    expect(day3).toBeLessThan(CRISIS_PROBABILITY.caution);
    expect(day5).toBeLessThan(CRISIS_PROBABILITY.caution);
  });
});

describe('a whole mission in demo mode, day 1 to the report', () => {
  it('follows the demo script: water shortage on day 3, excess water and mold on day 5', async () => {
    let m = createMission({ mission_id: 'run-through', mode: 'demo', seed: 0 });
    expect(m.plant).toMatchObject({ plant_health: 70, root_moisture: 55, humidity: 55, fan: 'low' });

    // Day 1 (sowing day, no crisis): no care.
    m = careDay(m, []);
    expect(m.game_day).toBe(2);
    expect(m.plant).toMatchObject({ plant_health: 73, root_moisture: 45, humidity: 60 });

    // Day 2: nothing is out of range, so no crisis. No care.
    expect(m.phase).toBe('care');
    m = careDay(m, []);
    expect(m.plant).toMatchObject({ plant_health: 70, root_moisture: 35, humidity: 65 });

    // Day 3: root moisture is in the low caution zone. The demo seed makes the 30% roll succeed.
    expect(m.game_day).toBe(3);
    expect(m.phase).toBe('crisis_pending');
    m = await crisisDay(m, ['add_water_direct']);
    expect(m.days[2].crisis).toMatchObject({ crisis_id: 'water_shortage', outcome: 'resolved' });
    // Appropriate: root moisture to 55 and health +5, then the night: 45 / 70, all normal, +3.
    expect(m.plant).toMatchObject({ plant_health: 78, root_moisture: 45, humidity: 70 });

    // Day 4: no crisis. Water heavily twice.
    expect(m.phase).toBe('care');
    m = careDay(m, [
      { kind: 'water', level: 'heavy' },
      { kind: 'water', level: 'heavy' },
    ]);
    // 85 after watering, 75 / 75 after the night: two caution zones, -6.
    expect(m.plant).toMatchObject({ plant_health: 72, root_moisture: 75, humidity: 75 });

    // Day 5: excess water with the fan on low. First a wrong choice, then the right one.
    expect(m.game_day).toBe(5);
    expect(m.phase).toBe('crisis_pending');
    m = await crisisDay(m, ['add_water', 'fan_high']);
    const moldDay = m.days[4].crisis!;
    expect(moldDay).toMatchObject({ crisis_id: 'overwater_mold', outcome: 'resolved' });
    expect(moldDay.attempts.map((a) => a.verdict)).toEqual(['inappropriate', 'appropriate']);
    expect(moldDay.start_stage).toBe(1);
    expect(moldDay.max_stage).toBe(2);
    // The second presentation does not offer the action already chosen.
    expect(moldDay.attempts[1].offered_action_ids).not.toContain('add_water');
    // -10, then +5 and both metrics to 55 with the fan on high; the night: 40 / 45, all normal, +3.
    expect(m.plant).toMatchObject({ plant_health: 70, root_moisture: 40, humidity: 45, fan: 'high' });

    // Day 6: no crisis. Fan back to low and normal watering.
    expect(m.phase).toBe('care');
    m = careDay(m, [
      { kind: 'fan', level: 'low' },
      { kind: 'water', level: 'normal' },
    ]);
    expect(m.plant).toMatchObject({ plant_health: 73, root_moisture: 40, humidity: 50 });

    // Day 7: harvest, freeze, report.
    expect(m.game_day).toBe(7);
    expect(m.phase).toBe('harvest');
    m = harvestCrop(m, { sanitize: true });
    expect(m.phase).toBe('freeze');
    m = confirmFreeze(m);
    expect(m.phase).toBe('report');

    expect(m.harvest).toMatchObject({ sanitized: true, final_health: 73, grade: 'success' });
    // 3.0 baseline + 0.1 (one humid night) + 0.5 (one inappropriate choice) - 0.3 (sanitized harvest).
    expect(m.harvest!.microbial.value).toBeCloseTo(3.3, 5);
    expect(m.harvest!.microbial.classification).toBe('within_range');

    const metrics = computeReportMetrics(m);
    expect(metrics.verdict_counts).toEqual({ appropriate: 2, partial: 0, inappropriate: 1 });
    expect(metrics.attempts_per_crisis.map((c) => [c.crisis_id, c.game_day, c.attempts])).toEqual([
      ['water_shortage', 3, 1],
      ['overwater_mold', 5, 2],
    ]);
    expect(metrics.danger_nights).toBe(0);
    expect(m.days).toHaveLength(7);

    // The saved record survives a JSON round trip unchanged.
    expect(JSON.parse(JSON.stringify(m))).toEqual(m);
  });
});

describe('a mission that fails (planning document: 식물 건강과 수확)', () => {
  it('ends the moment plant health reaches 0, without harvest or report', async () => {
    // Neglect: the fan on high from day 1, never water, always the first inappropriate option.
    let m = createMission({ mission_id: 'neglect', mode: 'standard', seed: 7 });
    m = applyCare(m, { kind: 'fan', level: 'high' });
    for (let guard = 0; guard < 40 && m.phase !== 'failed' && m.phase !== 'harvest'; guard += 1) {
      if (m.phase === 'care') {
        m = endDay(m);
      } else if (m.phase === 'night') {
        m = nextDay(m, evidence);
      } else if (m.phase === 'crisis_pending') {
        m = await presentCrisis(m);
      } else if (m.phase === 'crisis') {
        const wrong = m.active_crisis!.response!.options.find((o) => o.verdict === 'inappropriate');
        expect(wrong).toBeDefined();
        m = chooseOption(m, wrong!.action_id, evidence);
      } else if (m.phase === 'crisis_result') {
        m = continueAfterResult(m, evidence);
      }
    }
    expect(m.phase).toBe('failed');
    expect(m.plant.plant_health).toBe(0);
    expect(m.game_day).toBeLessThan(7);
    expect(m.harvest).toBeNull();
    expect(() => harvestCrop(m, { sanitize: true })).toThrow();
  });
});

describe('recurrence after a partial verdict, across the game logic and the crisis API', () => {
  it('brings back the same crisis, not the other one that is also a candidate', async () => {
    // Seed 6: the day-6 roll is 0.54, above 30% and below the 60% of a recurring crisis.
    // Marked as a demo mission so the state-only rule decides (no overnight change and no
    // forced crisis for MIN_CRISES_PER_MISSION); the seed's rolls stay those of seed 6.
    let m: MissionState = {
      ...createMission({ mission_id: 'recurrence', mode: 'standard', seed: 6 }),
      mode: 'demo',
    };
    m = careDay(m, [{ kind: 'water', level: 'normal' }]);
    m = careDay(m, [{ kind: 'water', level: 'normal' }]);
    m = careDay(m, [{ kind: 'water', level: 'normal' }]);
    m = careDay(m, []);
    // Day 5: humidity is in the high caution zone with the fan on low.
    expect(m.game_day).toBe(5);
    expect(m.phase).toBe('crisis_pending');
    m = await crisisDay(m, ['wait_and_observe', 'clean_plant_surfaces']);
    expect(m.days[4].crisis).toMatchObject({ crisis_id: 'overwater_mold', outcome: 'partial' });

    // Day 6: root moisture is low and humidity is high, so both crises hold their trigger.
    expect(m.game_day).toBe(6);
    expect(m.plant.root_moisture).toBeLessThan(40);
    expect(m.plant.humidity).toBeGreaterThan(70);
    const roll = m.days[5].roll!;
    expect(roll.roll).toBeGreaterThan(CRISIS_PROBABILITY.caution);
    expect(roll).toMatchObject({ candidates: ['overwater_mold'], occurred: true });
    expect(roll.probability).toBeCloseTo(0.6);
    m = await presentCrisis(m);
    expect(m.active_crisis!.crisis_id).toBe('overwater_mold');
  });
});
