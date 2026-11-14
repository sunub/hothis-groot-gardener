import { describe, expect, it } from 'vitest';
import type { AiCrisisOutput, EvidenceCrisis } from '@/lib/contract/types';
import { evidence, findCrisis } from '@/lib/evidence';
import { attachEvidence } from './attach';

const mold = findCrisis(evidence, 'overwater_mold')!;

function output(): AiCrisisOutput {
  return {
    crisis_id: 'overwater_mold',
    scene: 'Scene.',
    plant_line: 'Line.',
    clues: [{ symptom_id: 'leaf_droplets', text: 'Drops' }],
    options: ['add_water', 'fan_high', 'clean_plant_surfaces'].map((id) => ({
      action_id: id,
      label: `label ${id}`,
      result_line: `result ${id}`,
      why: `why ${id}`,
    })),
  };
}

describe('attachEvidence', () => {
  it('takes verdict, reason, delta, value type and source from the evidence list', () => {
    const response = attachEvidence(output(), mold, { stage: 2, attempt: 1, origin: 'generated' });
    for (const option of response.options) {
      const action = mold.actions.find((a) => a.action_id === option.action_id)!;
      expect(option).toEqual({
        action_id: action.action_id,
        label: `label ${action.action_id}`,
        result_line: `result ${action.action_id}`,
        why: `why ${action.action_id}`,
        verdict: action.verdict,
        reason: action.reason,
        delta: action.delta,
        value_type: action.value_type,
        source: action.source,
      });
    }
    expect(response.options.map((o) => o.verdict)).toEqual(['inappropriate', 'appropriate', 'partial']);
  });

  it('uses evidence values even when they differ from anything in the output', () => {
    const custom: EvidenceCrisis = structuredClone(mold);
    custom.actions[0].delta = { plant_health: 99 };
    custom.actions[0].source = { title: 'T', url: 'https://example.org', quote: 'Q' };
    const response = attachEvidence(output(), custom, { stage: 1, attempt: 1, origin: 'fallback' });
    const fan = response.options.find((o) => o.action_id === 'fan_high')!;
    expect(fan.delta).toEqual({ plant_health: 99 });
    expect(fan.source).toEqual({ title: 'T', url: 'https://example.org', quote: 'Q' });
  });

  it('fills name, record note, crisis source, stage, attempt and origin', () => {
    const response = attachEvidence(output(), mold, { stage: 3, attempt: 2, origin: 'fallback' });
    expect(response).toMatchObject({
      crisis_id: 'overwater_mold',
      name: mold.name,
      record_note: mold.record.note,
      crisis_source: mold.source,
      stage: 3,
      attempt: 2,
      origin: 'fallback',
      scene: 'Scene.',
      plant_line: 'Line.',
    });
  });

  it('does not share objects with the evidence list', () => {
    const fan = mold.actions.find((a) => a.action_id === 'fan_high')!;
    const before = structuredClone(fan.delta);
    const response = attachEvidence(output(), mold, { stage: 1, attempt: 1, origin: 'fallback' });
    response.options[1].delta.plant_health = -100;
    expect(fan.delta).toEqual(before);
  });

  it('throws on an action that is not in the crisis', () => {
    const out = output();
    out.options[0].action_id = 'add_water_direct';
    expect(() => attachEvidence(out, mold, { stage: 1, attempt: 1, origin: 'fallback' })).toThrow();
  });
});
