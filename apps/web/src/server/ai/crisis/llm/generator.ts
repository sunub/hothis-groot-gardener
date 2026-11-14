import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { aiCrisisOutputSchema } from '@/lib/contract/schemas';
import type { AiCrisisOutput } from '@/lib/contract/types';
import { fallbackCrises, pickFallbackCandidate } from '../fallback';
import type { CrisisGenerator, GenerationCandidate, GenerationInput } from '../generator';
import { chatJson } from './client';
import type { LlmConfig } from './config';
import { checkWording } from './guard';
import { buildMessages, buildOutputSchema } from './prompt';
import { buildRetrievalQuery, retrieveExcerpts, type EvidenceChunk } from './retrieval';

/**
 * The crisis generator: one model call per attempt (planning document:
 * "위기 하나는 AI 호출 한 번으로 만듭니다").
 *
 * 1. Pick the candidate the same way as the pre-made path: the first one
 *    (implementation notes, entry 7). The model never chooses the crisis.
 * 2. Optionally fetch background excerpts from the evidence search.
 * 3. Call the model with a JSON schema whose enums hold only this crisis's
 *    symptom and action ids.
 * 4. Shuffle the options, so the appropriate one is not always in the same place.
 * 5. Check the wording (guard.ts). A problem throws, and the pipeline counts
 *    the attempt as failed: one retry, then the pre-made crisis.
 *
 * validateAiOutput (validate.ts) still runs on the result in the pipeline.
 */

export class GenerationRejectedError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Generated text was rejected: ${issues.slice(0, 3).join(' ')}`);
    this.name = 'GenerationRejectedError';
  }
}

export interface LlmGeneratorDeps {
  fetchImpl?: typeof fetch;
  /** 0 <= value < 1. Used to shuffle the options. */
  random?: () => number;
  now?: () => Date;
}

export function createLlmGenerator(config: LlmConfig, deps: LlmGeneratorDeps = {}): CrisisGenerator {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const random = deps.random ?? Math.random;
  const now = deps.now ?? (() => new Date());

  return async (input: GenerationInput, signal: AbortSignal): Promise<unknown> => {
    const started = Date.now();
    const candidate = pickFallbackCandidate(input.candidates);

    let excerpts: EvidenceChunk[] = [];
    if (config.ragUrl) {
      excerpts = await retrieveExcerpts(buildRetrievalQuery(candidate), {
        ragUrl: config.ragUrl,
        topN: config.ragTopN,
        timeoutMs: config.ragTimeoutMs,
        signal,
        fetchImpl,
      });
    }

    const messages = buildMessages({
      input,
      candidate,
      excerpts,
      example: styleExample(candidate),
    });
    const schema = buildOutputSchema(candidate, input.limits.clues_max);

    let output: AiCrisisOutput | undefined;
    let issues: string[] = [];
    try {
      const raw = await chatJson(config, messages, schema, signal, fetchImpl);
      const parsed = aiCrisisOutputSchema.safeParse(raw);
      if (!parsed.success) {
        issues = parsed.error.issues.map((i) => `shape: ${i.path.join('.') || '(root)'}: ${i.message}`);
      } else {
        output = { ...parsed.data, options: shuffle(parsed.data.options, random) };
        issues = checkWording(output, candidate);
      }
    } catch (error) {
      issues = [error instanceof Error ? error.message : String(error)];
      await writeLog(config, now(), { candidate, excerpts, output, issues, ms: Date.now() - started });
      throw error;
    }

    await writeLog(config, now(), { candidate, excerpts, output, issues, ms: Date.now() - started });
    if (issues.length > 0 || !output) throw new GenerationRejectedError(issues);
    return output;
  };
}

/** A reviewed pre-made crisis for the same crisis: same stage if there is one, else any stage. */
export function styleExample(candidate: GenerationCandidate): AiCrisisOutput | undefined {
  const sameCrisis = fallbackCrises.crises.filter(
    (e) => e.output.crisis_id === candidate.crisis_id && e.locale === 'en',
  );
  const entry = sameCrisis.find((e) => e.stage === candidate.stage) ?? sameCrisis[0];
  return entry?.output;
}

/** Fisher-Yates on a copy. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface LogRecord {
  candidate: GenerationCandidate;
  excerpts: EvidenceChunk[];
  output?: AiCrisisOutput;
  issues: string[];
  ms: number;
}

/** Append one line to <LLM_LOG_DIR>/generations.jsonl (backend task "생성 기록 남기기"). */
async function writeLog(config: LlmConfig, at: Date, record: LogRecord): Promise<void> {
  if (!config.logDir) return;
  const line = JSON.stringify({
    at: at.toISOString(),
    model: config.model,
    crisis_id: record.candidate.crisis_id,
    stage: record.candidate.stage,
    excerpt_ids: record.excerpts.map((e) => e.id),
    ok: record.issues.length === 0 && record.output !== undefined,
    issues: record.issues,
    ms: record.ms,
    output: record.output ?? null,
  });
  try {
    await mkdir(config.logDir, { recursive: true });
    await appendFile(path.join(config.logDir, 'generations.jsonl'), `${line}\n`, 'utf8');
  } catch (error) {
    console.warn('Could not write the generation log.', error);
  }
}
