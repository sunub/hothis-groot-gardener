import { findBannedClaims } from '@/lib/contract/claims';
import { eventCardOutputSchema, type EventCardOutput } from '@/lib/contract/schemas';
import { REVEAL_PATTERNS } from '@/server/ai/crisis/validate';
import type { CardEvent } from '@/lib/events';

/** What event card text is checked against. */
export interface EventCardValidationContext {
  /** The event the card is for. */
  event: CardEvent;
  /** The actions the card must offer, each exactly once. Already checked to be actions of the event. */
  offeredActionIds: readonly string[];
}

/** The parsed output, or every rule it broke. */
export type EventCardValidationResult =
  | { ok: true; value: EventCardOutput }
  | { ok: false; issues: string[] };

/**
 * Check generated (or pre-made) event card text. The option order is not
 * checked: the pipeline puts options in the offered order when it builds
 * the response, so a generator that reorders them is not penalised.
 */
export function validateEventCardOutput(
  output: unknown,
  context: EventCardValidationContext,
): EventCardValidationResult {
  const parsed = eventCardOutputSchema.safeParse(output);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => `shape: ${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  const value = parsed.data;
  if (value.event_id !== context.event.event_id) {
    return { ok: false, issues: [`event_id "${value.event_id}" is not ${context.event.event_id}.`] };
  }
  const issues: string[] = [];

  const offered = new Set(context.offeredActionIds);
  const seen = new Set<string>();
  for (const option of value.options) {
    if (!offered.has(option.action_id)) {
      issues.push(`action_id "${option.action_id}" is not offered on this card.`);
    }
    if (seen.has(option.action_id)) {
      issues.push(`action_id "${option.action_id}" is used in more than one option.`);
    }
    seen.add(option.action_id);
  }
  for (const id of context.offeredActionIds) {
    if (!seen.has(id)) issues.push(`Offered action "${id}" has no option.`);
  }

  value.options.forEach((option, i) => {
    for (const pattern of REVEAL_PATTERNS) {
      if (pattern.test(option.label)) {
        issues.push(`options[${i}].label gives the verdict away (${pattern}).`);
      }
    }
  });

  for (const [path, fieldText] of cardTexts(value)) {
    for (const claim of findBannedClaims(fieldText)) {
      issues.push(`${path} makes a banned safety claim (${claim}).`);
    }
  }

  return issues.length === 0 ? { ok: true, value } : { ok: false, issues };
}

/** Every text field with its path, for the content checks. */
function cardTexts(value: EventCardOutput): [string, string][] {
  return [
    ['scene', value.scene],
    ['plant_line', value.plant_line],
    ...value.options.flatMap((o, i): [string, string][] => [
      [`options[${i}].label`, o.label],
      [`options[${i}].result_line`, o.result_line],
      [`options[${i}].why`, o.why],
    ]),
  ];
}
