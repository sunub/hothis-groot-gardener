import { checkTranslatedText } from '../crisis/translate';

/**
 * Korean translation of cultivation diary lines (experiment records and
 * observation lines). The lines are written in English in the event list.
 * For a Korean screen the English text is translated by the language model;
 * the reply is untrusted, so each text is checked before it is used. A text
 * that fails the check is left out and the screen keeps the English line.
 */

/** Most texts one request may carry, and the longest one. */
export const MAX_DIARY_TEXTS = 24;
export const MAX_DIARY_TEXT_LENGTH = 600;

/** Translates English texts to Korean, one result per text, in order. Must stop work when `signal` aborts. */
export type DiaryTranslator = (texts: string[], signal: AbortSignal) => Promise<unknown>;

/**
 * Korean text of each source, in order; null where the translation is
 * missing or breaks a rule (not Korean, English words left, a number lost).
 */
export function checkDiaryTranslations(sources: readonly string[], raw: unknown): (string | null)[] {
  const replies = Array.isArray(raw) ? raw : null;
  return sources.map((english, i) => {
    const korean = replies?.[i];
    if (typeof korean !== 'string') return null;
    return checkTranslatedText(`texts[${i}]`, english, korean).length === 0 ? korean.trim() : null;
  });
}

export interface DiaryTranslateOptions {
  translator?: DiaryTranslator;
  timeoutMs?: number;
  /** Texts already translated (English -> Korean). Filled with new results. */
  cache?: Map<string, string>;
}

/**
 * Korean texts for the given English texts, in order. Without a translator,
 * or when it fails, a text is null and the caller keeps the English.
 */
export async function translateDiaryTexts(
  texts: readonly string[],
  { translator, timeoutMs = 30_000, cache = new Map() }: DiaryTranslateOptions,
): Promise<(string | null)[]> {
  const missing = [...new Set(texts)].filter((text) => !cache.has(text));
  if (missing.length > 0 && translator) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const raw = await translator(missing, controller.signal);
      checkDiaryTranslations(missing, raw).forEach((korean, i) => {
        if (korean !== null) cache.set(missing[i], korean);
      });
    } catch (error) {
      console.warn('Diary translation failed', error);
    } finally {
      clearTimeout(timer);
    }
  }
  return texts.map((text) => cache.get(text) ?? null);
}
