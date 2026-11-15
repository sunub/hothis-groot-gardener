import type {
  AiCrisisOutput,
  CrisisRequest,
  CrisisResponse,
  EvidenceCrisis,
  EvidenceList,
  Locale,
} from '@/lib/contract/types';
import { evidence as shippedEvidence } from '@/lib/evidence';
import { checkEvidenceList } from '@/lib/evidence/check';
import { localizeEvidence } from '@/lib/evidence/localize';
import {
  computeStage,
  findAction,
  findCrisis,
  recurrenceCrisisIdOf,
  selectCandidates,
} from '@/lib/evidence/select';
import { attachEvidence } from './attach';
import { effectiveExclusions, getFallbackCrisis, pickFallbackCandidate } from './fallback';
import {
  buildGenerationInput,
  type CrisisGenerator,
  type StagedCandidate,
} from './generator';
import { applyTranslation, buildGlossary, type CrisisTranslator } from './translate';
import { validateAiOutput, type ValidationContext } from './validate';

/**
 * Crisis creation (planning document: "AI 처리 단계"): pick candidates,
 * generate, validate, retry once, fall back to a pre-made crisis, attach the
 * evidence. No state is kept between requests.
 */

/** How long one generation may take before it counts as failed. */
export const DEFAULT_GENERATION_TIMEOUT_MS = 8000;

/** Generation attempts before the fallback: the first try and one retry. */
export const GENERATION_ATTEMPTS = 2;

/** No crisis can be shown for the request: no trigger holds, or the active crisis is unknown. */
export class NoCandidateError extends Error {
  constructor(message = 'No crisis is a candidate for this state.') {
    super(message);
    this.name = 'NoCandidateError';
  }
}

/**
 * The request names a crisis or action that is not in the evidence list.
 * The message is fixed so the offending value is never echoed back.
 */
export class InvalidRequestError extends Error {
  constructor(message = 'The request refers to a crisis or action that is not in the evidence list.') {
    super(message);
    this.name = 'InvalidRequestError';
  }
}

