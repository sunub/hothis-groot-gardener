import { describe, expect, it } from 'vitest';
import type { AiCrisisOutput, CrisisRequest, PlantState } from '@/lib/contract/types';
import { INITIAL_PLANT_STATE } from '@/lib/game/rules';
import { getFallbackCrisis } from './fallback';
import type { CrisisGenerator, GenerationInput } from './generator';
import { createCrisis, NoCandidateError } from './pipeline';

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
