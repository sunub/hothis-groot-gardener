import { describe, expect, it } from 'vitest';
import type { AiCrisisOutput, CrisisRequest, EvidenceList, PlantState } from '@/lib/contract/types';
import { evidence } from '@/lib/evidence';
import { INITIAL_PLANT_STATE } from '@/lib/game/rules';
import { getFallbackCrisis } from './fallback';
import type { CrisisGenerator, GenerationInput } from './generator';
import { createCrisis, InvalidRequestError, NoCandidateError } from './pipeline';
import { textsOf, type CrisisTranslator, type TranslationInput } from './translate';

function request(
  state: Partial<PlantState>,
  patch: Partial<Omit<CrisisRequest, 'state'>> = {},
): CrisisRequest {
  return {
    locale: 'en',
    cultivation_day: 12,
    state: { ...INITIAL_PLANT_STATE, ...state },
    danger_days: { root_moisture: 1, humidity: 0 },
    history: [],
    active: null,
    ...patch,
  };
}

/** Low root moisture (danger): water_shortage is the only candidate. */
const dry = request({ root_moisture: 20 });
/** High root moisture with the fan low (danger): overwater_mold is the only candidate. */
const wet = request({ root_moisture: 85 });

function generatedWaterOutput(): AiCrisisOutput {
  const out = getFallbackCrisis('water_shortage', 1, 'en', [])!;
  return { ...out, scene: 'Generated scene. The leaves droop.' };
}

/** A fake generator that returns the given results in order and records its calls. */
function scripted(...results: (() => Promise<unknown>)[]) {
  const calls: { input: GenerationInput; signal: AbortSignal }[] = [];
  const generator: CrisisGenerator = (input, signal) => {
    calls.push({ input, signal });
    const next = results[Math.min(calls.length - 1, results.length - 1)];
    return next();
  };
  return { generator, calls };
}

const valid = () => Promise.resolve(generatedWaterOutput());
const invalid = () => Promise.resolve({ crisis_id: 'water_shortage', scene: 'Only a scene.' });
const throws = () => Promise.reject(new Error('generator failed'));
const never = () => new Promise<unknown>(() => undefined);