/** A generation that ran out of time. */
export class GenerationTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Generation did not finish within ${timeoutMs} ms.`);
    this.name = 'GenerationTimeoutError';
  }
}

/** The only language the text generator writes. Other languages are translated from it. */
const GENERATION_LOCALE: Locale = 'en';

/** Translation attempts per crisis. One: a failed translation falls back to the pre-made text. */
export const TRANSLATION_ATTEMPTS = 1;

/** Replaceable parts of `createCrisis`, for wiring a generator and for tests. */
export interface CreateCrisisDeps {
  /** Text generator. Without one, the pre-made crisis is returned directly. */
  generator?: CrisisGenerator;
  /** Defaults to the shipped evidence list. */
  evidence?: EvidenceList;
  /**
   * Translates the generated English text for other languages. Without one,
   * a request in another language gets the pre-made text.
   */
  translator?: CrisisTranslator;
  /** Per attempt. Defaults to DEFAULT_GENERATION_TIMEOUT_MS. */
  timeoutMs?: number;
}

/**
 * Create one validated crisis for the request.
 * Deterministic when no generator is given.
 *
 * @throws InvalidRequestError when a history or chosen id is not in the evidence list.
 * @throws NoCandidateError when no crisis fits the request.
 * @throws Error when the pre-made crisis itself is missing or invalid (a bug in the data files).
 */
export async function createCrisis(
  request: CrisisRequest,
  deps: CreateCrisisDeps = {},
): Promise<CrisisResponse> {
  const list = deps.evidence ?? shippedEvidence;
  assertEvidenceChecked(list);
  assertRequestIdsKnown(request, list);
  // Checked as shipped; names and reasons shown to the player are in the request language.
  const shown = localizeEvidence(list, request.locale);
  const crises = candidateCrises(request, shown);
  const inappropriateCount = request.active?.chosen_action_ids.length ?? 0;
  const candidates: StagedCandidate[] = crises.map((crisis) => ({
    crisis,
    stage: computeStage(crisis, request.state, request.danger_days, inappropriateCount),
  }));
  const attempt = request.active?.attempt ?? 1;

  // With `active` there is exactly one candidate. Exclusions that would leave
  // too few options are dropped, so the crisis can always be shown.
  const excludedActionIds = request.active
    ? effectiveExclusions(candidates[0].crisis, request.active.chosen_action_ids)
    : [];
  const context: ValidationContext = { candidates, excludedActionIds };

  // The generator writes English only. For another language the validated
  // English text is translated and validated again; any failure on the way
  // ends in the pre-made text of the request language.
  const canTranslate = request.locale === GENERATION_LOCALE || deps.translator !== undefined;
  if (deps.generator && canTranslate) {
    const english = localizeEvidence(list, GENERATION_LOCALE);
    const englishCandidates: StagedCandidate[] = candidates.map(({ crisis, stage }) => ({
      crisis: findCrisis(english, crisis.crisis_id) ?? crisis,
      stage,
    }));
    const englishContext: ValidationContext = { candidates: englishCandidates, excludedActionIds };
    const input = buildGenerationInput(
      { ...request, locale: GENERATION_LOCALE },
      englishCandidates,
      excludedActionIds,
    );
    const timeoutMs = deps.timeoutMs ?? DEFAULT_GENERATION_TIMEOUT_MS;
    for (let i = 0; i < GENERATION_ATTEMPTS; i++) {
      let raw: unknown;
      try {
        raw = await withTimeout((signal) => deps.generator!(input, signal), timeoutMs);
      } catch {
        continue;
      }
      const result = validateAiOutput(raw, englishContext);
      // Validation guarantees the crisis is a candidate; the lookup only narrows the type.
      const chosen = result.ok
        ? candidates.find((c) => c.crisis.crisis_id === result.value.crisis_id)
        : undefined;
      if (!result.ok || !chosen) continue;

      if (request.locale === GENERATION_LOCALE) {
        return attachEvidence(result.value, chosen.crisis, {
          stage: chosen.stage,
          attempt,
          origin: 'generated',
        });
      }
      const translated = await translateValidated(result.value, chosen, context, deps, timeoutMs);
      if (translated) {
        return attachEvidence(translated, chosen.crisis, {
          stage: chosen.stage,
          attempt,
          origin: 'generated',
        });
      }
      break; // Generating again would cost the same time for a text that is already valid English.
    }
  }

  const first = pickFallbackCandidate(candidates);
  const output = getFallbackCrisis(
    first.crisis.crisis_id,
    first.stage,
    request.locale,
    excludedActionIds,
    shown,
  );
  if (!output) {
    throw new Error(`No pre-made crisis for ${first.crisis.crisis_id} at stage ${first.stage}.`);
  }
  const result = validateAiOutput(output, context);
  if (!result.ok) {
    throw new Error(
      `Pre-made crisis ${first.crisis.crisis_id} stage ${first.stage} is invalid: ${result.issues.join(' ')}`,
    );
  }
  return attachEvidence(result.value, first.crisis, {
    stage: first.stage,
    attempt,
    origin: 'fallback',
  });
}

/** Lists that passed the evidence check. Each list is checked once per server process. */
const checkedLists = new WeakSet<EvidenceList>();

/**
 * Check the evidence list before any crisis is served from it (duplicate ids,
 * an appropriate action per crisis, no missing source). A list with errors is
 * a bug in the data file, so the request fails instead of showing unchecked evidence.
 */
function assertEvidenceChecked(list: EvidenceList): void {
  if (checkedLists.has(list)) return;
  const result = checkEvidenceList(list);
  const errors = result.issues.filter((issue) => issue.level === 'error');
  if (errors.length > 0) {
    const detail = errors
      .slice(0, 5)
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join(' ');
    throw new Error(`The evidence list failed its check. ${detail}`);
  }
  checkedLists.add(list);
}

/**
 * Reject ids that the evidence list does not know before anything is built
 * from the request: they would otherwise reach the generation input.
 * An unknown active crisis is left to `candidateCrises`, which reports it as
 * NoCandidateError (422); its chosen ids are then not checked here.
 */
function assertRequestIdsKnown(request: CrisisRequest, list: EvidenceList): void {
  for (const entry of request.history) {
    const crisis = findCrisis(list, entry.crisis_id);
    if (!crisis || !entry.choices.every((c) => findAction(crisis, c.action_id))) {
      throw new InvalidRequestError();
    }
  }
  if (request.active) {
    const crisis = findCrisis(list, request.active.crisis_id);
    if (crisis && !request.active.chosen_action_ids.every((id) => findAction(crisis, id))) {
      throw new InvalidRequestError();
    }
  }
}

function candidateCrises(request: CrisisRequest, list: EvidenceList): EvidenceCrisis[] {
  if (request.active) {
    // The crisis is already in progress, so its trigger is not checked again.
    const crisis = findCrisis(list, request.active.crisis_id);
    if (!crisis) {
      throw new NoCandidateError(`Active crisis "${request.active.crisis_id}" is not in the evidence list.`);
    }
    return [crisis];
  }
  // Same candidates as the game logic: a crisis that ended as partial yesterday comes first.
  const recurrenceId = recurrenceCrisisIdOf(request.history, request.cultivation_day);
  const crises = selectCandidates(list, request.state, recurrenceId).map((c) => c.crisis);
  if (crises.length === 0) throw new NoCandidateError();
  return crises;
}

/**
 * Run a model call with a deadline. The race does not rely on the call
 * honouring the abort signal, so a stuck call cannot hold the request.
 */
async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new GenerationTimeoutError(timeoutMs));
    }, timeoutMs);
  });
  // Wrapping also turns a synchronous throw into a rejection.
  const call = Promise.resolve().then(() => run(controller.signal));
  // A late rejection after the deadline must not become an unhandled rejection.
  call.catch(() => undefined);
  try {
    return await Promise.race([call, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Translate a validated English output and validate the result against the
 * request-language evidence (Korean reveal phrases, banned claims). Returns
 * undefined when every attempt fails.
 */
async function translateValidated(
  source: AiCrisisOutput,
  chosen: StagedCandidate,
  context: ValidationContext,
  deps: CreateCrisisDeps,
  timeoutMs: number,
): Promise<AiCrisisOutput | undefined> {
  const translator = deps.translator;
  if (!translator) return undefined;
  const input = { source, glossary: buildGlossary(source, chosen.crisis) };
  for (let i = 0; i < TRANSLATION_ATTEMPTS; i++) {
    let raw: unknown;
    try {
      raw = await withTimeout((signal) => translator(input, signal), timeoutMs);
    } catch {
      continue;
    }
    const merged = applyTranslation(source, raw);
    if (!merged.ok) continue;
    const result = validateAiOutput(merged.value, context);
    if (result.ok) return result.value;
  }
  return undefined;
}
