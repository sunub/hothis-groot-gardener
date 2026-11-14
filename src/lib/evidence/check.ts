import { evidenceListSchema } from '@/lib/contract/schemas';
import type { EvidenceList, SourceRef, ValueType } from '@/lib/contract/types';

/**
 * Rules for the evidence list file beyond its shape. The planning document
 * ("백엔드가 하는 일 > 작업 목록") asks for a check of duplicate ids, at least
 * one appropriate action per crisis and missing sources.
 */

/** Errors make the list fail; warnings are reported only. */
export type EvidenceIssueLevel = 'error' | 'warning';

/** One problem found in the list. */
export interface EvidenceIssue {
  level: EvidenceIssueLevel;
  /** Location in the file, e.g. `crises[1].actions[0].source`. */
  path: string;
  message: string;
}

/** Result of `checkEvidenceList`. */
export interface EvidenceCheckResult {
  /** True when there is no error. Warnings do not make the list fail. */
  ok: boolean;
  issues: EvidenceIssue[];
}

/** Quote placeholder used while a source is still being verified. */
export const PROVISIONAL_QUOTE = 'PROVISIONAL';

/**
 * Check an evidence list. The shape is checked first; the list rules run only
 * when the shape is valid, because they read fields the shape guarantees.
 */
export function checkEvidenceList(data: unknown): EvidenceCheckResult {
  const parsed = evidenceListSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue): EvidenceIssue => ({
        level: 'error',
        path: formatPath(issue.path),
        message: `Schema: ${issue.message}`,
      }),
    );
    return { ok: false, issues };
  }

  const issues: EvidenceIssue[] = [];
  const error = (path: string, message: string) => issues.push({ level: 'error', path, message });
  const warning = (path: string, message: string) =>
    issues.push({ level: 'warning', path, message });

  checkRules(parsed.data, error, warning);
  return { ok: !issues.some((i) => i.level === 'error'), issues };
}

type Report = (path: string, message: string) => void;

function checkRules(list: EvidenceList, error: Report, warning: Report): void {
  const crisisIds = new Set<string>();

  list.crises.forEach((crisis, ci) => {
    const at = `crises[${ci}]`;
    if (crisisIds.has(crisis.crisis_id)) {
      error(`${at}.crisis_id`, `Duplicate crisis_id "${crisis.crisis_id}".`);
    }
    crisisIds.add(crisis.crisis_id);
    checkQuote(crisis.source, `${at}.source`, error);

    const symptomIds = new Set<string>();
    crisis.symptoms.forEach((symptom, si) => {
      const sat = `${at}.symptoms[${si}]`;
      if (symptomIds.has(symptom.symptom_id)) {
        error(`${sat}.symptom_id`, `Duplicate symptom_id "${symptom.symptom_id}" in this crisis.`);
      }
      symptomIds.add(symptom.symptom_id);
      checkMeasured(symptom.value_type, symptom.source, `${sat}.source`, error);
      checkQuote(symptom.source, `${sat}.source`, error);
    });

    // Stages drive symptom progression, so a gap would make a stage show no new symptom.
    const stages = new Set(crisis.symptoms.map((s) => s.stage));
    const maxStage = Math.max(...stages);
    for (let stage = 1; stage <= maxStage; stage++) {
      if (!stages.has(stage)) {
        error(`${at}.symptoms`, `Symptom stages must be contiguous from 1; stage ${stage} has no symptom.`);
      }
    }

    const actionIds = new Set<string>();
    crisis.actions.forEach((action, ai) => {
      const aat = `${at}.actions[${ai}]`;
      if (actionIds.has(action.action_id)) {
        error(`${aat}.action_id`, `Duplicate action_id "${action.action_id}" in this crisis.`);
      }
      actionIds.add(action.action_id);
      if (action.source === null) {
        if (action.verdict === 'appropriate') {
          error(`${aat}.source`, 'An appropriate action must cite a source.');
        } else {
          warning(`${aat}.source`, `A ${action.verdict} action has no source.`);
        }
      }
      checkMeasured(action.value_type, action.source, `${aat}.source`, error);
      checkQuote(action.source, `${aat}.source`, error);
    });

    if (!crisis.actions.some((a) => a.verdict === 'appropriate')) {
      error(`${at}.actions`, 'A crisis needs at least one appropriate action.');
    }
    // Without a wrong answer the crisis is not a choice, but the game still works.
    if (!crisis.actions.some((a) => a.verdict === 'inappropriate')) {
      warning(`${at}.actions`, 'A crisis should have at least one inappropriate action.');
    }
  });

  const { harvest } = list;
  harvest.steps.forEach((step, i) => {
    const at = `harvest.steps[${i}].source`;
    checkMeasured(step.value_type, step.source, at, error);
    checkQuote(step.source, at, error);
  });
  if (harvest.microbial_range.min >= harvest.microbial_range.max) {
    error('harvest.microbial_range', 'microbial_range.min must be less than max.');
  }
  checkQuote(harvest.microbial_range.source, 'harvest.microbial_range.source', error);
  checkQuote(harvest.pathogen_screen.source, 'harvest.pathogen_screen.source', error);
  checkQuote(harvest.standards_note.source, 'harvest.standards_note.source', error);
  list.background.forEach((claim, i) => {
    checkQuote(claim.source, `background[${i}].source`, error);
  });
}

function checkMeasured(
  valueType: ValueType,
  source: SourceRef | null,
  path: string,
  error: Report,
): void {
  if (valueType === 'measured' && source === null) {
    error(path, 'A measured value must cite a source.');
  }
}

function checkQuote(source: SourceRef | null, path: string, error: Report): void {
  if (source === null) return;
  const quote = source.quote.trim();
  if (quote === '') {
    error(`${path}.quote`, 'Quote is empty.');
  } else if (quote === PROVISIONAL_QUOTE) {
    error(`${path}.quote`, 'Quote is still the PROVISIONAL placeholder.');
  }
}

function formatPath(path: readonly PropertyKey[]): string {
  let out = '';
  for (const key of path) {
    if (typeof key === 'number') out += `[${key}]`;
    else out += out === '' ? String(key) : `.${String(key)}`;
  }
  return out === '' ? '(root)' : out;
}