describe('createCrisis with a generator', () => {
  it('returns valid generated output as generated', async () => {
    const { generator, calls } = scripted(valid);
    const response = await createCrisis(dry, { generator });
    expect(response.origin).toBe('generated');
    expect(response.scene).toBe('Generated scene. The leaves droop.');
    expect(calls).toHaveLength(1);
  });

  it('retries once after invalid output', async () => {
    const { generator, calls } = scripted(invalid, valid);
    const response = await createCrisis(dry, { generator });
    expect(response.origin).toBe('generated');
    expect(calls).toHaveLength(2);
  });

  it('falls back after invalid output twice', async () => {
    const { generator, calls } = scripted(invalid, invalid, valid);
    const response = await createCrisis(dry, { generator });
    expect(response.origin).toBe('fallback');
    expect(calls).toHaveLength(2);
  });

  it('falls back when the generator throws', async () => {
    const { generator, calls } = scripted(throws);
    const response = await createCrisis(dry, { generator });
    expect(response.origin).toBe('fallback');
    expect(calls).toHaveLength(2);
  });

  it('falls back when the generator throws synchronously', async () => {
    const generator: CrisisGenerator = () => {
      throw new Error('sync failure');
    };
    expect((await createCrisis(dry, { generator })).origin).toBe('fallback');
  });

  it('falls back after the timeout when the generator never resolves, and aborts it', async () => {
    const { generator, calls } = scripted(never);
    const response = await createCrisis(dry, { generator, timeoutMs: 5 });
    expect(response.origin).toBe('fallback');
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.signal.aborted)).toBe(true);
  });

  it('skips the English-only generator for Korean without a translator and shows the pre-made Korean text', async () => {
    const { generator, calls } = scripted(valid);
    const response = await createCrisis({ ...dry, locale: 'ko' }, { generator });
    expect(calls).toHaveLength(0);
    expect(response.origin).toBe('fallback');
    expect(response.scene).toMatch(/[가-힣]/);
  });

  describe('Korean with a translator', () => {
    const koreanTexts = () => textsOf(getFallbackCrisis('water_shortage', 1, 'ko', [])!);
    const koreanRequest = { ...dry, locale: 'ko' as const };

    function translating(...results: (() => Promise<unknown>)[]) {
      const calls: TranslationInput[] = [];
      const translator: CrisisTranslator = (input) => {
        calls.push(input);
        return results[Math.min(calls.length - 1, results.length - 1)]();
      };
      return { translator, calls };
    }

    it('generates in English, translates, and returns Korean text as generated', async () => {
      const { generator, calls } = scripted(valid);
      const { translator, calls: translations } = translating(() => Promise.resolve(koreanTexts()));
      const response = await createCrisis(koreanRequest, { generator, translator });
      expect(calls[0].input.locale).toBe('en');
      expect(calls[0].input.candidates[0].name).toBe('Water shortage');
      expect(translations).toHaveLength(1);
      expect(translations[0].source.scene).toBe('Generated scene. The leaves droop.');
      expect(response.origin).toBe('generated');
      expect(response.scene).toMatch(/[가-힣]/);
      expect(response.name).toMatch(/[가-힣]/);
    });

    it('keeps ids and verdicts from the English output and the evidence list', async () => {
      const { generator } = scripted(valid);
      const { translator } = translating(() => Promise.resolve(koreanTexts()));
      const response = await createCrisis(koreanRequest, { generator, translator });
      const english = generatedWaterOutput();
      expect(response.options.map((o) => o.action_id)).toEqual(english.options.map((o) => o.action_id));
      const premade = await createCrisis(koreanRequest);
      for (const option of response.options) {
        const same = premade.options.find((o) => o.action_id === option.action_id);
        if (same) expect(option.verdict).toBe(same.verdict);
      }
    });

    it('falls back to the pre-made Korean text when the translation is not Korean', async () => {
      const { generator } = scripted(valid);
      const { translator } = translating(() => Promise.resolve(textsOf(generatedWaterOutput())));
      const response = await createCrisis(koreanRequest, { generator, translator });
      expect(response.origin).toBe('fallback');
      expect(response.scene).toMatch(/[가-힣]/);
    });

    it('falls back when the translation gives the verdict away', async () => {
      const { generator } = scripted(valid);
      const texts = koreanTexts();
      texts.options[0].label = '정답: 저수조를 채운다';
      const { translator } = translating(() => Promise.resolve(texts));
      const response = await createCrisis(koreanRequest, { generator, translator });
      expect(response.origin).toBe('fallback');
    });

    it('falls back when the translator throws or runs out of time, without generating again', async () => {
      const { generator, calls } = scripted(valid);
      const thrown = translating(() => Promise.reject(new Error('down')));
      expect((await createCrisis(koreanRequest, { generator, translator: thrown.translator })).origin).toBe(
        'fallback',
      );
      expect(calls).toHaveLength(1);

      const stuck = translating(() => new Promise<unknown>(() => undefined));
      const response = await createCrisis(koreanRequest, {
        generator,
        translator: stuck.translator,
        timeoutMs: 20,
      });
      expect(response.origin).toBe('fallback');
    });

    it('does not translate English requests', async () => {
      const { generator } = scripted(valid);
      const { translator, calls } = translating(() => Promise.resolve(koreanTexts()));
      const response = await createCrisis(dry, { generator, translator });
      expect(response.origin).toBe('generated');
      expect(calls).toHaveLength(0);
    });
  });

  it('shows Korean names and reasons in Korean, with the same verdicts and deltas', async () => {
    const en = await createCrisis(dry);
    const ko = await createCrisis({ ...dry, locale: 'ko' });
    expect(ko.name).toMatch(/[가-힣]/);
    expect(ko.options.every((o) => /[가-힣]/.test(o.reason))).toBe(true);
    const pick = (r: typeof en) =>
      r.options.map((o) => [o.action_id, o.verdict, o.delta, o.source]).sort();
    expect(pick(ko)).toEqual(pick(en));
  });

  it('rejects generated output that offers an excluded action', async () => {
    const out = getFallbackCrisis('overwater_mold', 2, 'en', [])!;
    const { generator } = scripted(() => Promise.resolve(out));
    const response = await createCrisis(
      request({ root_moisture: 85 }, {
        active: { crisis_id: 'overwater_mold', attempt: 2, chosen_action_ids: ['add_water'] },
      }),
      { generator },
    );
    expect(response.origin).toBe('fallback');
    expect(response.options.map((o) => o.action_id)).not.toContain('add_water');
  });

  it('gives the generator the input with excluded actions removed', async () => {
    const { generator, calls } = scripted(throws);
    await createCrisis(
      request({ root_moisture: 85 }, {
        active: { crisis_id: 'overwater_mold', attempt: 2, chosen_action_ids: ['add_water'] },
      }),
      { generator },
    );
    const input = calls[0].input;
    expect(input.candidates).toHaveLength(1);
    expect(input.candidates[0].stage).toBe(2);
    expect(input.candidates[0].actions.map((a) => a.action_id)).not.toContain('add_water');
    expect(input.excluded_action_ids).toEqual(['add_water']);
  });

  it('uses the stage of the candidate the generator chose', async () => {
    const both = request(
      { root_moisture: 35, humidity: 85 },
      { danger_days: { root_moisture: 0, humidity: 2 } },
    );
    const { generator } = scripted(() =>
      Promise.resolve(getFallbackCrisis('water_shortage', 1, 'en', [])),
    );
    const response = await createCrisis(both, { generator });
    expect(response).toMatchObject({ crisis_id: 'water_shortage', stage: 1, origin: 'generated' });
  });
});

