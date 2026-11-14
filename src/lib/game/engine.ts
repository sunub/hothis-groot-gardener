import type {
  ActionDelta,
  CareOp,
  CrisisAttemptRecord,
  CrisisHistoryEntry,
  CrisisOutcome,
  CrisisRecord,
  CrisisRequest,
  CrisisResponse,
  DayRecord,
  EvidenceCrisis,
  EvidenceList,
  HarvestGrade,
  Locale,
  Metric,
  MetricOp,
  MicrobialFactor,
  MicrobialFactorKey,
  MicrobialResult,
  MissionMode,
  MissionState,
  NightRecord,
  PlantState,
  RangeClass,
  ReportMetrics,
  Verdict,
  Zone,
} from '@/lib/contract/types';
import {
  computeStage,
  crisisProbability,
  evidence as defaultEvidence,
  findAction,
  findCrisis,
  selectCandidates,
} from '@/lib/evidence';
import { nextRandom, toRngState } from './rng';
import {
  clampHealth,
  clampMetric,
  cultivationDayOf,
  DEMO_SEED,
  FIRST_CRISIS_DAY,
  GAME_DAYS,
  GROUND_SUPPORT_AFTER,
  GROUND_SUPPORT_HEALTH,
  growthStageOf,
  HARVEST_GRADE,
  INITIAL_PLANT_STATE,
  isCaution,
  isDanger,
  LAST_CRISIS_DAY,
  MAX_CARE_OPS_PER_DAY,
  METRICS,
  MICROBIAL,
  MOLD_CRISIS_ID,
  MOLD_STAGE,
  NIGHT_DRIFT,
  NIGHT_HEALTH,
  NORMAL_MID,
  SANITIZE_ACTION_ID,
  sideOf,
  WATER_AMOUNT,
  zoneOf,
} from './rules';

/**
 * Game logic. Pure functions: each takes a mission state and returns a new
 * one. No function here reads the clock, the network or browser storage.
 *
 * Phase flow:
 *   care -> endDay -> night -> nextDay -> care | crisis_pending | harvest
 *   crisis_pending -> receiveCrisis -> crisis -> chooseOption -> crisis_result
 *   crisis_result -> continueAfterResult -> crisis_pending | night
 *   harvest -> harvestCrop -> freeze -> confirmFreeze -> report
 *   any phase -> failed, the moment plant health reaches 0
 */

/** Thrown when a transition is called in a phase or with an input that the rules do not allow. */
export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameRuleError';
  }
}

