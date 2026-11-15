import type {
  ActionDelta,
  CareOp,
  CrisisOutcome,
  CrisisTrigger,
  DayRecord,
  FanLevel,
  GrowthStage,
  HarvestGrade,
  Metric,
  MicrobialFactorKey,
  MicrobialResult,
  MissionState,
  NightRecord,
  OvernightChange,
  PlantState,
  ReportMetrics,
  SourceRef,
  Verdict,
  Zone,
  ZoneSide,
} from '@/lib/contract/types';
import { HARVEST_GRADE, METRICS, MICROBIAL, type ZoneBounds } from '@/lib/game/rules';

/**
 * Pure helpers that turn the mission record into view data for the harvest,
 * report and sources screens. They never change the mission and return
 * structured data; the screens turn it into words with the dictionary.
 */

// ---------------------------------------------------------------------------
// Harvest grade
// ---------------------------------------------------------------------------

/** Harvest grade from plant health only, for the preview before harvesting. */
export function gradeForHealth(health: number): HarvestGrade {
  if (health >= HARVEST_GRADE.excellent_min) return 'excellent';
  if (health >= HARVEST_GRADE.success_min) return 'success';
  return 'fail';
}

/** Grade bands as numbers, so the screens never write the thresholds themselves. */
export function gradeBands(): { grade: HarvestGrade; min: number | null; max: number | null }[] {
  return [
    { grade: 'excellent', min: HARVEST_GRADE.excellent_min, max: null },
    { grade: 'success', min: HARVEST_GRADE.success_min, max: HARVEST_GRADE.excellent_min - 1 },
    { grade: 'fail', min: null, max: HARVEST_GRADE.success_min - 1 },
  ];
}

// ---------------------------------------------------------------------------
// Microbial scale
// ---------------------------------------------------------------------------

/** Position of a value on a min-max scale, in percent, clamped to 0-100. */
export function scalePercent(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  const pct = ((value - min) / (max - min)) * 100;
  return Math.min(100, Math.max(0, pct));
}

export interface MicrobialScaleView {
  min: number;
  max: number;
  markerPct: number;
  bandStartPct: number;
  bandEndPct: number;
  /** Where the marker label anchors, so it stays inside the track at the ends. */
  markerAlign: 'start' | 'center' | 'end';
}

export function microbialScale(
  value: number,
  range: { min: number; max: number },
  bounds: { min: number; max: number } = MICROBIAL,
): MicrobialScaleView {
  const markerPct = scalePercent(value, bounds.min, bounds.max);
  return {
    min: bounds.min,
    max: bounds.max,
    markerPct,
    bandStartPct: scalePercent(range.min, bounds.min, bounds.max),
    bandEndPct: scalePercent(range.max, bounds.min, bounds.max),
    markerAlign: markerPct < 15 ? 'start' : markerPct > 85 ? 'end' : 'center',
  };
}

// ---------------------------------------------------------------------------
// Microbial factors
// ---------------------------------------------------------------------------

/** The rule behind each factor, as numbers from MICROBIAL. */
export type FactorRule =
  | { kind: 'start'; amount: number }
  | { kind: 'each'; amount: number }
  | { kind: 'each_capped'; amount: number; floor: number }
  | { kind: 'once'; amount: number };

/** Factor keys in the order of the planning document's table. */
export const FACTOR_KEYS: readonly MicrobialFactorKey[] = [
  'baseline',
  'humidity_caution_days',
  'humidity_danger_days',
  'mold_partial_end',
  'mold_inappropriate',
  'mold_stage_3',
  'crisis_sanitize',
  'harvest_sanitize',
];

export function factorRule(key: MicrobialFactorKey): FactorRule {
  switch (key) {
    case 'baseline':
      return { kind: 'start', amount: MICROBIAL.baseline };
    case 'humidity_caution_days':
      return { kind: 'each', amount: MICROBIAL.humidity_caution_day };
    case 'humidity_danger_days':
      return { kind: 'each', amount: MICROBIAL.humidity_danger_day };
    case 'mold_partial_end':
      return { kind: 'each', amount: MICROBIAL.mold_partial_end };
    case 'mold_inappropriate':
      return { kind: 'each', amount: MICROBIAL.mold_inappropriate };
    case 'mold_stage_3':
      return { kind: 'once', amount: MICROBIAL.mold_stage_3 };
    case 'crisis_sanitize':
      return { kind: 'each_capped', amount: MICROBIAL.crisis_sanitize, floor: MICROBIAL.crisis_sanitize_floor };
    case 'harvest_sanitize':
      return { kind: 'once', amount: MICROBIAL.harvest_sanitize };
  }
}

export interface FactorRow {
  key: MicrobialFactorKey;
  count: number;
  change: number;
  rule: FactorRule;
  /** True when the condition did not change the value. */
  muted: boolean;
}