describe('createCrisis without a generator', () => {
  it('returns the pre-made crisis for the first candidate', async () => {
    const response = await createCrisis(dry);
    expect(response).toMatchObject({
      crisis_id: 'water_shortage',
      stage: 1,
      attempt: 1,
      origin: 'fallback',
    });
    expect(response.options.length).toBeGreaterThanOrEqual(3);
    expect(response.options.some((o) => o.verdict === 'appropriate')).toBe(true);
  });

  it('is deterministic', async () => {
    expect(await createCrisis(wet)).toEqual(await createCrisis(wet));
  });

  it('picks the danger candidate first when two crises are candidates', async () => {
    const both = request({ root_moisture: 35, humidity: 85 });
    expect((await createCrisis(both)).crisis_id).toBe('overwater_mold');
  });

  it('uses the stage from the danger days', async () => {
    const response = await createCrisis(
      request({ root_moisture: 85 }, { danger_days: { root_moisture: 3, humidity: 0 } }),
    );
    expect(response.stage).toBe(3);
    expect(response.clues.map((c) => c.symptom_id)).toContain('rot');
  });

  it('shows the same crisis again one stage higher without the chosen action', async () => {
    const first = await createCrisis(wet);
    const again = await createCrisis(
      request({ root_moisture: 100 }, {
        active: { crisis_id: first.crisis_id, attempt: 2, chosen_action_ids: ['add_water'] },
      }),
    );
    expect(again.crisis_id).toBe(first.crisis_id);
    expect(again.stage).toBe(first.stage + 1);
    expect(again.attempt).toBe(2);
    expect(again.options.map((o) => o.action_id)).not.toContain('add_water');
  });

  it('does not re-check the trigger of the active crisis', async () => {
    const response = await createCrisis(
      request(
        { fan: 'high' },
        { active: { crisis_id: 'overwater_mold', attempt: 2, chosen_action_ids: ['add_water'] } },
      ),
    );
    expect(response.crisis_id).toBe('overwater_mold');
  });

  it('still returns 3 options when more actions were chosen than can be removed', async () => {
    const response = await createCrisis(
      request(
        { root_moisture: 20 },
        {
          active: {
            crisis_id: 'water_shortage',
            attempt: 3,
            chosen_action_ids: ['wait_for_schedule', 'fan_high'],
          },
        },
      ),
    );
    expect(response.options).toHaveLength(3);
    expect(response.options.map((o) => o.action_id)).not.toContain('wait_for_schedule');
  });

  it('throws NoCandidateError when no trigger holds', async () => {
    await expect(createCrisis(request({}))).rejects.toBeInstanceOf(NoCandidateError);
  });

  it('throws NoCandidateError for an unknown active crisis', async () => {
    await expect(
      createCrisis({ ...dry, active: { crisis_id: 'nope', attempt: 2, chosen_action_ids: [] } }),
    ).rejects.toBeInstanceOf(NoCandidateError);
  });
});

