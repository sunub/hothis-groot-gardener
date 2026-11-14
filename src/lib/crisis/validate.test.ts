import { describe, expect, it } from 'vitest';
import type { AiCrisisOutput } from '@/lib/contract/types';
import { evidence, findCrisis } from '@/lib/evidence';
import { validateAiOutput, type ValidationContext } from './validate';

const mold = findCrisis(evidence, 'overwater_mold')!;
const water = findCrisis(evidence, 'water_shortage')!;

function context(stage: number, excludedActionIds: string[] = []): ValidationContext {
  return { candidates: [{ crisis: mold, stage }], excludedActionIds };
}

/**
 * The planning document's example output ("AI 출력 형식"), text translated.
 * Its symptom ids and remove_dead_tissue are no longer in the evidence list, so
 * they are mapped to the current ids; the test idea is the same: one clue uses
 * a stage-2 symptom (fungal_growth).
 */
function planningExample(): AiCrisisOutput {
  return {
    crisis_id: 'overwater_mold',
    scene: 'Moisture beads on the grow room walls, and the air feels heavier than usual.',
    plant_line: 'Drops keep forming on my leaves. Everything around me feels damp.',
    clues: [
      { symptom_id: 'leaf_droplets', text: 'Droplets stay on the leaf surfaces' },
      { symptom_id: 'excess_moisture', text: 'The plants look damp all over' },
      { symptom_id: 'fungal_growth', text: 'A fuzzy growth has appeared on a stem' },
    ],
    options: [
      {
        action_id: 'fan_high',
        label: 'Turn the fan up to high',
        result_line: 'I can breathe a little. My leaves are starting to dry.',
        why: 'Moving air carries the moisture away from the leaves.',
      },
      {
        action_id: 'clean_plant_surfaces',
        label: 'Wipe down the plant surfaces',
        result_line: 'I feel cleaner, but the air is still stuffy.',
        why: 'Cleaning removes what is on the plants, but the moisture stays.',
      },
      {
        action_id: 'add_water',
        label: 'Give more water',
        result_line: 'My roots feel even more smothered.',
        why: 'Adding water when there is already too much floods the roots.',
      },
    ],
  };
}

/** A stage-1 output that passes every rule. Each test breaks one rule. */
function stageOne(): AiCrisisOutput {
  const out = planningExample();
  out.clues = out.clues.slice(0, 2);
  return out;
}

function issuesOf(output: unknown, ctx: ValidationContext): string[] {
  const result = validateAiOutput(output, ctx);
  return result.ok ? [] : result.issues;
}

describe('validateAiOutput', () => {
  it('accepts the planning document example at stage 2', () => {
    const result = validateAiOutput(planningExample(), context(2));
    expect(result.ok).toBe(true);
  });

  it('rejects the planning document example at stage 1 (fungal_growth is a stage 2 symptom)', () => {
    const issues = issuesOf(planningExample(), context(1));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('fungal_growth');
  });

  it('accepts a valid stage 1 output', () => {
    expect(validateAiOutput(stageOne(), context(1)).ok).toBe(true);
  });

  it('rejects a wrong shape', () => {
    const out = { ...stageOne(), verdict: 'appropriate' };
    expect(issuesOf(out, context(1))[0]).toMatch(/^shape:/);
    expect(issuesOf('not an object', context(1))[0]).toMatch(/^shape:/);
  });

  it('rejects a crisis that is not a candidate', () => {
    const out = { ...stageOne(), crisis_id: 'water_shortage' };
    expect(issuesOf(out, context(1))).toEqual(['crisis_id "water_shortage" is not a candidate.']);
  });

  it('rejects a symptom that belongs to another crisis', () => {
    const out = stageOne();
    out.clues[1].symptom_id = 'poor_growth';
    expect(issuesOf(out, context(1))).toEqual([
      'symptom_id "poor_growth" is not a symptom of overwater_mold.',
    ]);
  });

  it('rejects a symptom above the current stage', () => {
    const out = stageOne();
    out.clues[1].symptom_id = 'rot';
    const issues = issuesOf(out, context(2));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('stage 3 symptom');
  });

  it('rejects the same symptom used twice', () => {
    const out = stageOne();
    out.clues[1].symptom_id = 'leaf_droplets';
    expect(issuesOf(out, context(1))).toEqual(['symptom_id "leaf_droplets" is used in more than one clue.']);
  });

  it('requires 2 clues when 2 symptoms are available (implementation notes, entry 17)', () => {
    const out = stageOne();
    out.clues = out.clues.slice(0, 1);
    expect(issuesOf(out, context(1))).toEqual(['Expected 2-3 clues, got 1.']);
  });

  it('allows 1 clue when only 1 symptom is available (implementation notes, entry 17)', () => {
    // The shipped list has 2 symptoms at every stage now, so use a one-symptom copy.
    const oneSymptom = structuredClone(water);
    oneSymptom.symptoms = oneSymptom.symptoms.filter((s) => s.symptom_id === 'poor_growth');
    const out: AiCrisisOutput = {
      crisis_id: 'water_shortage',
      scene: 'The plants look small.',
      plant_line: 'I am not growing.',
      clues: [{ symptom_id: 'poor_growth', text: 'Small plants' }],
      options: ['add_water_direct', 'refill_reservoir', 'wait_for_schedule'].map((id) => ({
        action_id: id,
        label: 'Label',
        result_line: 'Line',
        why: 'Why',
      })),
    };
    expect(
      validateAiOutput(out, { candidates: [{ crisis: oneSymptom, stage: 1 }], excludedActionIds: [] })
        .ok,
    ).toBe(true);
  });

  it('rejects more than 3 clues (shape limit)', () => {
    const out = planningExample();
    out.clues.push({ symptom_id: 'rot', text: 'Soft stems' });
    expect(issuesOf(out, context(3))[0]).toMatch(/^shape: clues/);
  });

  it('rejects an action that belongs to another crisis', () => {
    const out = stageOne();
    out.options[2].action_id = 'add_water_direct';
    expect(issuesOf(out, context(1))).toEqual([
      'action_id "add_water_direct" is not an action of overwater_mold.',
    ]);
  });

  it('rejects the same action used twice', () => {
    const out = stageOne();
    out.options[2].action_id = 'clean_plant_surfaces';
    expect(issuesOf(out, context(1))).toEqual([
      'action_id "clean_plant_surfaces" is used in more than one option.',
    ]);
  });

  it('rejects output with no appropriate option', () => {
    const out = stageOne();
    out.options[0].action_id = 'wait_and_observe';
    expect(issuesOf(out, context(1))).toEqual(['No option is an appropriate action.']);
  });

  it('rejects fewer than 3 options', () => {
    const out = stageOne();
    out.options = out.options.slice(0, 2);
    expect(issuesOf(out, context(1))[0]).toMatch(/^shape: options/);
  });

  it('rejects more than 4 options', () => {
    const out = stageOne();
    out.options.push({ ...out.options[0], action_id: 'wait_and_observe' });
    out.options.push({ ...out.options[0], action_id: 'x' });
    expect(issuesOf(out, context(1))[0]).toMatch(/^shape: options/);
  });

  it('accepts 4 options', () => {
    const out = stageOne();
    out.options.push({ ...out.options[0], action_id: 'wait_and_observe' });
    expect(validateAiOutput(out, context(1)).ok).toBe(true);
  });

  it('rejects an excluded action', () => {
    const out = stageOne();
    expect(issuesOf(out, context(1, ['add_water']))).toEqual([
      'action_id "add_water" was already chosen and must not be offered again.',
    ]);
  });
});
