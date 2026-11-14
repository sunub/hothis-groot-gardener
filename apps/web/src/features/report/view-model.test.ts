import { describe, expect, it } from 'vitest';
import type {
  CrisisAttemptRecord,
  CrisisRecord,
  DayRecord,
  MicrobialResult,
  MissionState,
  NightRecord,
  PlantState,
  ReportMetrics,
} from '@/lib/contract/types';
import { HARVEST_GRADE, MICROBIAL, ZONE_BOUNDS, zoneOf } from '@/lib/game/rules';
import {
  dayRows,
  deltaParts,
  factorTable,
  failureSummary,
  gradeBands,
  gradeForHealth,
  microbialScale,
  missionSummary,
  percentOf,
  sameSource,
  scalePercent,
  signed,
  triggerView,
  verdictShares,
  zoneRanges,
} from './view-model';

// --- Hand-built fixtures (the engine is not used here) ------------------------

function plant(health: number, root = 55, humidity = 55): PlantState {
  return { plant_health: health, root_moisture: root, humidity, fan: 'low', light: { red: 'medium', blue: 'medium' } };
}

function night(end: PlantState, healthChange: number): NightRecord {
  return {
    drift: { root_moisture: -10, humidity: 5 },
    zones: { root_moisture: zoneOf('root_moisture', end.root_moisture), humidity: zoneOf('humidity', end.humidity) },
    health_change: healthChange,
    end,
  };
}

function attempt(n: number, before: PlantState, after: PlantState, extra: Partial<CrisisAttemptRecord> = {}): CrisisAttemptRecord {
  return {
    attempt: n,
    stage: n,
    offered_action_ids: ['a', 'b'],
    action_id: 'a',
    label: `Choice ${n}`,
    verdict: 'inappropriate',
    delta: { plant_health: -10 },
    before,
    after,
    ground_support: false,
    ...extra,
  };
}

function day(gameDay: number, start: PlantState, rest: Partial<DayRecord> = {}): DayRecord {
  return {
    game_day: gameDay,
    cultivation_day: [1, 6, 12, 17, 22, 28, 33][gameDay - 1],
    growth_stage: 'growth',
    start,
    roll: null,
    care: [],
    crisis: null,
    night: null,
    ...rest,
  };
}

function mission(days: DayRecord[], phase: MissionState['phase']): MissionState {
  const lastDay = days[days.length - 1];
  return {
    schema_version: 1,
    mission_id: 'm1',
    mode: 'standard',
    seed: 7,
    rng_state: 1,
    phase,
    game_day: lastDay.game_day,
    plant: lastDay.night?.end ?? lastDay.start,
    care_ops_used: 0,
    danger_days: { root_moisture: 0, humidity: 0 },
    recurrence: null,
    active_crisis: null,
    days,
    harvest: null,
  };
}

function crisis(attempts: CrisisAttemptRecord[], outcome: CrisisRecord['outcome']): CrisisRecord {
  return { crisis_id: 'overwater_mold', name: 'Overwatering and mold', start_stage: 1, max_stage: 2, attempts, outcome };
}

// --- Tests --------------------------------------------------------------------

describe('harvest grade', () => {
  it('follows HARVEST_GRADE at the boundaries', () => {
    expect(gradeForHealth(HARVEST_GRADE.excellent_min)).toBe('excellent');
    expect(gradeForHealth(HARVEST_GRADE.excellent_min - 1)).toBe('success');
    expect(gradeForHealth(HARVEST_GRADE.success_min)).toBe('success');
    expect(gradeForHealth(HARVEST_GRADE.success_min - 1)).toBe('fail');
    expect(gradeForHealth(0)).toBe('fail');
  });

  it('describes the bands without gaps', () => {
    const [excellent, success, fail] = gradeBands();
    expect(excellent.min).toBe(HARVEST_GRADE.excellent_min);
    expect(success.max).toBe(HARVEST_GRADE.excellent_min - 1);
    expect(fail.max).toBe(HARVEST_GRADE.success_min - 1);
  });
});