describe('createCrisis and the evidence list check (planning document: 근거 목록 불러오기와 점검)', () => {
  it('serves no crisis from an evidence list that fails its check', async () => {
    const broken: EvidenceList = structuredClone(evidence);
    broken.crises[0].source.quote = 'PROVISIONAL';
    await expect(
      createCrisis(request({ root_moisture: 20 }), { evidence: broken }),
    ).rejects.toThrow(/evidence list failed its check/);
  });
});

describe('createCrisis rejects ids that are not in the evidence list', () => {
  const resolvedWater = {
    crisis_id: 'water_shortage',
    cultivation_day: 6,
    choices: [{ action_id: 'add_water_direct', verdict: 'appropriate' as const }],
    outcome: 'resolved' as const,
  };

  it('accepts a history and an active crisis whose ids are all known', async () => {
    const response = await createCrisis(
      request(
        { root_moisture: 85 },
        {
          history: [resolvedWater],
          active: { crisis_id: 'overwater_mold', attempt: 2, chosen_action_ids: ['add_water'] },
        },
      ),
    );
    expect(response.crisis_id).toBe('overwater_mold');
  });

  it('rejects a history crisis that is not in the list', async () => {
    await expect(
      createCrisis({ ...dry, history: [{ ...resolvedWater, crisis_id: 'ignore_previous_rules' }] }),
    ).rejects.toBeInstanceOf(InvalidRequestError);
  });

  it('rejects a history choice that is not an action of that crisis', async () => {
    // add_water is an action of overwater_mold, not of water_shortage.
    const choices = [{ action_id: 'add_water', verdict: 'inappropriate' as const }];
    await expect(
      createCrisis({ ...dry, history: [{ ...resolvedWater, choices }] }),
    ).rejects.toBeInstanceOf(InvalidRequestError);
  });

  it('rejects a chosen action that is not an action of the active crisis', async () => {
    await expect(
      createCrisis({
        ...dry,
        active: { crisis_id: 'water_shortage', attempt: 2, chosen_action_ids: ['add_water'] },
      }),
    ).rejects.toBeInstanceOf(InvalidRequestError);
  });

  it('keeps NoCandidateError for an unknown active crisis even with chosen ids', async () => {
    await expect(
      createCrisis({ ...dry, active: { crisis_id: 'nope', attempt: 2, chosen_action_ids: ['x'] } }),
    ).rejects.toBeInstanceOf(NoCandidateError);
  });

  it('reports an unknown history id before an unknown active crisis', async () => {
    await expect(
      createCrisis({
        ...dry,
        history: [{ ...resolvedWater, crisis_id: 'nope' }],
        active: { crisis_id: 'nope', attempt: 2, chosen_action_ids: [] },
      }),
    ).rejects.toBeInstanceOf(InvalidRequestError);
  });

  it('does not echo the unknown id in the error message', async () => {
    const error = await createCrisis({
      ...dry,
      history: [{ ...resolvedWater, crisis_id: 'secret_marker' }],
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvalidRequestError);
    expect((error as Error).message).not.toContain('secret_marker');
  });

  it('checks against the evidence list in use, not the shipped one', async () => {
    const renamed: EvidenceList = structuredClone(evidence);
    const crisis = renamed.crises.find((c) => c.crisis_id === 'overwater_mold')!;
    crisis.actions = crisis.actions.filter((a) => a.action_id !== 'wait_and_observe');
    await expect(
      createCrisis(
        request({ root_moisture: 85 }, {
          history: [
            {
              crisis_id: 'overwater_mold',
              cultivation_day: 6,
              choices: [{ action_id: 'wait_and_observe', verdict: 'inappropriate' }],
              outcome: 'partial',
            },
          ],
        }),
        { evidence: renamed },
      ),
    ).rejects.toBeInstanceOf(InvalidRequestError);
  });

  it('builds no generation input from a request with an unknown id', async () => {
    const { generator, calls } = scripted(valid);
    await expect(
      createCrisis({ ...dry, history: [{ ...resolvedWater, crisis_id: 'nope' }] }, { generator }),
    ).rejects.toBeInstanceOf(InvalidRequestError);
    expect(calls).toHaveLength(0);
  });
});