export interface MissionConfig {
  mission_id: string;
  mode: MissionMode;
  /** Ignored in demo mode, which always uses DEMO_SEED. */
  seed: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function copyPlant(plant: PlantState): PlantState {
  return { ...plant, light: { ...plant.light } };
}

function requirePhase(state: MissionState, phase: MissionState['phase'], action: string): void {
  if (state.phase !== phase) {
    throw new GameRuleError(`${action} is allowed in the ${phase} phase, not in ${state.phase}`);
  }
}

function newDayRecord(gameDay: number, start: PlantState): DayRecord {
  return {
    game_day: gameDay,
    cultivation_day: cultivationDayOf(gameDay),
    growth_stage: growthStageOf(gameDay),
    start: copyPlant(start),
    roll: null,
    care: [],
    crisis: null,
    night: null,
  };
}

/** Replace today's record (the last one) with the result of `update`. */
function updateToday(days: readonly DayRecord[], update: (day: DayRecord) => DayRecord): DayRecord[] {
  const last = days.length - 1;
  return days.map((day, i) => (i === last ? update(day) : day));
}

function todayOf(state: MissionState): DayRecord {
  return state.days[state.days.length - 1];
}

function isNormal(metric: Metric, value: number): boolean {
  return zoneOf(metric, value) === 'normal';
}

function applyMetricOp(metric: Metric, value: number, op: MetricOp): number {
  if (typeof op === 'number') return clampMetric(value + op);
  if (isNormal(metric, value)) return value;
  if (op === 'to_mid') return NORMAL_MID;
  return clampMetric(Math.round(value + (NORMAL_MID - value) / 2));
}

function applyDelta(plant: PlantState, delta: ActionDelta): PlantState {
  const next = copyPlant(plant);
  for (const metric of METRICS) {
    const op = delta[metric];
    if (op !== undefined) next[metric] = applyMetricOp(metric, next[metric], op);
  }
  if (delta.fan !== undefined) next.fan = delta.fan;
  if (delta.plant_health !== undefined) {
    next.plant_health = clampHealth(next.plant_health + delta.plant_health);
  }
  return next;
}

function requireCrisis(evidence: EvidenceList, crisisId: string): EvidenceCrisis {
  const crisis = findCrisis(evidence, crisisId);
  if (!crisis) throw new GameRuleError(`crisis ${crisisId} is not in the evidence list`);
  return crisis;
}

/** Round to two decimals so sums like 0.1 * 3 compare and display cleanly. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Night
// ---------------------------------------------------------------------------

/** What tonight does to a plant: drift, zones after the drift, and the plant health change. */
export interface NightProjection {
  plant: PlantState;
  drift: Record<Metric, number>;
  zones: Record<Metric, Zone>;
  health_change: number;
}

/**
 * Values after tonight, without changing the mission. The care screen uses it
 * to show the expected state; the night itself uses the same calculation.
 */
export function projectNight(plant: PlantState): NightProjection {
  const drift = { ...NIGHT_DRIFT[plant.fan] };
  const next = copyPlant(plant);
  for (const metric of METRICS) next[metric] = clampMetric(next[metric] + drift[metric]);
  const zones = {
    root_moisture: zoneOf('root_moisture', next.root_moisture),
    humidity: zoneOf('humidity', next.humidity),
  };
  let healthChange = 0;
  let allNormal = true;
  for (const metric of METRICS) {
    if (isDanger(zones[metric])) healthChange += NIGHT_HEALTH.per_danger_metric;
    else if (isCaution(zones[metric])) healthChange += NIGHT_HEALTH.per_caution_metric;
    if (zones[metric] !== 'normal') allNormal = false;
  }
  if (allNormal) healthChange = NIGHT_HEALTH.all_normal;
  next.plant_health = clampHealth(next.plant_health + healthChange);
  return { plant: next, drift, zones, health_change: healthChange };
}

function runNight(state: MissionState): MissionState {
  const projection = projectNight(state.plant);
  // The record of the previous game day holds last night's zones.
  const previousNight = state.days.length >= 2 ? state.days[state.days.length - 2].night : null;
  const dangerDays = { ...state.danger_days };
  for (const metric of METRICS) {
    const zone = projection.zones[metric];
    if (!isDanger(zone)) {
      dangerDays[metric] = 0;
      continue;
    }
    const previous = previousNight?.zones[metric];
    const sameSide = previous !== undefined && isDanger(previous) && sideOf(previous) === sideOf(zone);
    dangerDays[metric] = sameSide ? state.danger_days[metric] + 1 : 1;
  }
  const record: NightRecord = {
    drift: projection.drift,
    zones: projection.zones,
    health_change: projection.health_change,
    end: copyPlant(projection.plant),
  };
  return {
    ...state,
    plant: projection.plant,
    danger_days: dangerDays,
    days: updateToday(state.days, (day) => ({ ...day, night: record })),
    phase: projection.plant.plant_health <= 0 ? 'failed' : 'night',
  };
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

/** Start a mission on game day 1 in the care phase. */
export function createMission(config: MissionConfig): MissionState {
  const seed = config.mode === 'demo' ? DEMO_SEED : toRngState(config.seed);
  const plant = copyPlant(INITIAL_PLANT_STATE);
  return {
    schema_version: 1,
    mission_id: config.mission_id,
    mode: config.mode,
    seed,
    rng_state: seed,
    phase: 'care',
    game_day: 1,
    plant,
    care_ops_used: 0,
    danger_days: { root_moisture: 0, humidity: 0 },
    recurrence: null,
    active_crisis: null,
    days: [newDayRecord(1, plant)],
    harvest: null,
  };
}

/** Apply one daily care operation. Allowed in the care phase, up to MAX_CARE_OPS_PER_DAY per day. */
export function applyCare(state: MissionState, op: CareOp): MissionState {
  requirePhase(state, 'care', 'Daily care');
  if (state.care_ops_used >= MAX_CARE_OPS_PER_DAY) {
    throw new GameRuleError(`Only ${MAX_CARE_OPS_PER_DAY} care operations are allowed per day`);
  }
  const plant = copyPlant(state.plant);
  let recorded: CareOp;
  switch (op.kind) {
    case 'water':
      plant.root_moisture = clampMetric(plant.root_moisture + WATER_AMOUNT[op.level]);
      recorded = { kind: 'water', level: op.level };
      break;
    case 'fan':
      if (plant.fan === op.level) throw new GameRuleError(`The fan is already ${op.level}`);
      plant.fan = op.level;
      recorded = { kind: 'fan', level: op.level };
      break;
    case 'light':
      if (plant.light.red === op.red && plant.light.blue === op.blue) {
        throw new GameRuleError('The light is already at this setting');
      }
      // Lighting has no numeric effect (implementation note 5).
      plant.light = { red: op.red, blue: op.blue };
      recorded = { kind: 'light', red: op.red, blue: op.blue };
      break;
  }
  return {
    ...state,
    plant,
    care_ops_used: state.care_ops_used + 1,
    days: updateToday(state.days, (day) => ({ ...day, care: [...day.care, recorded] })),
  };
}

/** End the day from the care phase: overnight drift, zone check, plant health. */
export function endDay(state: MissionState): MissionState {
  requirePhase(state, 'care', 'Ending the day');
  return runNight(state);
}

/** Move from the night phase to the next game day and decide whether a crisis occurs. */
export function nextDay(state: MissionState, evidence: EvidenceList): MissionState {
  requirePhase(state, 'night', 'Moving to the next day');
  const gameDay = state.game_day + 1;
  const base: MissionState = {
    ...state,
    game_day: gameDay,
    care_ops_used: 0,
    active_crisis: null,
    days: [...state.days, newDayRecord(gameDay, state.plant)],
  };
  if (gameDay >= GAME_DAYS) {
    // Harvest day: no roll. A recurrence from day 6 has no day left to apply to.
    return { ...base, game_day: GAME_DAYS, recurrence: null, phase: 'harvest' };
  }
  if (gameDay < FIRST_CRISIS_DAY || gameDay > LAST_CRISIS_DAY) {
    return { ...base, phase: 'care' };
  }

  // Always draw once, so the same seed gives the same number on each day (note 6).
  const draw = nextRandom(state.rng_state);
  const candidates = selectCandidates(evidence, state.plant);
  const recurrenceId =
    state.recurrence && state.recurrence.game_day === gameDay ? state.recurrence.crisis_id : null;
  const probability = crisisProbability(candidates, recurrenceId);
  const occurred = candidates.length > 0 && draw.value < probability;
  const ids = candidates.map((c) => c.crisis.crisis_id);

  return {
    ...base,
    rng_state: draw.state,
    recurrence: null,
    days: updateToday(base.days, (day) => ({
      ...day,
      roll: { candidates: ids, probability, roll: draw.value, occurred },
    })),
    active_crisis: occurred
      ? {
          candidates: ids,
          crisis_id: null,
          attempt: 1,
          stage: 0,
          inappropriate_action_ids: [],
          response: null,
        }
      : null,
    phase: occurred ? 'crisis_pending' : 'care',
  };
}

/** Finished crises in the record, oldest first. */
function crisisHistory(state: MissionState): CrisisHistoryEntry[] {
  const history: CrisisHistoryEntry[] = [];
  for (const day of state.days) {
    const crisis = day.crisis;
    if (!crisis || crisis.outcome === null) continue;
    history.push({
      crisis_id: crisis.crisis_id,
      cultivation_day: day.cultivation_day,
      choices: crisis.attempts.map((a) => ({ action_id: a.action_id, verdict: a.verdict })),
      outcome: crisis.outcome,
    });
  }
  return history;
}

/** Body for POST /api/crisis. Allowed in the crisis_pending phase. */
export function buildCrisisRequest(state: MissionState, locale: Locale): CrisisRequest {
  requirePhase(state, 'crisis_pending', 'A crisis request');
  const active = state.active_crisis;
  if (!active) throw new GameRuleError('No active crisis');
  return {
    locale,
    cultivation_day: cultivationDayOf(state.game_day),
    state: copyPlant(state.plant),
    danger_days: { ...state.danger_days },
    history: crisisHistory(state),
    active:
      active.crisis_id === null
        ? null
        : {
            crisis_id: active.crisis_id,
            attempt: active.attempt,
            chosen_action_ids: [...active.inappropriate_action_ids],
          },
  };
}

/** Accept the crisis API response and show the crisis. */
export function receiveCrisis(
  state: MissionState,
  response: CrisisResponse,
  evidence: EvidenceList,
): MissionState {
  requirePhase(state, 'crisis_pending', 'Receiving a crisis');
  const active = state.active_crisis;
  if (!active) throw new GameRuleError('No active crisis');
  if (!active.candidates.includes(response.crisis_id)) {
    throw new GameRuleError(`Crisis ${response.crisis_id} is not a candidate today`);
  }
  if (active.crisis_id !== null && active.crisis_id !== response.crisis_id) {
    throw new GameRuleError(`Expected crisis ${active.crisis_id}, got ${response.crisis_id}`);
  }
  const crisis = requireCrisis(evidence, response.crisis_id);
  for (const option of response.options) {
    if (!findAction(crisis, option.action_id)) {
      throw new GameRuleError(`Action ${option.action_id} is not listed for ${crisis.crisis_id}`);
    }
  }

  // The engine decides the stage; the response's stage is only what the server assumed.
  const stage = computeStage(
    crisis,
    state.plant,
    state.danger_days,
    active.inappropriate_action_ids.length,
  );
  const firstPresentation = active.crisis_id === null;
  return {
    ...state,
    active_crisis: { ...active, crisis_id: crisis.crisis_id, stage, response },
    days: firstPresentation
      ? updateToday(state.days, (day) => ({
          ...day,
          crisis: {
            crisis_id: crisis.crisis_id,
            name: crisis.name,
            start_stage: stage,
            max_stage: stage,
            attempts: [],
            outcome: null,
          },
        }))
      : state.days,
    phase: 'crisis',
  };
}

/** Apply the chosen option: verdict, delta, ground control support, mission failure. */
export function chooseOption(
  state: MissionState,
  actionId: string,
  evidence: EvidenceList,
): MissionState {
  requirePhase(state, 'crisis', 'Choosing an action');
  const active = state.active_crisis;
  const response = active?.response;
  const record = todayOf(state).crisis;
  if (!active || !response || active.crisis_id === null || !record) {
    throw new GameRuleError('No crisis is shown');
  }
  const option = response.options.find((o) => o.action_id === actionId);
  if (!option) throw new GameRuleError(`Action ${actionId} was not offered`);
  const crisis = requireCrisis(evidence, active.crisis_id);
  // Verdict and delta come from the evidence list, never from the response.
  const action = findAction(crisis, actionId);
  if (!action) throw new GameRuleError(`Action ${actionId} is not listed for ${crisis.crisis_id}`);

  const before = copyPlant(state.plant);
  let plant = applyDelta(before, action.delta);
  let outcome: CrisisOutcome | null = null;
  let maxStage = record.max_stage;
  let inappropriateIds = active.inappropriate_action_ids;
  let groundSupport = false;
  let recurrence = state.recurrence;

  if (action.verdict === 'appropriate') {
    outcome = 'resolved';
  } else if (action.verdict === 'partial') {
    outcome = 'partial';
    recurrence = { crisis_id: crisis.crisis_id, game_day: state.game_day + 1 };
  } else {
    inappropriateIds = [...inappropriateIds, actionId];
    // Stage after the action's own effect, before ground support resets the metrics.
    maxStage = Math.max(
      maxStage,
      computeStage(crisis, plant, state.danger_days, inappropriateIds.length),
    );
    if (inappropriateIds.length >= GROUND_SUPPORT_AFTER) {
      groundSupport = true;
      outcome = 'ground_support';
      plant = copyPlant(plant);
      plant.plant_health = clampHealth(plant.plant_health + GROUND_SUPPORT_HEALTH);
      for (const { metric } of crisis.trigger.any_of) {
        if (!isNormal(metric, plant[metric])) plant[metric] = NORMAL_MID;
      }
    }
  }

  const failed = plant.plant_health <= 0;
  if (failed) outcome = 'mission_failed';

  const attempt: CrisisAttemptRecord = {
    attempt: active.attempt,
    stage: active.stage,
    offered_action_ids: response.options.map((o) => o.action_id),
    action_id: actionId,
    label: option.label,
    verdict: action.verdict,
    delta: { ...action.delta },
    before,
    after: copyPlant(plant),
    ground_support: groundSupport,
  };
  const nextRecord: CrisisRecord = {
    ...record,
    max_stage: maxStage,
    attempts: [...record.attempts, attempt],
    outcome,
  };

  return {
    ...state,
    plant,
    recurrence,
    // A failed mission has nothing left to present.
    active_crisis: failed ? null : { ...active, inappropriate_action_ids: inappropriateIds },
    days: updateToday(state.days, (day) => ({ ...day, crisis: nextRecord })),
    phase: failed ? 'failed' : 'crisis_result',
  };
}

/**
 * Leave the result screen. If the crisis continues, ask for the next
 * presentation. If it ended, end the day (there is no daily care on a crisis day).
 */
export function continueAfterResult(state: MissionState, evidence: EvidenceList): MissionState {
  void evidence;
  requirePhase(state, 'crisis_result', 'Continuing after the result');
  const active = state.active_crisis;
  const record = todayOf(state).crisis;
  if (!active || !record) throw new GameRuleError('No crisis is in progress');
  if (record.outcome === null) {
    return {
      ...state,
      active_crisis: { ...active, attempt: active.attempt + 1, response: null },
      phase: 'crisis_pending',
    };
  }
  return runNight({ ...state, active_crisis: null });
}

function gradeOf(health: number): HarvestGrade {
  if (health >= HARVEST_GRADE.excellent_min) return 'excellent';
  if (health >= HARVEST_GRADE.success_min) return 'success';
  return 'fail';
}

/** Harvest on game day 7, with or without sanitizing the leaves. */
export function harvestCrop(state: MissionState, options: { sanitize: boolean }): MissionState {
  requirePhase(state, 'harvest', 'Harvesting');
  const finalHealth = state.plant.plant_health;
  return {
    ...state,
    harvest: {
      sanitized: options.sanitize,
      final_health: finalHealth,
      grade: gradeOf(finalHealth),
      microbial: computeMicrobial(state, options.sanitize),
    },
    phase: 'freeze',
  };
}

/** Freeze the samples for return and open the ground analysis report. */
export function confirmFreeze(state: MissionState): MissionState {
  requirePhase(state, 'freeze', 'Freezing the samples');
  return { ...state, phase: 'report' };
}

// ---------------------------------------------------------------------------
// Report calculations
// ---------------------------------------------------------------------------

/** Place a microbial value against the observed range in the evidence list (ends inclusive). */
export function classifyMicrobial(
  value: number,
  range: { min: number; max: number } = defaultEvidence.harvest.microbial_range,
): RangeClass {
  if (value < range.min) return 'below_range';
  if (value > range.max) return 'above_range';
  return 'within_range';
}

/**
 * Microbial value of the harvest (game value), from the cultivation record.
 * `harvestSanitized` is the choice at harvest; pass false to preview before harvest.
 */
export function computeMicrobial(state: MissionState, harvestSanitized: boolean): MicrobialResult {
  let cautionDays = 0;
  let dangerDays = 0;
  let moldPartial = 0;
  let moldInappropriate = 0;
  let moldStage3 = false;
  let sanitizeCount = 0;

  for (const day of state.days) {
    const humidity = day.night?.zones.humidity;
    if (humidity === 'caution_high') cautionDays += 1;
    if (humidity === 'danger_high') dangerDays += 1;
    const crisis = day.crisis;
    if (!crisis || crisis.crisis_id !== MOLD_CRISIS_ID) continue;
    if (crisis.outcome === 'partial') moldPartial += 1;
    if (crisis.max_stage >= MOLD_STAGE) moldStage3 = true;
    for (const attempt of crisis.attempts) {
      if (attempt.verdict === 'inappropriate') moldInappropriate += 1;
      if (attempt.action_id === SANITIZE_ACTION_ID) sanitizeCount += 1;
    }
  }

  const counts: Record<MicrobialFactorKey, [number, number]> = {
    baseline: [1, MICROBIAL.baseline],
    humidity_caution_days: [cautionDays, cautionDays * MICROBIAL.humidity_caution_day],
    humidity_danger_days: [dangerDays, dangerDays * MICROBIAL.humidity_danger_day],
    mold_partial_end: [moldPartial, moldPartial * MICROBIAL.mold_partial_end],
    mold_inappropriate: [moldInappropriate, moldInappropriate * MICROBIAL.mold_inappropriate],
    mold_stage_3: [moldStage3 ? 1 : 0, moldStage3 ? MICROBIAL.mold_stage_3 : 0],
    crisis_sanitize: [
      sanitizeCount,
      Math.max(MICROBIAL.crisis_sanitize_floor, sanitizeCount * MICROBIAL.crisis_sanitize),
    ],
    harvest_sanitize: [harvestSanitized ? 1 : 0, harvestSanitized ? MICROBIAL.harvest_sanitize : 0],
  };
  const order: MicrobialFactorKey[] = [
    'baseline',
    'humidity_caution_days',
    'humidity_danger_days',
    'mold_partial_end',
    'mold_inappropriate',
    'mold_stage_3',
    'crisis_sanitize',
    'harvest_sanitize',
  ];
  // `+ 0` turns a rounded -0 into 0.
  const factors: MicrobialFactor[] = order.map((key) => ({
    key,
    count: counts[key][0],
    change: round2(counts[key][1]) + 0,
  }));
  const total = round2(factors.reduce((sum, f) => sum + f.change, 0));
  const value = Math.min(MICROBIAL.max, Math.max(MICROBIAL.min, total));
  return { value, factors, classification: classifyMicrobial(value) };
}

/** Report metrics: verdict counts, attempts per crisis, nights in a danger zone. */
export function computeReportMetrics(state: MissionState): ReportMetrics {
  const verdictCounts: Record<Verdict, number> = { appropriate: 0, partial: 0, inappropriate: 0 };
  const attemptsPerCrisis: ReportMetrics['attempts_per_crisis'] = [];
  const dangerByMetric: Record<Metric, number> = { root_moisture: 0, humidity: 0 };
  let totalChoices = 0;
  let dangerNights = 0;

  for (const day of state.days) {
    if (day.crisis) {
      for (const attempt of day.crisis.attempts) {
        verdictCounts[attempt.verdict] += 1;
        totalChoices += 1;
      }
      attemptsPerCrisis.push({
        crisis_id: day.crisis.crisis_id,
        name: day.crisis.name,
        game_day: day.game_day,
        attempts: day.crisis.attempts.length,
        outcome: day.crisis.outcome,
      });
    }
    if (day.night) {
      let anyDanger = false;
      for (const metric of METRICS) {
        if (isDanger(day.night.zones[metric])) {
          dangerByMetric[metric] += 1;
          anyDanger = true;
        }
      }
      if (anyDanger) dangerNights += 1;
    }
  }

  return {
    verdict_counts: verdictCounts,
    total_choices: totalChoices,
    attempts_per_crisis: attemptsPerCrisis,
    danger_nights: dangerNights,
    danger_nights_by_metric: dangerByMetric,
  };
}
