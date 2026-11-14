import { describe, expect, it } from 'vitest';
import type { PlantState } from '@/lib/contract/types';
import { INITIAL_PLANT_STATE, zoneOf } from '@/lib/game/rules';
import { computeStage, crisisProbability, evidence, findCrisis, selectCandidates } from './index';

function state(patch: Partial<PlantState>): PlantState {
  return { ...INITIAL_PLANT_STATE, ...patch };
}

describe('zones (planning document: 시작값과 상태 구간)', () => {
  it.each([
    [24, 'danger_low'],
    [25, 'caution_low'],
    [39, 'caution_low'],
    [40, 'normal'],
    [70, 'normal'],
    [71, 'caution_high'],
    [80, 'caution_high'],
    [81, 'danger_high'],
  ] as const)('root moisture %i is %s', (value, zone) => {
    expect(zoneOf('root_moisture', value)).toBe(zone);
  });

  it.each([
    [29, 'danger_low'],
    [30, 'caution_low'],
    [44, 'caution_low'],
    [45, 'normal'],
    [70, 'normal'],
    [71, 'caution_high'],
    [80, 'caution_high'],
    [81, 'danger_high'],
  ] as const)('humidity %i is %s', (value, zone) => {
    expect(zoneOf('humidity', value)).toBe(zone);
  });
});

describe('crisis candidates (planning document: 위기 발생)', () => {
  it('has no candidate at the start values', () => {
    expect(selectCandidates(evidence, INITIAL_PLANT_STATE)).toEqual([]);
  });

  it('water shortage is a candidate when root moisture is on the low side', () => {
    const caution = selectCandidates(evidence, state({ root_moisture: 35 }));
    expect(caution.map((c) => [c.crisis.crisis_id, c.severity])).toEqual([
      ['water_shortage', 'caution'],
    ]);
    const danger = selectCandidates(evidence, state({ root_moisture: 20 }));
    expect(danger[0].severity).toBe('danger');
  });

  it('overwater and mold is a candidate when root moisture or humidity is high and the fan is low', () => {
    expect(
      selectCandidates(evidence, state({ root_moisture: 85 })).map((c) => c.crisis.crisis_id),
    ).toEqual(['overwater_mold']);
    expect(
      selectCandidates(evidence, state({ humidity: 75 })).map((c) => c.crisis.crisis_id),
    ).toEqual(['overwater_mold']);
  });

  it('overwater and mold is not a candidate when the fan is high', () => {
    expect(selectCandidates(evidence, state({ root_moisture: 85, fan: 'high' }))).toEqual([]);
  });

  it('puts danger candidates before caution candidates', () => {
    const both = selectCandidates(evidence, state({ root_moisture: 35, humidity: 85 }));
    expect(both.map((c) => [c.crisis.crisis_id, c.severity])).toEqual([
      ['overwater_mold', 'danger'],
      ['water_shortage', 'caution'],
    ]);
  });
});

describe('crisis probability (planning document: 위기 발생, 판정별 효과)', () => {
  it('is 0 without candidates, 30% in a caution zone, 100% in a danger zone', () => {
    expect(crisisProbability([], null)).toBe(0);
    expect(crisisProbability(selectCandidates(evidence, state({ root_moisture: 35 })), null)).toBe(
      0.3,
    );
    expect(crisisProbability(selectCandidates(evidence, state({ root_moisture: 20 })), null)).toBe(
      1,
    );
  });

  it('adds 30 percentage points for the crisis that ended as partial the day before', () => {
    const candidates = selectCandidates(evidence, state({ root_moisture: 35 }));
    expect(crisisProbability(candidates, 'water_shortage')).toBeCloseTo(0.6);
    expect(crisisProbability(candidates, 'overwater_mold')).toBe(0.3);
  });

  it('does not create a crisis from the bonus alone', () => {
    expect(crisisProbability(selectCandidates(evidence, INITIAL_PLANT_STATE), 'water_shortage')).toBe(
      0,
    );
  });
});

describe('symptom stage (planning document: 증상 진행)', () => {
  const mold = findCrisis(evidence, 'overwater_mold')!;
  const wet = state({ root_moisture: 90 });

  it('is stage 1 on the first danger day, 2 on the second, 3 from the third', () => {
    expect(computeStage(mold, wet, { root_moisture: 1, humidity: 0 }, 0)).toBe(1);
    expect(computeStage(mold, wet, { root_moisture: 2, humidity: 0 }, 0)).toBe(2);
    expect(computeStage(mold, wet, { root_moisture: 3, humidity: 0 }, 0)).toBe(3);
    expect(computeStage(mold, wet, { root_moisture: 5, humidity: 0 }, 0)).toBe(3);
  });

  it('is stage 1 when the crisis starts from a caution zone', () => {
    expect(computeStage(mold, state({ humidity: 75 }), { root_moisture: 0, humidity: 0 }, 0)).toBe(1);
  });

  it('goes up one stage for each inappropriate choice', () => {
    expect(computeStage(mold, wet, { root_moisture: 1, humidity: 0 }, 1)).toBe(2);
    expect(computeStage(mold, wet, { root_moisture: 1, humidity: 0 }, 2)).toBe(3);
  });
});
