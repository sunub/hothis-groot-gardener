'use client';

import { useMemo } from 'react';
import type { EvidenceList } from '@/lib/contract/types';
import { useLocale } from '@/lib/i18n';
import { evidence } from './index';
import { localizeEvidence } from './localize';

/** The evidence list in the screen language. Screens read text from here, not from the English file. */
export function useEvidence(): EvidenceList {
  const { locale } = useLocale();
  return useMemo(() => localizeEvidence(evidence, locale), [locale]);
}
