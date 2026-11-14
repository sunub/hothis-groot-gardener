import { z } from 'zod';
import raw from '@content/fallback-crises.json';
import { AI_OPTIONS_MIN, aiCrisisOutputSchema, localeSchema } from '@/lib/contract/schemas';
import type { AiCrisisOutput, EvidenceCrisis, EvidenceList, Locale } from '@/lib/contract/types';
import { evidence as shippedEvidence } from '@/lib/evidence';
import { findAction, findCrisis } from '@/lib/evidence/select';

/**
 * Pre-made crises (data/content/fallback-crises.json): used when no generator is
 * connected, and when generated output fails twice (planning document:
 * "AI 처리 단계 > 실패 처리").
 */

/** Locale used when the requested one has no pre-made text. */
export const FALLBACK_LOCALE: Locale = 'en';

const fallbackFileSchema = z.strictObject({
  meta: z.strictObject({ description: z.string().min(1), ai_disclosure: z.string().min(1) }),
  crises: z.array(
    z.strictObject({
      stage: z.number().int().min(1),
      locale: localeSchema,
      output: aiCrisisOutputSchema,
    }),
  ),
});

/** Shape of data/content/fallback-crises.json. */
export type FallbackFile = z.infer<typeof fallbackFileSchema>;
/** One pre-made crisis for one crisis, stage and locale. */
export type FallbackEntry = FallbackFile['crises'][number];

/** The parsed file. Parsing at load time turns a broken file into an immediate, clear error. */
export const fallbackCrises: FallbackFile = fallbackFileSchema.parse(raw);

/**
 * The candidate whose pre-made crisis is shown: the first one, in the order of
 * `selectCandidates` (implementation notes, entry 7). Change this to pick another.
 */
export function pickFallbackCandidate<T>(candidates: readonly T[]): T {
  if (candidates.length === 0) throw new Error('No candidate to pick a fallback crisis for.');
  return candidates[0];
}

/**
 * The subset of `requested` that can be removed from a crisis that offers all
 * of its actions while keeping at least 3 options and one appropriate option.
 * Requested ids are dropped in order; an id that would break either limit is kept.
 */
export function effectiveExclusions(
  crisis: EvidenceCrisis,
  requested: readonly string[],
): string[] {
  const remaining = new Set(crisis.actions.map((a) => a.action_id));
  const removed: string[] = [];
  for (const id of requested) {
    if (!remaining.has(id)) continue;
    const next = [...remaining].filter((a) => a !== id);
    const keepsAppropriate = next.some((a) => findAction(crisis, a)?.verdict === 'appropriate');
    if (next.length >= AI_OPTIONS_MIN && keepsAppropriate) {
      remaining.delete(id);
      removed.push(id);
    }
  }
  return removed;
}

/**
 * Pre-made output for a crisis at a stage. Uses the nearest lower stage when
 * the exact stage is missing, and English when the locale has no text.
 * Excluded actions are removed only while at least 3 options and one
 * appropriate option remain. Returns null when the crisis has no entry at
 * or below the stage.
 *
 * `evidenceList` supplies the verdicts for the exclusion rule.
 */
export function getFallbackCrisis(
  crisisId: string,
  stage: number,
  locale: Locale,
  excludeActionIds: readonly string[],
  evidenceList: EvidenceList = shippedEvidence,
): AiCrisisOutput | null {
  const crisis = findCrisis(evidenceList, crisisId);
  if (!crisis) return null;

  const forCrisis = fallbackCrises.crises.filter((e) => e.output.crisis_id === crisisId);
  const inLocale = forCrisis.filter((e) => e.locale === locale);
  const entries = inLocale.length > 0 ? inLocale : forCrisis.filter((e) => e.locale === FALLBACK_LOCALE);
  const entry = pickStage(entries, stage);
  if (!entry) return null;

  // A copy, so callers never mutate the loaded file.
  const output = structuredClone(entry.output);
  const verdictOf = (id: string) => findAction(crisis, id)?.verdict;
  for (const id of excludeActionIds) {
    const next = output.options.filter((o) => o.action_id !== id);
    if (next.length === output.options.length) continue;
    if (next.length >= AI_OPTIONS_MIN && next.some((o) => verdictOf(o.action_id) === 'appropriate')) {
      output.options = next;
    }
  }
  return output;
}

/** Highest stage at or below `stage`. A higher stage is never used: it could show symptoms not reached yet. */
function pickStage(entries: readonly FallbackEntry[], stage: number): FallbackEntry | undefined {
  let best: FallbackEntry | undefined;
  for (const entry of entries) {
    if (entry.stage <= stage && (!best || entry.stage > best.stage)) best = entry;
  }
  return best;
}
