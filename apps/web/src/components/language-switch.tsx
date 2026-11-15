'use client';

import { useDictionary, useLocale } from '@/lib/i18n';
import type { Locale } from '@/lib/contract/types';
import { cn } from '@/lib/utils/cn';

const LOCALES: readonly Locale[] = ['en', 'ko'];

/** Two buttons that switch the screen language. Each name is written in its own language. */
export function LanguageSwitch() {
  const t = useDictionary();
  const { locale, setLocale } = useLocale();
  return (
    <div role="group" aria-label={t.common.language.label} className="flex items-center gap-1">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
          className={cn(
            'px-2 py-0.5 text-caption',
            locale === code ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:text-ink',
          )}
        >
          {t.common.language[code]}
        </button>
      ))}
    </div>
  );
}
