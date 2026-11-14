import { describe, expect, it } from 'vitest';
import type { CrisisRequest } from '@/lib/contract/types';
import { evidence, findCrisis } from '@/lib/evidence';
import { INITIAL_PLANT_STATE } from '@/lib/game/rules';
import { buildGenerationInput } from './generator';

const mold = findCrisis(evidence, 'overwater_mold')!;

const req: CrisisRequest = {
  locale: 'ko',
  cultivation_day: 17,
  state: { ...INITIAL_PLANT_STATE, root_moisture: 90, humidity: 75 },
  danger_days: { root_moisture: 1, humidity: 0 },
  history: [
    {
      crisis_id: 'water_shortage',
      cultivation_day: 6,
      choices: [{ action_id: 'add_water_direct', verdict: 'appropriate' }],
      outcome: 'resolved',
    },
  ],
  active: { crisis_id: 'overwater_mold', attempt: 2, chosen_action_ids: ['add_water'] },
};

describe('buildGenerationInput', () => {
  const input = buildGenerationInput(req, [{ crisis: mold, stage: 1 }]);

  it('carries locale, day, history, active context and limits', () => {
    expect(input.locale).toBe('ko');
    expect(input.cultivation_day).toBe(17);
    expect(input.history).toEqual(req.history);
    expect(input.active).toEqual(req.active);
    expect(input.limits).toEqual({ clues_max: 3, options_min: 3, options_max: 4 });
  });

  it('gives each metric its zone', () => {
    expect(input.state.root_moisture).toEqual({ value: 90, zone: 'danger_high' });
    expect(input.state.humidity).toEqual({ value: 75, zone: 'caution_high' });
  });

  it('lists only the symptoms up to the stage and drops excluded actions', () => {
    const [candidate] = input.candidates;
    expect(candidate).toMatchObject({
      crisis_id: 'overwater_mold',
      name: mold.name,
      summary: mold.summary,
      record_note: mold.record.note,
      stage: 1,
      clues_min: 2,
    });
    expect(candidate.symptoms.map((s) => s.symptom_id)).toEqual(['excess_moisture', 'leaf_droplets']);
    expect(candidate.actions.map((a) => a.action_id)).not.toContain('add_water');
    expect(candidate.actions[0]).toEqual({
      action_id: mold.actions[0].action_id,
      name: mold.actions[0].name,
      verdict: mold.actions[0].verdict,
      reason: mold.actions[0].reason,
    });
    expect(input.excluded_action_ids).toEqual(['add_water']);
  });

  it('does not share objects with the request', () => {
    input.active!.chosen_action_ids.push('x');
    expect(req.active!.chosen_action_ids).toEqual(['add_water']);
  });
});
