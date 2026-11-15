import koRaw from '@content/evidence.ko.json';
import type { EvidenceList, Locale } from '@/lib/contract/types';

/**
 * Korean text for the evidence list (data/content/evidence.ko.json), keyed by
 * the ids of evidence.json. Only the sentences the team wrote are here.
 * Source quotes, titles, notes and every number stay in the English file.
 */
export interface EvidenceTranslation {
  meta: { description: string; ai_disclosure: string };
  crises: Record<
    string,
    {
      name: string;
      summary: string;
      record_crop: string;
      record_note?: string;
      symptoms: Record<string, string>;
      actions: Record<string, { name: string; reason: string }>;
    }
  >;
  harvest: {
    steps: Record<string, { name: string; description: string }>;
    microbial_range_description: string;
    pathogen_result: string;
  };
  background: Record<string, string>;
}

export const evidenceKo: EvidenceTranslation = koRaw;

/**
 * A copy of the list with the team-written text in the given language.
 * English returns the list itself. An id without a translation keeps its
 * English text (the test suite requires a translation for every id).
 */
export function localizeEvidence(
  list: EvidenceList,
  locale: Locale,
  translation: EvidenceTranslation = evidenceKo,
): EvidenceList {
  if (locale === 'en') return list;
  const t = translation;
  return {
    ...list,
    meta: { ...list.meta, ...t.meta },
    crises: list.crises.map((crisis) => {
      const c = t.crises[crisis.crisis_id];
      if (!c) return crisis;
      return {
        ...crisis,
        name: c.name,
        summary: c.summary,
        record: {
          ...crisis.record,
          crop: c.record_crop,
          note: crisis.record.note && c.record_note ? c.record_note : crisis.record.note,
        },
        symptoms: crisis.symptoms.map((s) => ({ ...s, name: c.symptoms[s.symptom_id] ?? s.name })),
        actions: crisis.actions.map((a) => {
          const text = c.actions[a.action_id];
          return text ? { ...a, name: text.name, reason: text.reason } : a;
        }),
      };
    }),
    harvest: {
      ...list.harvest,
      steps: list.harvest.steps.map((step) => {
        const text = t.harvest.steps[step.step_id];
        return text ? { ...step, ...text } : step;
      }),
      microbial_range: {
        ...list.harvest.microbial_range,
        description: t.harvest.microbial_range_description,
      },
      pathogen_screen: { ...list.harvest.pathogen_screen, result: t.harvest.pathogen_result },
    },
    background: list.background.map((claim) => ({
      ...claim,
      claim: t.background[claim.claim_id] ?? claim.claim,
    })),
  };
}