export interface FactorTable {
  rows: FactorRow[];
  /** Sum of all changes before the bounds are applied. */
  sum: number;
  value: number;
  /** True when the sum lay outside the bounds and the value was limited. */
  limited: boolean;
}

function round2(value: number): number {
  // `+ 0` turns -0 into 0.
  return Math.round(value * 100) / 100 + 0;
}

export function factorTable(result: MicrobialResult): FactorTable {
  const rows = result.factors.map((f) => ({
    key: f.key,
    count: f.count,
    change: f.change,
    rule: factorRule(f.key),
    muted: f.change === 0,
  }));
  const sum = round2(result.factors.reduce((s, f) => s + f.change, 0));
  return { rows, sum, value: result.value, limited: sum !== round2(result.value) };
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

/** Signed number with a real minus sign. `digits` fixes the decimals when given. */
export function signed(value: number, digits?: number): string {
  const v = value + 0;
  const abs = digits === undefined ? String(Math.abs(v)) : Math.abs(v).toFixed(digits);
  if (v > 0) return `+${abs}`;
  if (v < 0) return `−${abs}`;
  return digits === undefined ? '0' : (0).toFixed(digits);
}

/** Two decimals, the precision of the microbial values in log10 units. */
export function fixed2(value: number): string {
  return (value + 0).toFixed(2);
}

/** Share in whole percent; 0 when the total is 0. */
export function percentOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

// ---------------------------------------------------------------------------
// Mission summary and crisis metrics
// ---------------------------------------------------------------------------

export interface MissionSummary {
  crises: number;
  choices: number;
  /** Nights that the record holds. */
  nights: number;
}

export function missionSummary(mission: MissionState): MissionSummary {
  let crises = 0;
  let choices = 0;
  let nights = 0;
  for (const day of mission.days) {
    if (day.crisis) {
      crises += 1;
      choices += day.crisis.attempts.length;
    }
    if (day.night) nights += 1;
  }
  return { crises, choices, nights };
}

export interface VerdictShare {
  verdict: Verdict;
  count: number;
  percent: number;
}

const VERDICT_ORDER: readonly Verdict[] = ['appropriate', 'partial', 'inappropriate'];

export function verdictShares(metrics: ReportMetrics): VerdictShare[] {
  return VERDICT_ORDER.map((verdict) => ({
    verdict,
    count: metrics.verdict_counts[verdict],
    percent: percentOf(metrics.verdict_counts[verdict], metrics.total_choices),
  }));
}

// ---------------------------------------------------------------------------
// Cultivation record
// ---------------------------------------------------------------------------

export interface ChoiceRow {
  attempt: number;
  stage: number;
  label: string;
  verdict: Verdict;
  groundSupport: boolean;
  healthBefore: number;
  healthAfter: number;
}

export interface DayRow {
  gameDay: number;
  cultivationDay: number;
  stage: GrowthStage;
  morning: PlantState;
  care: CareOp[];
  crisis: {
    name: string;
    maxStage: number;
    choices: ChoiceRow[];
    outcome: CrisisOutcome | null;
  } | null;
  night: NightRecord | null;
  /** The overnight change that raised this day's crisis, if any (older saves have none). */
  overnightChange: OvernightChange | null;
  /** State at the end of the day: after the night, else after the last choice, else the morning. */
  end: PlantState;
  healthChange: number;
  /** True for the last day of a mission that failed. */
  failedHere: boolean;
}

function endOfDay(day: DayRecord): PlantState {
  if (day.night) return day.night.end;
  const attempts = day.crisis?.attempts ?? [];
  if (attempts.length > 0) return attempts[attempts.length - 1].after;
  return day.start;
}

export function dayRows(mission: MissionState): DayRow[] {
  const last = mission.days.length - 1;
  return mission.days.map((day, i) => {
    const end = endOfDay(day);
    return {
      gameDay: day.game_day,
      cultivationDay: day.cultivation_day,
      stage: day.growth_stage,
      morning: day.start,
      care: day.care,
      crisis: day.crisis
        ? {
            name: day.crisis.name,
            maxStage: day.crisis.max_stage,
            outcome: day.crisis.outcome,
            choices: day.crisis.attempts.map((a) => ({
              attempt: a.attempt,
              stage: a.stage,
              label: a.label,
              verdict: a.verdict,
              groundSupport: a.ground_support,
              healthBefore: a.before.plant_health,
              healthAfter: a.after.plant_health,
            })),
          }
        : null,
      night: day.night,
      overnightChange: day.overnight_change ?? null,
      end,
      healthChange: end.plant_health - day.start.plant_health,
      failedHere: mission.phase === 'failed' && i === last,
    };
  });
}

// ---------------------------------------------------------------------------
// Mission failure
// ---------------------------------------------------------------------------

export type FailureCause =
  | {
      kind: 'crisis';
      crisisName: string;
      label: string;
      verdict: Verdict;
      groundSupport: boolean;
      healthBefore: number;
      healthAfter: number;
    }
  | {
      kind: 'night';
      zones: Record<Metric, Zone>;
      healthChange: number;
      healthBefore: number;
      /** Crisis of the same day that ended before the night, if any. */
      earlierCrisis: { name: string; outcome: CrisisOutcome | null } | null;
    }
  | { kind: 'unknown' };

export interface FailureSummary {
  gameDay: number;
  cultivationDay: number;
  cause: FailureCause;
}

/** What ended a failed mission, read from the last day of the record. */
export function failureSummary(mission: MissionState): FailureSummary | null {
  const day = mission.days[mission.days.length - 1];
  if (!day) return null;
  const base = { gameDay: day.game_day, cultivationDay: day.cultivation_day };
  const crisis = day.crisis;
  const lastAttempt = crisis && crisis.attempts.length > 0 ? crisis.attempts[crisis.attempts.length - 1] : null;

  if (crisis && crisis.outcome === 'mission_failed' && lastAttempt) {
    return {
      ...base,
      cause: {
        kind: 'crisis',
        crisisName: crisis.name,
        label: lastAttempt.label,
        verdict: lastAttempt.verdict,
        groundSupport: lastAttempt.ground_support,
        healthBefore: lastAttempt.before.plant_health,
        healthAfter: lastAttempt.after.plant_health,
      },
    };
  }
  if (day.night) {
    const before = lastAttempt ? lastAttempt.after.plant_health : day.start.plant_health;
    return {
      ...base,
      cause: {
        kind: 'night',
        zones: day.night.zones,
        healthChange: day.night.health_change,
        healthBefore: before,
        earlierCrisis: crisis ? { name: crisis.name, outcome: crisis.outcome } : null,
      },
    };
  }
  return { ...base, cause: { kind: 'unknown' } };
}

// ---------------------------------------------------------------------------
// Evidence in words
// ---------------------------------------------------------------------------

export type DeltaPart =
  | { kind: 'add'; metric: Metric; amount: number }
  | { kind: 'to_mid'; metric: Metric }
  | { kind: 'half_to_mid'; metric: Metric }
  | { kind: 'health'; amount: number }
  | { kind: 'fan'; level: FanLevel };

/** An action's state change as parts the screen turns into words. */
export function deltaParts(delta: ActionDelta): DeltaPart[] {
  const parts: DeltaPart[] = [];
  for (const metric of METRICS) {
    const op = delta[metric];
    if (op === undefined) continue;
    if (typeof op === 'number') parts.push({ kind: 'add', metric, amount: op });
    else parts.push({ kind: op, metric });
  }
  if (delta.plant_health !== undefined) parts.push({ kind: 'health', amount: delta.plant_health });
  if (delta.fan !== undefined) parts.push({ kind: 'fan', level: delta.fan });
  return parts;
}

export interface TriggerView {
  conditions: { metric: Metric; side: ZoneSide }[];
  fan: FanLevel | null;
}

export function triggerView(trigger: CrisisTrigger): TriggerView {
  return {
    conditions: trigger.any_of.map((c) => ({ metric: c.metric, side: c.side })),
    fan: trigger.fan ?? null,
  };
}

export type Bound = { value: number; inclusive: boolean } | null;

export interface ZoneRange {
  zone: Zone;
  lower: Bound;
  upper: Bound;
}

/** The five zones of one metric as lower and upper bounds, matching zoneOf in rules.ts. */
export function zoneRanges(b: ZoneBounds): ZoneRange[] {
  return [
    { zone: 'danger_low', lower: null, upper: { value: b.danger_low_below, inclusive: false } },
    {
      zone: 'caution_low',
      lower: { value: b.danger_low_below, inclusive: true },
      upper: { value: b.caution_low_below, inclusive: false },
    },
    {
      zone: 'normal',
      lower: { value: b.caution_low_below, inclusive: true },
      upper: { value: b.normal_max, inclusive: true },
    },
    {
      zone: 'caution_high',
      lower: { value: b.normal_max, inclusive: false },
      upper: { value: b.caution_high_max, inclusive: true },
    },
    { zone: 'danger_high', lower: { value: b.caution_high_max, inclusive: false }, upper: null },
  ];
}

/** True when two sources point to the same sentence of the same document. */
export function sameSource(a: SourceRef | null, b: SourceRef | null): boolean {
  if (!a || !b) return false;
  return a.url === b.url && a.title === b.title && a.quote === b.quote;
}
