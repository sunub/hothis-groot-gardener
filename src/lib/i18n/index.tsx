'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '@/lib/contract/types';
import { en } from './en';

/**
 * All text shown on screen lives in dictionaries under this folder, one
 * namespace per screen group. Components read text with useDictionary().
 * To add a language, add a dictionary with the same shape and register it here.
 */
export type Dictionary = typeof en;

const dictionaries: Partial<Record<Locale, Dictionary>> = { en };

export const DEFAULT_LOCALE: Locale = 'en';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dictionary: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, dictionary: dictionaries[locale] ?? en }),
    [locale],
  );
  return <LocaleContext value={value}>{children}</LocaleContext>;
}

function useLocaleContext(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useDictionary must be used inside LocaleProvider');
  return value;
}

export function useDictionary(): Dictionary {
  return useLocaleContext().dictionary;
}

export function useLocale(): Pick<LocaleContextValue, 'locale' | 'setLocale'> {
  const { locale, setLocale } = useLocaleContext();
  return { locale, setLocale };
}

/** Replace {name} placeholders in a dictionary string. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