describe('microbial scale', () => {
  it('places values in percent and clamps them', () => {
    expect(scalePercent(1.5, 1.5, 6)).toBe(0);
    expect(scalePercent(6, 1.5, 6)).toBe(100);
    expect(scalePercent(3.75, 1.5, 6)).toBeCloseTo(50);
    expect(scalePercent(9, 1.5, 6)).toBe(100);
    expect(scalePercent(1, 1.5, 6)).toBe(0);
    expect(scalePercent(3, 2, 2)).toBe(0);
  });

  it('draws the band and the marker on the MICROBIAL bounds', () => {
    const s = microbialScale(3.75, { min: 2.25, max: 5.25 });
    expect(s.min).toBe(MICROBIAL.min);
    expect(s.max).toBe(MICROBIAL.max);
    expect(s.markerPct).toBeCloseTo(((3.75 - MICROBIAL.min) / (MICROBIAL.max - MICROBIAL.min)) * 100);
    expect(s.bandStartPct).toBeLessThan(s.bandEndPct);
    expect(s.markerAlign).toBe('center');
    expect(microbialScale(MICROBIAL.min, { min: 2, max: 3 }).markerAlign).toBe('start');
    expect(microbialScale(MICROBIAL.max, { min: 2, max: 3 }).markerAlign).toBe('end');
  });
});

describe('factor table', () => {
  const base: MicrobialResult = {
    value: 3.2,
    classification: 'within_range',
    factors: [
      { key: 'baseline', count: 1, change: 3 },
      { key: 'humidity_caution_days', count: 2, change: 0.2 },
      { key: 'harvest_sanitize', count: 0, change: 0 },
    ],
  };

  it('sums the changes and mutes rows without effect', () => {
    const t = factorTable(base);
    expect(t.sum).toBe(3.2);
    expect(t.limited).toBe(false);
    expect(t.rows.map((r) => r.muted)).toEqual([false, false, true]);
    expect(t.rows[2].rule).toEqual({ kind: 'once', amount: MICROBIAL.harvest_sanitize });
  });

  it('flags a value limited by the bounds', () => {
    const t = factorTable({
      value: MICROBIAL.min,
      classification: 'below_range',
      factors: [
        { key: 'baseline', count: 1, change: 1 },
        { key: 'crisis_sanitize', count: 3, change: -0.6 },
      ],
    });
    expect(t.sum).toBe(0.4);
    expect(t.limited).toBe(true);
  });
});

describe('formatting', () => {
  it('signs numbers with a real minus sign', () => {
    expect(signed(5)).toBe('+5');
    expect(signed(-10)).toBe('−10');
    expect(signed(0)).toBe('0');
    expect(signed(-0.3, 2)).toBe('−0.30');
    expect(signed(-0, 2)).toBe('0.00');
  });

  it('never divides by zero', () => {
    expect(percentOf(1, 0)).toBe(0);
    expect(percentOf(1, 3)).toBe(33);
  });
});

describe('summary and verdict shares', () => {
  it('counts crises, choices and nights', () => {
    const d2Start = plant(70, 85);
    const m = mission(
      [
        day(1, plant(70), { night: night(plant(73), 3) }),
        day(2, d2Start, {
          crisis: crisis([attempt(1, d2Start, plant(60, 85)), attempt(2, plant(60, 85), plant(45))], 'ground_support'),
          night: night(plant(48), 3),
        }),
        day(3, plant(48)),
      ],
      'care',
    );
    expect(missionSummary(m)).toEqual({ crises: 1, choices: 2, nights: 2 });
  });

  it('handles a mission without choices', () => {
    const metrics: ReportMetrics = {
      verdict_counts: { appropriate: 0, partial: 0, inappropriate: 0 },
      total_choices: 0,
      attempts_per_crisis: [],
      danger_nights: 0,
      danger_nights_by_metric: { root_moisture: 0, humidity: 0 },
    };
    expect(verdictShares(metrics).map((s) => s.percent)).toEqual([0, 0, 0]);
  });
});

