import { AI_CLUES_MAX, AI_OPTIONS_MAX, AI_OPTIONS_MIN } from '@/lib/contract/schemas';
import type {
  ActiveCrisisContext,
  CrisisHistoryEntry,
  CrisisRequest,
  EvidenceCrisis,
  FanLevel,
  LightSetting,
  Locale,
  Metric,
  Verdict,
  Zone,
} from '@/lib/contract/types';
import { symptomsUpToStage } from '@/lib/evidence/select';
import { zoneOf } from '@/lib/game/rules';

/**
 * The seam where text generation plugs in. This file holds the input shape and
 * a pure builder only. The prompt text and the model call are not built yet
 * (implementation notes, entry 22).
 */

/** A candidate crisis with the symptom stage computed for this request. */
export interface StagedCandidate {
  crisis: EvidenceCrisis;
  stage: number;
}

/** Minimum clue count (implementation notes, entry 17): 2 when 2 symptoms are available, else 1. */
export const CLUES_MIN_PREFERRED = 2;

/** One metric with the zone it is in, so the text can agree with the state. */
export interface GenerationMetric {
  value: number;
  zone: Zone;
}

/** Plant state with a zone per metric. */
export interface GenerationState {
  plant_health: number;
  root_moisture: GenerationMetric;
  humidity: GenerationMetric;
  fan: FanLevel;
  light: LightSetting;
}

/** A symptom the text may describe. */
export interface GenerationSymptom {
  symptom_id: string;
  name: string;
  stage: number;
}

/** An action the options may link to, with its verdict and reason from the evidence list. */
export interface GenerationAction {
  action_id: string;
  name: string;
  verdict: Verdict;
  reason: string;
}

/** One candidate crisis and its evidence, cut to the current stage. */
export interface GenerationCandidate {
  crisis_id: string;
  name: string;
  /** What was actually recorded. */
  summary: string;
  /** Shown when the record is not from lettuce. Empty otherwise. */
  record_note: string;
  stage: number;
  /** Only the symptoms allowed at `stage` (planning document: 증상 진행). */
  symptoms: GenerationSymptom[];
  /** Actions that may be offered. Excluded actions are already removed. */
  actions: GenerationAction[];
  /** Least number of clues for this candidate. */
  clues_min: number;
}

/** Count limits of the output format. */
export interface GenerationLimits {
  clues_max: number;
  options_min: number;
  options_max: number;
}

/**
 * Everything the planning document ("AI 처리 단계 > 입력 조립") puts into the
 * prompt: the current state, the candidates' evidence, the past crisis
 * history and the output limits. Serialized shape, so keys are snake_case.
 */
export interface GenerationInput {
  locale: Locale;
  cultivation_day: number;
  state: GenerationState;
  candidates: GenerationCandidate[];
  history: CrisisHistoryEntry[];
  /** Set when the same crisis is shown again after an inappropriate choice. */
  active: ActiveCrisisContext | null;
  /** Actions that must not be offered again in this presentation. */
  excluded_action_ids: string[];
  limits: GenerationLimits;
}

/**
 * Produces the raw AI output for one crisis. The result is untrusted and is
 * checked by `validateAiOutput` before use. The function must stop work when
 * `signal` aborts (the pipeline gives up after its timeout either way).
 *
 * Pass an implementation to `createCrisis` in `src/app/api/crisis/route.ts`.
 * None is wired yet, so every crisis comes from the pre-made fallback list.
 */
export type CrisisGenerator = (input: GenerationInput, signal: AbortSignal) => Promise<unknown>;

/** Least clue count for a crisis at a stage (implementation notes, entry 17). */
export function minCluesFor(crisis: EvidenceCrisis, stage: number): number {
  return Math.min(CLUES_MIN_PREFERRED, symptomsUpToStage(crisis, stage).length);
}

/**
 * Build the generation input. `excludedActionIds` defaults to the actions
 * already chosen in the active crisis.
 */
export function buildGenerationInput(
  request: CrisisRequest,
  candidates: readonly StagedCandidate[],
  excludedActionIds: readonly string[] = request.active?.chosen_action_ids ?? [],
): GenerationInput {
  const excluded = new Set(excludedActionIds);
  const metric = (m: Metric): GenerationMetric => ({
    value: request.state[m],
    zone: zoneOf(m, request.state[m]),
  });
  return {
    locale: request.locale,
    cultivation_day: request.cultivation_day,
    state: {
      plant_health: request.state.plant_health,
      root_moisture: metric('root_moisture'),
      humidity: metric('humidity'),
      fan: request.state.fan,
      light: { ...request.state.light },
    },
    candidates: candidates.map(({ crisis, stage }) => ({
      crisis_id: crisis.crisis_id,
      name: crisis.name,
      summary: crisis.summary,
      record_note: crisis.record.note,
      stage,
      symptoms: symptomsUpToStage(crisis, stage).map((s) => ({
        symptom_id: s.symptom_id,
        name: s.name,
        stage: s.stage,
      })),
      actions: crisis.actions
        .filter((a) => !excluded.has(a.action_id))
        .map((a) => ({
          action_id: a.action_id,
          name: a.name,
          verdict: a.verdict,
          reason: a.reason,
        })),
      clues_min: minCluesFor(crisis, stage),
    })),
    history: request.history.map((h) => ({
      ...h,
      choices: h.choices.map((c) => ({ ...c })),
    })),
    active: request.active
      ? { ...request.active, chosen_action_ids: [...request.active.chosen_action_ids] }
      : null,
    excluded_action_ids: [...excluded],
    limits: {
      clues_max: AI_CLUES_MAX,
      options_min: AI_OPTIONS_MIN,
      options_max: AI_OPTIONS_MAX,
    },
  };
}
