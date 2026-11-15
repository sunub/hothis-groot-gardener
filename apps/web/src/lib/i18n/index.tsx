'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { Locale } from '@/lib/contract/types';
import { en } from './en';
import { ko } from './ko';
import type { Dictionary } from './types';

export type { Dictionary };

/**
 * All text shown on screen lives in dictionaries under this folder, one
 * namespace per screen group. Components read text with useDictionary().
 * To add a language, add a dictionary typed as Dictionary and register it here.
 */
const dictionaries: Record<Locale, Dictionary> = { en, ko };

export const DEFAULT_LOCALE: Locale = 'en';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dictionary: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const LOCALE_STORAGE_KEY = 'space-garden:locale';
const localeListeners = new Set<() => void>();

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ko';
}

/** The saved language, or the default when nothing valid is saved or storage is blocked. */
function readStoredLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(saved) ? saved : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function subscribeLocale(listener: () => void): () => void {
  localeListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    localeListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/**
 * Holds the chosen language. The server and the first client render use the
 * default language, then the saved choice takes over, so the markup matches.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, readStoredLocale, () => DEFAULT_LOCALE);

  const setLocale = useCallback((next: Locale) => {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Storage is blocked: the choice lasts only until the page reloads.
    }
    localeListeners.forEach((listener) => listener());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, dictionary: dictionaries[locale] }),
    [locale, setLocale],
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