describe('day rows', () => {
  it('reads the end of each day from the night, the last choice or the morning', () => {
    const d2Start = plant(70, 85);
    const m = mission(
      [
        day(1, plant(70), { care: [{ kind: 'water', level: 'normal' }], night: night(plant(73), 3) }),
        day(2, d2Start, {
          crisis: crisis([attempt(1, d2Start, plant(75), { verdict: 'appropriate' })], 'resolved'),
          night: night(plant(78), 3),
        }),
        day(7, plant(78)),
      ],
      'report',
    );
    const rows = dayRows(m);
    expect(rows.map((r) => r.healthChange)).toEqual([3, 8, 0]);
    expect(rows[1].crisis?.choices[0]).toMatchObject({ verdict: 'appropriate', healthBefore: 70, healthAfter: 75 });
    expect(rows[2].night).toBeNull();
    expect(rows.some((r) => r.failedHere)).toBe(false);
  });
});

describe('failure summary', () => {
  it('names the crisis choice when health reached 0 during a crisis', () => {
    const start = plant(15, 90);
    const m = mission(
      [
        day(1, plant(70), { night: night(plant(73), 3) }),
        day(2, start, {
          crisis: crisis(
            [attempt(1, start, plant(5, 90)), attempt(2, plant(5, 90), plant(0), { ground_support: true })],
            'mission_failed',
          ),
        }),
      ],
      'failed',
    );
    const f = failureSummary(m);
    expect(f).toMatchObject({ gameDay: 2, cultivationDay: 6 });
    expect(f?.cause).toMatchObject({ kind: 'crisis', label: 'Choice 2', groundSupport: true, healthBefore: 5, healthAfter: 0 });
    expect(dayRows(m)[1].failedHere).toBe(true);
    expect(dayRows(m)[1].end.plant_health).toBe(0);
  });

  it('names the night when health reached 0 overnight, after a crisis that day', () => {
    const start = plant(25, 20);
    const m = mission(
      [
        day(3, start, {
          crisis: crisis([attempt(1, start, plant(20, 20), { verdict: 'partial' })], 'partial'),
          night: night(plant(0, 10, 85), -20),
        }),
      ],
      'failed',
    );
    const f = failureSummary(m);
    expect(f?.cause).toMatchObject({
      kind: 'night',
      healthBefore: 20,
      healthChange: -20,
      zones: { root_moisture: 'danger_low', humidity: 'danger_high' },
      earlierCrisis: { outcome: 'partial' },
    });
  });

  it('returns null for an empty record', () => {
    expect(failureSummary({ ...mission([day(1, plant(70))], 'failed'), days: [] })).toBeNull();
  });
});

describe('evidence in words', () => {
  it('splits a delta into parts in a fixed order', () => {
    expect(deltaParts({ plant_health: 5, humidity: 'to_mid', root_moisture: 'half_to_mid', fan: 'high' })).toEqual([
      { kind: 'half_to_mid', metric: 'root_moisture' },
      { kind: 'to_mid', metric: 'humidity' },
      { kind: 'health', amount: 5 },
      { kind: 'fan', level: 'high' },
    ]);
    expect(deltaParts({ root_moisture: 20 })).toEqual([{ kind: 'add', metric: 'root_moisture', amount: 20 }]);
    expect(deltaParts({})).toEqual([]);
  });

  it('reads triggers with and without a fan condition', () => {
    expect(triggerView({ any_of: [{ metric: 'root_moisture', side: 'low' }] }).fan).toBeNull();
    expect(triggerView({ any_of: [], fan: 'low' }).fan).toBe('low');
  });

  it('turns zone bounds into ranges that agree with zoneOf', () => {
    const ranges = zoneRanges(ZONE_BOUNDS.humidity);
    for (let v = 0; v <= 100; v += 1) {
      const zone = zoneOf('humidity', v);
      const r = ranges.find((x) => x.zone === zone);
      expect(r).toBeDefined();
      if (!r) continue;
      if (r.lower) expect(r.lower.inclusive ? v >= r.lower.value : v > r.lower.value).toBe(true);
      if (r.upper) expect(r.upper.inclusive ? v <= r.upper.value : v < r.upper.value).toBe(true);
    }
  });

  it('compares sources by document and sentence', () => {
    const a = { title: 't', url: 'u', quote: 'q' };
    expect(sameSource(a, { ...a })).toBe(true);
    expect(sameSource(a, { ...a, quote: 'other' })).toBe(false);
    expect(sameSource(a, null)).toBe(false);
  });
});
