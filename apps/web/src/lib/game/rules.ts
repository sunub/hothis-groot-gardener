import criteria from '@content/state-criteria.json';
import type {
  FanLevel,
  GrowthStage,
  LightSetting,
  Metric,
  PlantState,
  Verdict,
  Zone,
  ZoneSide,
} from '@/lib/contract/types';

/**
 * Game rules as constants. Every number here is a game value from the
 * planning document's "게임 규칙" section. None of them is a NASA value.
 */

export const METRICS: readonly Metric[] = ['root_moisture', 'humidity'];

// --- Mission length and dates ------------------------------------------------

export const GAME_DAYS = 7;

/** Game day (1-7) to cultivation day. */
export const CULTIVATION_DAYS: readonly number[] = [1, 6, 12, 17, 22, 28, 33];

export const GROWTH_STAGES: readonly GrowthStage[] = [
  'germination',
  'germination',
  'growth',
  'growth',
  'growth',
  'pre_harvest',
  'harvest',
];

/** Crises can occur on these game days only. */
export const FIRST_CRISIS_DAY = 2;
export const LAST_CRISIS_DAY = 6;

export function cultivationDayOf(gameDay: number): number {
  return CULTIVATION_DAYS[gameDay - 1];
}

export function growthStageOf(gameDay: number): GrowthStage {
  return GROWTH_STAGES[gameDay - 1];
}

// --- Start values and zones --------------------------------------------------

export const DEFAULT_LIGHT: LightSetting = { red: 'medium', blue: 'medium' };

export const INITIAL_PLANT_STATE: PlantState = {
  plant_health: 70,
  root_moisture: 55,
  humidity: 55,
  fan: 'low',
  light: DEFAULT_LIGHT,
};

export const METRIC_MIN = 0;
export const METRIC_MAX = 100;
export const HEALTH_MIN = 0;
export const HEALTH_MAX = 100;

/** Middle of the normal zone. */
export const NORMAL_MID: number = criteria.normal_mid;

export interface ZoneBounds {
  danger_low_below: number;
  caution_low_below: number;
  normal_max: number;
  caution_high_max: number;
}

export const ZONE_BOUNDS: Record<Metric, ZoneBounds> = criteria.zones;

export function zoneOf(metric: Metric, value: number): Zone {
  const b = ZONE_BOUNDS[metric];
  if (value < b.danger_low_below) return 'danger_low';
  if (value < b.caution_low_below) return 'caution_low';
  if (value <= b.normal_max) return 'normal';
  if (value <= b.caution_high_max) return 'caution_high';
  return 'danger_high';
}

export function isDanger(zone: Zone): boolean {
  return zone === 'danger_low' || zone === 'danger_high';
}

export function isCaution(zone: Zone): boolean {
  return zone === 'caution_low' || zone === 'caution_high';
}

export function sideOf(zone: Zone): ZoneSide | null {
  if (zone === 'danger_low' || zone === 'caution_low') return 'low';
  if (zone === 'danger_high' || zone === 'caution_high') return 'high';
  return null;
}

export function clampMetric(value: number): number {
  return Math.min(METRIC_MAX, Math.max(METRIC_MIN, value));
}

export function clampHealth(value: number): number {
  return Math.min(HEALTH_MAX, Math.max(HEALTH_MIN, value));
}

// --- Day progress and daily care ---------------------------------------------

/** Overnight change per fan setting. */
export const NIGHT_DRIFT: Record<FanLevel, Record<Metric, number>> = {
  low: { root_moisture: -10, humidity: 5 },
  high: { root_moisture: -15, humidity: -10 },
};

export const MAX_CARE_OPS_PER_DAY = 2;

export const WATER_AMOUNT: Record<'normal' | 'heavy', number> = {
  normal: 10,
  heavy: 20,
};

// --- Crisis occurrence -------------------------------------------------------

export const CRISIS_PROBABILITY = {
  danger: 1,
  caution: 0.3,
  /** Added on the day after a partial verdict for the same crisis. */
  recurrence_bonus: 0.3,
} as const;

// --- Verdict effects ---------------------------------------------------------

/** Default plant-health change per verdict when writing the evidence list. */
export const VERDICT_HEALTH_DEFAULT: Record<Verdict, number> = {
  appropriate: 5,
  partial: 0,
  inappropriate: -10,
};

/** This many inappropriate choices in a row end the crisis by ground control support. */
export const GROUND_SUPPORT_AFTER = 2;
export const GROUND_SUPPORT_HEALTH = -15;

// --- Plant health and harvest ------------------------------------------------

export const NIGHT_HEALTH = {
  per_danger_metric: -10,
  per_caution_metric: -3,
  all_normal: 3,
} as const;

export const HARVEST_GRADE = {
  excellent_min: 80,
  success_min: 50,
} as const;

// --- Microbial value of the harvest (game value) -----------------------------

export const MICROBIAL = {
  baseline: 3.0,
  humidity_caution_day: 0.1,
  humidity_danger_day: 0.2,
  mold_partial_end: 0.3,
  mold_inappropriate: 0.5,
  mold_stage_3: 0.5,
  crisis_sanitize: -0.2,
  crisis_sanitize_floor: -0.6,
  harvest_sanitize: -0.3,
  min: 1.5,
  max: 6.0,
} as const;

/** Crisis whose record feeds the mold-related microbial rules. */
export const MOLD_CRISIS_ID = 'overwater_mold';
/** Action that counts as "surface sanitizing during a crisis". */
export const SANITIZE_ACTION_ID = 'clean_plant_surfaces';
/** Symptom stage that counts as "progressed to the mold stage". */
export const MOLD_STAGE = 3;

// --- Demo mode ---------------------------------------------------------------

/**
 * Fixed seed for demo mode. With this seed the crisis rolls on game days 3
 * and 5 succeed in a caution zone (both rolls are below 0.3), so the care
 * steps in docs/DEMO-SCRIPT.md show both crises on fixed days.
 * The mission run-through test checks this.
 */
export const DEMO_SEED = 2042;
