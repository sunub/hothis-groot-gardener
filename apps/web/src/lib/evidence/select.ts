import type {
  CrisisHistoryEntry,
  EvidenceAction,
  EvidenceCrisis,
  EvidenceList,
  EvidenceSymptom,
  Metric,
  PlantState,
} from '@/lib/contract/types';
import {
  CRISIS_PROBABILITY,
  CULTIVATION_DAYS,
  isCaution,
  isDanger,
  sideOf,
  zoneOf,
} from '@/lib/game/rules';

/**
 * Pure helpers that read the evidence list. The game logic (browser) and the
 * crisis API (server) both use these, so they decide the same way.
 */

export type Severity = 'danger' | 'caution';

export interface CrisisCandidate {
  crisis: EvidenceCrisis;
  severity: Severity;
}

/** Severity of one crisis for the given state, or null when its trigger does not hold. */
export function severityOf(crisis: EvidenceCrisis, state: PlantState): Severity | null {
  if (crisis.trigger.fan !== undefined && crisis.trigger.fan !== state.fan) return null;
  let severity: Severity | null = null;
  for (const condition of crisis.trigger.any_of) {
    const zone = zoneOf(condition.metric, state[condition.metric]);
    if (sideOf(zone) !== condition.side) continue;
    if (isDanger(zone)) return 'danger';
    if (isCaution(zone)) severity = 'caution';
  }
  return severity;
}

/**
 * Crises whose trigger holds for the state.
 * Order: danger before caution, then evidence list order.
 *
 * `recurrenceCrisisId` is the crisis that ended with a partial verdict
 * yesterday, if any. When that crisis is a candidate and no other candidate is
 * more severe, it is the only candidate: its higher probability must not
 * bring up a different crisis.
 */
export function selectCandidates(
  evidence: EvidenceList,
  state: PlantState,
  recurrenceCrisisId: string | null = null,
): CrisisCandidate[] {
  const candidates: CrisisCandidate[] = [];
  for (const crisis of evidence.crises) {
    const severity = severityOf(crisis, state);
    if (severity) candidates.push({ crisis, severity });
  }
  candidates.sort((a, b) => rank(a.severity) - rank(b.severity));
  const recurring = candidates.find((c) => c.crisis.crisis_id === recurrenceCrisisId);
  if (recurring && rank(recurring.severity) <= rank(candidates[0].severity)) return [recurring];
  return candidates;
}

/**
 * The crisis that ended with a partial verdict on the game day before
 * `cultivationDay`, read from the crisis history. The crisis API uses it to
 * choose the same candidates as the game logic.
 */
export function recurrenceCrisisIdOf(
  history: readonly CrisisHistoryEntry[],
  cultivationDay: number,
): string | null {
  const index = CULTIVATION_DAYS.indexOf(cultivationDay);
  const last = history[history.length - 1];
  if (index < 1 || !last) return null;
  return last.outcome === 'partial' && last.cultivation_day === CULTIVATION_DAYS[index - 1]
    ? last.crisis_id
    : null;
}

function rank(severity: Severity): number {
  return severity === 'danger' ? 0 : 1;
}

/**
 * Probability that a crisis occurs today: the highest probability among the
 * candidates. `recurrenceCrisisId` is the crisis that ended with a partial
 * verdict yesterday, if any.
 */
export function crisisProbability(
  candidates: readonly CrisisCandidate[],
  recurrenceCrisisId: string | null,
): number {
  let probability = 0;
  for (const { crisis, severity } of candidates) {
    let p: number = CRISIS_PROBABILITY[severity];
    if (crisis.crisis_id === recurrenceCrisisId) p += CRISIS_PROBABILITY.recurrence_bonus;
    probability = Math.max(probability, Math.min(1, p));
  }
  return probability;
}

export function maxStageOf(crisis: EvidenceCrisis): number {
  return Math.max(...crisis.symptoms.map((s) => s.stage));
}

/**
 * Symptom stage of a crisis.
 * Stage 1 on the first danger day, +1 for each further consecutive danger day,
 * +1 for each inappropriate choice in this crisis. Capped at the highest stage
 * the crisis has symptoms for.
 */
export function computeStage(
  crisis: EvidenceCrisis,
  state: PlantState,
  dangerDays: Record<Metric, number>,
  inappropriateCount: number,
): number {
  let days = 0;
  for (const condition of crisis.trigger.any_of) {
    const zone = zoneOf(condition.metric, state[condition.metric]);
    if (isDanger(zone) && sideOf(zone) === condition.side) {
      days = Math.max(days, dangerDays[condition.metric]);
    }
  }
  const stage = 1 + Math.max(0, days - 1) + inappropriateCount;
  return Math.min(maxStageOf(crisis), stage);
}

/** Symptoms that may be shown at the given stage (this stage and earlier). */
export function symptomsUpToStage(crisis: EvidenceCrisis, stage: number): EvidenceSymptom[] {
  return crisis.symptoms.filter((s) => s.stage <= stage);
}

export function findCrisis(evidence: EvidenceList, crisisId: string): EvidenceCrisis | undefined {
  return evidence.crises.find((c) => c.crisis_id === crisisId);
}

export function findAction(crisis: EvidenceCrisis, actionId: string): EvidenceAction | undefined {
  return crisis.actions.find((a) => a.action_id === actionId);
}
