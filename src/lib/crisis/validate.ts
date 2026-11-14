import { AI_CLUES_MAX, AI_OPTIONS_MAX, AI_OPTIONS_MIN, aiCrisisOutputSchema } from '@/lib/contract/schemas';
import type { AiCrisisOutput } from '@/lib/contract/types';
import { findAction } from '@/lib/evidence/select';
import { minCluesFor, type StagedCandidate } from './generator';

/** What the AI output is checked against. */
export interface ValidationContext {
  /** The crises the output may choose from, each with its current symptom stage. */
  candidates: readonly StagedCandidate[];
  /** Actions already chosen in this crisis that must not be offered again. */
  excludedActionIds: readonly string[];
}

/** The parsed output, or every rule it broke. */
export type ValidationResult =
  | { ok: true; value: AiCrisisOutput }
  | { ok: false; issues: string[] };

/**
 * Check AI output (or a pre-made fallback crisis) against the evidence list.
 * Rules from the planning document ("AI 출력 형식", "AI 처리 단계 > 검증") and
 * implementation notes entry 17 for the clue count.
 */
export function validateAiOutput(output: unknown, context: ValidationContext): ValidationResult {
  const parsed = aiCrisisOutputSchema.safeParse(output);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => `shape: ${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  const value = parsed.data;

  // Every later rule reads the crisis's evidence, so an unknown crisis ends the check.
  const candidate = context.candidates.find((c) => c.crisis.crisis_id === value.crisis_id);
  if (!candidate) {
    return { ok: false, issues: [`crisis_id "${value.crisis_id}" is not a candidate.`] };
  }
  const { crisis, stage } = candidate;
  const issues: string[] = [];

  const seenSymptoms = new Set<string>();
  for (const clue of value.clues) {
    const symptom = crisis.symptoms.find((s) => s.symptom_id === clue.symptom_id);
    if (!symptom) {
      issues.push(`symptom_id "${clue.symptom_id}" is not a symptom of ${crisis.crisis_id}.`);
    } else if (symptom.stage > stage) {
      issues.push(
        `symptom_id "${clue.symptom_id}" is a stage ${symptom.stage} symptom; the crisis is at stage ${stage}.`,
      );
    }
    if (seenSymptoms.has(clue.symptom_id)) {
      issues.push(`symptom_id "${clue.symptom_id}" is used in more than one clue.`);
    }
    seenSymptoms.add(clue.symptom_id);
  }

  const cluesMin = minCluesFor(crisis, stage);
  if (value.clues.length < cluesMin || value.clues.length > AI_CLUES_MAX) {
    issues.push(`Expected ${cluesMin}-${AI_CLUES_MAX} clues, got ${value.clues.length}.`);
  }

  if (value.options.length < AI_OPTIONS_MIN || value.options.length > AI_OPTIONS_MAX) {
    issues.push(`Expected ${AI_OPTIONS_MIN}-${AI_OPTIONS_MAX} options, got ${value.options.length}.`);
  }

  const excluded = new Set(context.excludedActionIds);
  const seenActions = new Set<string>();
  let appropriate = 0;
  for (const option of value.options) {
    const action = findAction(crisis, option.action_id);
    if (!action) {
      issues.push(`action_id "${option.action_id}" is not an action of ${crisis.crisis_id}.`);
    } else if (action.verdict === 'appropriate') {
      appropriate++;
    }
    if (seenActions.has(option.action_id)) {
      issues.push(`action_id "${option.action_id}" is used in more than one option.`);
    }
    seenActions.add(option.action_id);
    if (excluded.has(option.action_id)) {
      issues.push(`action_id "${option.action_id}" was already chosen and must not be offered again.`);
    }
  }
  if (appropriate === 0) {
    issues.push('No option is an appropriate action.');
  }

  return issues.length === 0 ? { ok: true, value } : { ok: false, issues };
}
