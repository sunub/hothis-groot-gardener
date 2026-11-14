import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { aiCrisisOutputSchema } from '@/lib/contract/schemas';
import type { AiCrisisOutput } from '@/lib/contract/types';
import { fallbackCrises, pickFallbackCandidate } from '../fallback';
import type { CrisisGenerator, GenerationCandidate, GenerationInput } from '../generator';
import { chatJson } from './client';
import type { LlmConfig } from './config';
import { checkStructure, checkWording } from './guard';
import { buildMessages, buildOutputSchema, type ChatMessage, type StyleExample } from './prompt';
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
 * 5. Check the structure and the wording (guard.ts). On a problem, send the
 *    list of broken rules back and let the model rewrite once (LLM_REPAIRS).
 *    A problem after that throws, and the pipeline counts the attempt as
 *    failed: one retry, then the pre-made crisis.
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
    let firstIssues: string[] = [];
    let repairs = 0;
    try {
      let raw = await chatJson(config, messages, schema, signal, fetchImpl);
      ({ output, issues } = review(raw, candidate, random));
      firstIssues = issues;
      // Ask the model to fix its own rule breaks, inside the same attempt. A plain
      // retry gets the same input and tends to repeat the same mistake.
      while (issues.length > 0 && repairs < config.repairs) {
        repairs++;
        raw = await chatJson(config, repairMessages(messages, raw, issues), schema, signal, fetchImpl);
        ({ output, issues } = review(raw, candidate, random));
      }
    } catch (error) {
      issues = [error instanceof Error ? error.message : String(error)];
      await writeLog(config, now(), { candidate, excerpts, output: undefined, issues, firstIssues, repairs, ms: Date.now() - started });
      throw error;
    }

    await writeLog(config, now(), { candidate, excerpts, output, issues, firstIssues, repairs, ms: Date.now() - started });
    if (issues.length > 0 || !output) throw new GenerationRejectedError(issues);
    return output;
  };
}

/** Parse, shuffle the options and check one model reply. */
function review(
  raw: unknown,
  candidate: GenerationCandidate,
  random: () => number,
): { output: AiCrisisOutput | undefined; issues: string[] } {
  const parsed = aiCrisisOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      output: undefined,
      issues: parsed.error.issues.map((i) => `shape: ${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  const output = { ...parsed.data, options: shuffle(parsed.data.options, random) };
  return { output, issues: [...checkStructure(output, candidate), ...checkWording(output, candidate)] };
}

/** The conversation so far, plus the list of rules the reply broke. */
export function repairMessages(messages: ChatMessage[], raw: unknown, issues: string[]): ChatMessage[] {
  return [
    ...messages,
    { role: 'assistant', content: JSON.stringify(raw) },
    {
      role: 'user',
      content: `Your JSON broke these rules:\n${issues.map((i) => `- ${i}`).join('\n')}\nWrite the whole JSON again with these problems fixed. Follow every rule from the first message.`,
    },
  ];
}

/**
 * Scene, plant line and clues of a reviewed pre-made crisis for the same
 * crisis (same stage if there is one), as a tone and length example. The
 * options are left out: the first Gemma runs copied the example's option
 * text word for word, so every run read the same.
 */
export function styleExample(candidate: GenerationCandidate): StyleExample | undefined {
  const sameCrisis = fallbackCrises.crises.filter(
    (e) => e.output.crisis_id === candidate.crisis_id && e.locale === 'en',
  );
  const entry = sameCrisis.find((e) => e.stage === candidate.stage) ?? sameCrisis[0];
  if (!entry) return undefined;
  const { scene, plant_line, clues } = entry.output;
  return { scene, plant_line, clues };
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
  /** Problems in the first reply, before any rewrite. */
  firstIssues: string[];
  repairs: number;
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
    repairs: record.repairs,
    first_issues: record.firstIssues,
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
