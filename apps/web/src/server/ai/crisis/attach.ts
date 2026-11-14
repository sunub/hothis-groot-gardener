import type {
  AiCrisisOutput,
  CrisisOption,
  CrisisResponse,
  EvidenceCrisis,
} from '@/lib/contract/types';
import { findAction } from '@/lib/evidence/select';

/** Facts about this presentation that the AI output does not carry. */
export interface AttachMeta {
  stage: number;
  attempt: number;
  origin: CrisisResponse['origin'];
}

/**
 * Turn validated AI output into the API response. Verdict, reason, delta,
 * value type and source always come from the evidence list, never from the
 * output (planning document: "AI 출력 형식").
 *
 * @throws Error when an option's action is not in the crisis. Validate first.
 */
export function attachEvidence(
  output: AiCrisisOutput,
  crisis: EvidenceCrisis,
  meta: AttachMeta,
): CrisisResponse {
  if (output.crisis_id !== crisis.crisis_id) {
    throw new Error(`Output is for ${output.crisis_id}, not ${crisis.crisis_id}.`);
  }
  const options = output.options.map((option): CrisisOption => {
    const action = findAction(crisis, option.action_id);
    if (!action) {
      throw new Error(`Action ${option.action_id} is not in crisis ${crisis.crisis_id}.`);
    }
    // Copies, so the screen can never mutate the shared evidence list.
    return {
      action_id: option.action_id,
      label: option.label,
      result_line: option.result_line,
      why: option.why,
      verdict: action.verdict,
      reason: action.reason,
      delta: { ...action.delta },
      value_type: action.value_type,
      source: action.source ? { ...action.source } : null,
    };
  });

  return {
    crisis_id: crisis.crisis_id,
    name: crisis.name,
    stage: meta.stage,
    attempt: meta.attempt,
    scene: output.scene,
    plant_line: output.plant_line,
    clues: output.clues.map((c) => ({ ...c })),
    options,
    record_note: crisis.record.note,
    crisis_source: { ...crisis.source },
    origin: meta.origin,
  };
}
