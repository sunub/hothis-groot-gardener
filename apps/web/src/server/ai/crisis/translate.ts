import type { AiCrisisOutput, EvidenceCrisis } from '@/lib/contract/types';

/**
 * The seam where the Korean translation plugs in. The generator writes
 * English only; for a Korean request the English text that passed validation
 * is translated, and the translation is validated again.
 *
 * Only the text fields are translated. Ids, the option order and the counts
 * come from the English output, so a translation can never change which
 * symptom or action a text belongs to.
 */

/** The text fields of a crisis output, without ids. Arrays follow the source order. */
export interface CrisisTexts {
  scene: string;
  plant_line: string;
  clues: string[];
  options: { label: string; result_line: string; why: string }[];
}

/** Korean names from the evidence list, so wording matches the rest of the screen. */
export interface TranslationGlossary {
  crisis: string;
  /** In the order of the source clues. */
  symptoms: string[];
  /** In the order of the source options. */
  actions: string[];
}

export interface TranslationInput {
  source: AiCrisisOutput;
  glossary: TranslationGlossary;
}

/**
 * Translates the English output. The result is untrusted: `applyTranslation`
 * and `validateAiOutput` check it before use. Must stop work when `signal` aborts.
 */
export type CrisisTranslator = (input: TranslationInput, signal: AbortSignal) => Promise<unknown>;

/** The English text fields of an output. */
export function textsOf(output: AiCrisisOutput): CrisisTexts {
  return {
    scene: output.scene,
    plant_line: output.plant_line,
    clues: output.clues.map((c) => c.text),
    options: output.options.map((o) => ({ label: o.label, result_line: o.result_line, why: o.why })),
  };
}

/** Glossary for an output, from the Korean-localized crisis. */
export function buildGlossary(source: AiCrisisOutput, crisis: EvidenceCrisis): TranslationGlossary {
  return {
    crisis: crisis.name,
    symptoms: source.clues.map((c) => crisis.symptoms.find((s) => s.symptom_id === c.symptom_id)?.name ?? ''),
    actions: source.options.map((o) => crisis.actions.find((a) => a.action_id === o.action_id)?.name ?? ''),
  };
}

/** The merged output, or every rule the translation broke. */
export type TranslationResult = { ok: true; value: AiCrisisOutput } | { ok: false; issues: string[] };

/**
 * Put the translated texts into the source output, keeping its ids and order,
 * then check each text. `raw` is the translator's reply (untrusted).
 */
export function applyTranslation(source: AiCrisisOutput, raw: unknown): TranslationResult {
  const texts = asTexts(raw);
  if (!texts) return { ok: false, issues: ['translation: the reply does not have the expected shape.'] };
  if (texts.clues.length !== source.clues.length) {
    return {
      ok: false,
      issues: [`translation: expected ${source.clues.length} clues, got ${texts.clues.length}.`],
    };
  }
  if (texts.options.length !== source.options.length) {
    return {
      ok: false,
      issues: [`translation: expected ${source.options.length} options, got ${texts.options.length}.`],
    };
  }

  const value: AiCrisisOutput = {
    crisis_id: source.crisis_id,
    scene: texts.scene,
    plant_line: texts.plant_line,
    clues: source.clues.map((c, i) => ({ symptom_id: c.symptom_id, text: texts.clues[i] })),
    options: source.options.map((o, i) => ({ action_id: o.action_id, ...texts.options[i] })),
  };

  const pairs: [string, string, string][] = [
    ['scene', source.scene, value.scene],
    ['plant_line', source.plant_line, value.plant_line],
    ...source.clues.map((c, i): [string, string, string] => [`clues[${i}].text`, c.text, value.clues[i].text]),
    ...source.options.flatMap((o, i): [string, string, string][] => [
      [`options[${i}].label`, o.label, value.options[i].label],
      [`options[${i}].result_line`, o.result_line, value.options[i].result_line],
      [`options[${i}].why`, o.why, value.options[i].why],
    ]),
  ];
  const issues = pairs.flatMap(([path, english, korean]) => checkTranslatedText(path, english, korean));
  return issues.length === 0 ? { ok: true, value } : { ok: false, issues };
}

/** Hangul syllables and jamo. */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/g;
const LATIN = /[A-Za-z]/g;

/**
 * One translated text against its English source: it must be Korean (not the
 * English text handed back, not mostly Latin letters) and keep every number.
 */
export function checkTranslatedText(path: string, english: string, korean: string): string[] {
  const issues: string[] = [];
  const hangul = korean.match(HANGUL)?.length ?? 0;
  const latin = korean.match(LATIN)?.length ?? 0;
  if (korean.trim() === english.trim() || hangul === 0) {
    issues.push(`${path} is not translated into Korean.`);
  } else if (latin > hangul) {
    issues.push(`${path} is mostly Latin letters; write it in Korean.`);
  }
  for (const digits of new Set(english.match(/\d+/g) ?? [])) {
    if (!korean.includes(digits)) issues.push(`${path} lost the number ${digits}.`);
  }
  return issues;
}

function asTexts(raw: unknown): CrisisTexts | undefined {
  if (!isRecord(raw)) return undefined;
  const { scene, plant_line, clues, options } = raw;
  if (typeof scene !== 'string' || typeof plant_line !== 'string') return undefined;
  if (!Array.isArray(clues) || !clues.every((c) => typeof c === 'string')) return undefined;
  if (!Array.isArray(options)) return undefined;
  const parsed: CrisisTexts['options'] = [];
  for (const option of options) {
    if (!isRecord(option)) return undefined;
    const { label, result_line, why } = option;
    if (typeof label !== 'string' || typeof result_line !== 'string' || typeof why !== 'string') {
      return undefined;
    }
    parsed.push({ label, result_line, why });
  }
  return { scene, plant_line, clues: clues as string[], options: parsed };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
