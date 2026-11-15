import { describe, expect, it } from 'vitest';
import evidenceRaw from '@content/evidence.json';
import type { EvidenceList } from '@/lib/contract/types';
import { findBannedClaims } from '@/lib/contract/claims';
import { evidenceKo, localizeEvidence } from './localize';

const en = evidenceRaw as EvidenceList;
const ko = localizeEvidence(en, 'ko');

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}

describe('localizeEvidence', () => {
  it('returns the same list for English', () => {
    expect(localizeEvidence(en, 'en')).toBe(en);
  });

  it('has a Korean text for every crisis, symptom, action, step and claim', () => {
    expect(Object.keys(evidenceKo.crises).sort()).toEqual(en.crises.map((c) => c.crisis_id).sort());
    for (const crisis of en.crises) {
      const t = evidenceKo.crises[crisis.crisis_id];
      expect(Object.keys(t.symptoms).sort()).toEqual(crisis.symptoms.map((s) => s.symptom_id).sort());
      expect(Object.keys(t.actions).sort()).toEqual(crisis.actions.map((a) => a.action_id).sort());
      expect(Boolean(crisis.record.note), crisis.crisis_id).toBe(Boolean(t.record_note));
    }
    expect(Object.keys(evidenceKo.harvest.steps).sort()).toEqual(en.harvest.steps.map((s) => s.step_id).sort());
    expect(Object.keys(evidenceKo.background).sort()).toEqual(en.background.map((c) => c.claim_id).sort());
  });

  it('writes Korean in every translated field', () => {
    for (const crisis of ko.crises) {
      expect(crisis.name).toMatch(/[가-힣]/);
      expect(crisis.summary).toMatch(/[가-힣]/);
      crisis.symptoms.forEach((s) => expect(s.name).toMatch(/[가-힣]/));
      crisis.actions.forEach((a) => {
        expect(a.name).toMatch(/[가-힣]/);
        expect(a.reason).toMatch(/[가-힣]/);
      });
    }
    ko.harvest.steps.forEach((s) => expect(s.description).toMatch(/[가-힣]/));
    ko.background.forEach((c) => expect(c.claim).toMatch(/[가-힣]/));
  });

  it('keeps everything that is not team text: ids, verdicts, deltas, sources and numbers', () => {
    expect(ko.crises.map((c) => [c.crisis_id, c.trigger, c.source])).toEqual(
      en.crises.map((c) => [c.crisis_id, c.trigger, c.source]),
    );
    expect(ko.crises.flatMap((c) => c.actions.map((a) => [a.action_id, a.verdict, a.delta, a.source]))).toEqual(
      en.crises.flatMap((c) => c.actions.map((a) => [a.action_id, a.verdict, a.delta, a.source])),
    );
    expect(ko.crises.flatMap((c) => c.symptoms.map((s) => [s.stage, s.source]))).toEqual(
      en.crises.flatMap((c) => c.symptoms.map((s) => [s.stage, s.source])),
    );
    expect(ko.harvest.microbial_range.min).toBe(en.harvest.microbial_range.min);
    expect(ko.harvest.microbial_range.max).toBe(en.harvest.microbial_range.max);
    expect(ko.harvest.standards_note).toEqual(en.harvest.standards_note);
  });

  it('does not change the shared English list', () => {
    expect(en.crises[0].name).toBe('Water shortage');
  });

  it('has no safety verdict in the Korean text', () => {
    const own = [
      ...strings(evidenceKo.crises),
      ...strings(evidenceKo.harvest),
      ...strings(evidenceKo.background),
      evidenceKo.meta.description,
      evidenceKo.meta.ai_disclosure,
    ];
    expect(own.flatMap((text) => findBannedClaims(text).map((claim) => `${claim}: ${text}`))).toEqual([]);
  });
});
