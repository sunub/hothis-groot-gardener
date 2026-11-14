import type {
  CareOp,
  CrisisRequest,
  CrisisResponse,
  EvidenceList,
  Locale,
  MicrobialResult,
  MissionMode,
  MissionState,
  ReportMetrics,
} from '@/lib/contract/types';

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

/** Start a mission on game day 1 in the care phase. */
export function createMission(config: MissionConfig): MissionState {
  void config;
  throw new Error('not implemented');
}

/** Apply one daily care operation. Allowed in the care phase, up to MAX_CARE_OPS_PER_DAY per day. */
export function applyCare(state: MissionState, op: CareOp): MissionState {
  void state;
  void op;
  throw new Error('not implemented');
}

/** End the day from the care phase: overnight drift, zone check, plant health. */
export function endDay(state: MissionState): MissionState {
  void state;
  throw new Error('not implemented');
}

/** Move from the night phase to the next game day and decide whether a crisis occurs. */
export function nextDay(state: MissionState, evidence: EvidenceList): MissionState {
  void state;
  void evidence;
  throw new Error('not implemented');
}

/** Body for POST /api/crisis. Allowed in the crisis_pending phase. */
export function buildCrisisRequest(state: MissionState, locale: Locale): CrisisRequest {
  void state;
  void locale;
  throw new Error('not implemented');
}

/** Accept the crisis API response and show the crisis. */
export function receiveCrisis(
  state: MissionState,
  response: CrisisResponse,
  evidence: EvidenceList,
): MissionState {
  void state;
  void response;
  void evidence;
  throw new Error('not implemented');
}

/** Apply the chosen option: verdict, delta, ground control support, mission failure. */
export function chooseOption(
  state: MissionState,
  actionId: string,
  evidence: EvidenceList,
): MissionState {
  void state;
  void actionId;
  void evidence;
  throw new Error('not implemented');
}

/**
 * Leave the result screen. If the crisis continues, ask for the next
 * presentation. If it ended, end the day (there is no daily care on a crisis day).
 */
export function continueAfterResult(state: MissionState, evidence: EvidenceList): MissionState {
  void state;
  void evidence;
  throw new Error('not implemented');
}

/** Harvest on game day 7, with or without sanitizing the leaves. */
export function harvestCrop(state: MissionState, options: { sanitize: boolean }): MissionState {
  void state;
  void options;
  throw new Error('not implemented');
}

/** Freeze the samples for return and open the ground analysis report. */
export function confirmFreeze(state: MissionState): MissionState {
  void state;
  throw new Error('not implemented');
}

/**
 * Microbial value of the harvest (game value), from the cultivation record.
 * `harvestSanitized` is the choice at harvest; pass false to preview before harvest.
 */
export function computeMicrobial(state: MissionState, harvestSanitized: boolean): MicrobialResult {
  void state;
  void harvestSanitized;
  throw new Error('not implemented');
}

/** Report metrics: verdict counts, attempts per crisis, nights in a danger zone. */
export function computeReportMetrics(state: MissionState): ReportMetrics {
  void state;
  throw new Error('not implemented');
}
