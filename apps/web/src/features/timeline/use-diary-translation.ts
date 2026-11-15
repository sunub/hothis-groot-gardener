'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DiaryTranslateResponse } from '@/lib/contract/schemas';
import type { Locale } from '@/lib/contract/types';
import type { DiaryLine } from './diary';

export const DIARY_TRANSLATE_ENDPOINT = '/api/diary-translate';

/** English line -> Korean line, kept for the life of the page. Lines are fixed text. */
const translated = new Map<string, string>();
/** Lines already asked for, so a failed or empty answer is not asked again in a loop. */
const asked = new Set<string>();

type TextLine = Extract<DiaryLine, { kind: 'experiment' | 'observation' }>;

function isTextLine(line: DiaryLine): line is TextLine {
  return (line.kind === 'experiment' || line.kind === 'observation') && line.text !== '';
}

/**
 * Diary lines in the screen language. In Korean, the English experiment and
 * observation lines are sent to POST /api/diary-translate (written by the
 * language model, checked on the server) and shown in Korean with a mark that
 * says so. While the answer is pending, or when no translation is available,
 * the English line stays, so the diary is never empty or blocked.
 */
export function useDiaryTranslation(lines: readonly DiaryLine[], locale: Locale): DiaryLine[] {
  const [version, setVersion] = useState(0);

  const pending = useMemo(
    () => (locale === 'ko' ? [...new Set(lines.filter(isTextLine).map((l) => l.text))] : []),
    [lines, locale],
  );

  useEffect(() => {
    const missing = pending.filter((text) => !translated.has(text) && !asked.has(text));
    if (missing.length === 0) return;
    const controller = new AbortController();
    missing.forEach((text) => asked.add(text));
    (async () => {
      try {
        const response = await fetch(DIARY_TRANSLATE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: 'ko', texts: missing }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Diary translation answered ${response.status}`);
        const { translations } = (await response.json()) as DiaryTranslateResponse;
        translations.forEach((korean, i) => {
          if (typeof korean === 'string' && missing[i] !== undefined) translated.set(missing[i], korean);
        });
        setVersion((v) => v + 1);
      } catch (error) {
        // Leaving the screen aborts the request; ask again next time.
        if (controller.signal.aborted) missing.forEach((text) => asked.delete(text));
        else console.warn('Diary translation request failed', error);
      }
    })();
    return () => controller.abort();
  }, [pending]);

  return useMemo(
    () =>
      locale === 'ko'
        ? lines.map((line) => {
            if (!isTextLine(line)) return line;
            const korean = translated.get(line.text);
            return korean ? { ...line, text: korean, ai_translated: true } : line;
          })
        : [...lines],
    // `version` changes when new translations arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, locale, version],
  );
}
