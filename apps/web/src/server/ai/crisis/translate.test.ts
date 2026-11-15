import { describe, expect, it } from 'vitest';
import type { AiCrisisOutput } from '@/lib/contract/types';
import { evidence } from '@/lib/evidence';
import { localizeEvidence } from '@/lib/evidence/localize';
import { findCrisis } from '@/lib/evidence/select';
import { getFallbackCrisis } from './fallback';
import { applyTranslation, buildGlossary, checkTranslatedText, textsOf } from './translate';

const source: AiCrisisOutput = getFallbackCrisis('water_shortage', 1, 'en', [])!;
const korean = getFallbackCrisis('water_shortage', 1, 'ko', [])!;

describe('applyTranslation', () => {
  it('keeps ids and order from the source and takes the Korean texts', () => {
    const result = applyTranslation(source, textsOf(korean));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.crisis_id).toBe(source.crisis_id);
    expect(result.value.clues.map((c) => c.symptom_id)).toEqual(source.clues.map((c) => c.symptom_id));
    expect(result.value.options.map((o) => o.action_id)).toEqual(source.options.map((o) => o.action_id));
    expect(result.value.scene).toBe(korean.scene);
  });

  it('ignores ids the translator adds, since only texts are read', () => {
    const texts = textsOf(korean);
    const withIds = { ...texts, options: texts.options.map((o) => ({ ...o, action_id: 'something_else' })) };
    const result = applyTranslation(source, withIds);
    expect(result.ok && result.value.options.map((o) => o.action_id)).toEqual(
      source.options.map((o) => o.action_id),
    );
  });

  it('rejects a reply with the wrong shape', () => {
    expect(applyTranslation(source, { scene: 1 }).ok).toBe(false);
    expect(applyTranslation(source, null).ok).toBe(false);
  });

  it('rejects a different number of clues or options', () => {
    const texts = textsOf(korean);
    const fewerClues = applyTranslation(source, { ...texts, clues: texts.clues.slice(0, 1) });
    expect(fewerClues.ok).toBe(false);
    const fewerOptions = applyTranslation(source, { ...texts, options: texts.options.slice(0, 2) });
    expect(fewerOptions.ok).toBe(false);
  });

  it('rejects text that was not translated', () => {
    const result = applyTranslation(source, textsOf(source));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join(' ')).toMatch(/not translated/);
  });
});

describe('checkTranslatedText', () => {
  it('accepts Korean text that keeps its numbers', () => {
    expect(checkTranslatedText('x', 'Day 3 is dry.', '3일째 건조합니다.')).toEqual([]);
  });

  it('rejects the English text handed back', () => {
    expect(checkTranslatedText('x', 'The leaves droop.', 'The leaves droop.')).toHaveLength(1);
  });

  it('rejects text that is mostly Latin letters', () => {
    expect(checkTranslatedText('x', 'The leaves droop slowly.', 'The leaves droop 잎')).toHaveLength(1);
  });

  it('rejects a lost number', () => {
    expect(checkTranslatedText('x', 'Day 3 is dry.', '건조합니다.')[0]).toMatch(/number 3/);
  });
});

describe('buildGlossary', () => {
  it('lists the Korean names in the order of the source clues and options', () => {
    const crisis = findCrisis(localizeEvidence(evidence, 'ko'), source.crisis_id)!;
    const glossary = buildGlossary(source, crisis);
    expect(glossary.crisis).toBe(crisis.name);
    expect(glossary.symptoms).toHaveLength(source.clues.length);
    expect(glossary.actions).toHaveLength(source.options.length);
    expect(glossary.actions.every((name) => name.length > 0)).toBe(true);
  });
});
