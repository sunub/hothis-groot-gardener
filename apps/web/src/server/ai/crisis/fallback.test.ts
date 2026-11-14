import { describe, expect, it } from 'vitest';
import { evidence, findAction, findCrisis, maxStageOf, symptomsUpToStage } from '@/lib/evidence';
import { effectiveExclusions, fallbackCrises, getFallbackCrisis } from './fallback';
import { validateAiOutput } from './validate';

const entries = fallbackCrises.crises.map((e) => [e.output.crisis_id, e.stage, e] as const);

function crisisOf(id: string) {
  const crisis = findCrisis(evidence, id);
  if (!crisis) throw new Error(`Unknown crisis ${id}`);
  return crisis;
}

describe('fallback crisis file', () => {
  it('has an entry for every crisis and every stage it can have', () => {
    for (const crisis of evidence.crises) {
      for (let stage = 1; stage <= maxStageOf(crisis); stage++) {
        const found = fallbackCrises.crises.some(
          (e) => e.output.crisis_id === crisis.crisis_id && e.stage === stage && e.locale === 'en',
        );
        expect(found, `${crisis.crisis_id} stage ${stage}`).toBe(true);
      }
    }
  });

  it('carries a disclosure sentence', () => {
    expect(fallbackCrises.meta.ai_disclosure.trim()).not.toBe('');
  });

  it.each(entries)('%s stage %i passes validateAiOutput', (id, stage, entry) => {
    const result = validateAiOutput(entry.output, {
      candidates: [{ crisis: crisisOf(id), stage }],
      excludedActionIds: [],
    });
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it.each(entries)('%s stage %i offers every action of the crisis', (id, _stage, entry) => {
    const offered = entry.output.options.map((o) => o.action_id).sort();
    expect(offered).toEqual(crisisOf(id).actions.map((a) => a.action_id).sort());
  });

  it.each(entries)('%s stage %i uses a symptom of its own stage', (id, stage, entry) => {
    const newest = symptomsUpToStage(crisisOf(id), stage).filter((s) => s.stage === stage);
    const used = entry.output.clues.map((c) => c.symptom_id);
    expect(newest.some((s) => used.includes(s.symptom_id))).toBe(true);
  });

  it.each(entries)('%s stage %i still passes with one inappropriate action excluded', (id, stage) => {
    const crisis = crisisOf(id);
    const wrong = crisis.actions.find((a) => a.verdict === 'inappropriate')!;
    const output = getFallbackCrisis(id, stage, 'en', [wrong.action_id]);
    expect(output).not.toBeNull();
    expect(output!.options.map((o) => o.action_id)).not.toContain(wrong.action_id);
    const result = validateAiOutput(output, {
      candidates: [{ crisis, stage }],
      excludedActionIds: [wrong.action_id],
    });
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it('contains none of the words safe, edible, pass, approved', () => {
    const text = JSON.stringify(fallbackCrises).toLowerCase();
    for (const word of ['safe', 'edible', 'pass', 'approved']) {
      expect(text, word).not.toContain(word);
    }
  });

  it('does not describe symptoms that have no source in the evidence list', () => {
    const text = JSON.stringify(fallbackCrises.crises).toLowerCase();
    for (const word of ['wilt', 'curl', 'necro', 'guttation', 'leaf tip', 'cut away', 'trim']) {
      expect(text, word).not.toContain(word);
    }
  });

  it.each(entries)('%s stage %i labels do not differ much in length', (_id, _stage, entry) => {
    const lengths = entry.output.options.map((o) => o.label.length);
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(10);
  });

  it.each(entries)('%s stage %i scene has 2-3 sentences and no numbers', (_id, _stage, entry) => {
    const sentences = entry.output.scene.split(/(?<=\.)\s+/).filter(Boolean);
    expect(sentences.length).toBeGreaterThanOrEqual(2);
    expect(sentences.length).toBeLessThanOrEqual(3);
    expect(entry.output.scene).not.toMatch(/\d/);
  });
});

describe('getFallbackCrisis', () => {
  it('returns the exact stage', () => {
    expect(getFallbackCrisis('overwater_mold', 2, 'en', [])!.clues.map((c) => c.symptom_id)).toContain(
      'fungal_growth',
    );
  });

  it('uses the nearest lower stage when the stage is missing', () => {
    const out = getFallbackCrisis('water_shortage', 5, 'en', []);
    expect(out).toEqual(getFallbackCrisis('water_shortage', 2, 'en', []));
  });

  it('returns null for an unknown crisis', () => {
    expect(getFallbackCrisis('nope', 1, 'en', [])).toBeNull();
  });

  it('falls back to English for a locale without text', () => {
    expect(getFallbackCrisis('water_shortage', 1, 'ko', [])).toEqual(
      getFallbackCrisis('water_shortage', 1, 'en', []),
    );
  });

  it('never removes the only appropriate option', () => {
    const out = getFallbackCrisis('overwater_mold', 1, 'en', ['fan_high'])!;
    expect(out.options.map((o) => o.action_id)).toContain('fan_high');
  });

  it('keeps at least 3 options when two actions are excluded', () => {
    const out = getFallbackCrisis('water_shortage', 1, 'en', ['wait_for_schedule', 'fan_high'])!;
    const ids = out.options.map((o) => o.action_id);
    expect(ids).toHaveLength(3);
    expect(ids).not.toContain('wait_for_schedule');
    expect(ids).toContain('fan_high');
  });

  it('does not change the loaded file', () => {
    const before = JSON.stringify(fallbackCrises);
    getFallbackCrisis('water_shortage', 1, 'en', ['fan_high'])!.options.pop();
    expect(JSON.stringify(fallbackCrises)).toBe(before);
  });
});

describe('effectiveExclusions', () => {
  const water = findCrisis(evidence, 'water_shortage')!;

  it('keeps exclusions that leave 3 options and an appropriate one', () => {
    expect(effectiveExclusions(water, ['fan_high'])).toEqual(['fan_high']);
  });

  it('drops an exclusion that would leave fewer than 3 options', () => {
    expect(effectiveExclusions(water, ['wait_for_schedule', 'fan_high'])).toEqual([
      'wait_for_schedule',
    ]);
  });

  it('drops an exclusion of the only appropriate action and unknown ids', () => {
    expect(effectiveExclusions(water, ['add_water_direct', 'nope'])).toEqual([]);
    expect(findAction(water, 'add_water_direct')!.verdict).toBe('appropriate');
  });
});
