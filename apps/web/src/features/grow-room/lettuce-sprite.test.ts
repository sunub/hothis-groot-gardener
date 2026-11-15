import { describe, expect, it } from 'vitest';
import type { ActiveCrisis, MissionState } from '@/lib/contract/types';
import { createMission } from '@/lib/game/engine';
import { DEAD_SPRITE, spriteFor, symptomOf } from './lettuce-sprite';

const base = createMission({ mode: 'standard', seed: 1, mission_id: 'sprite-test' });

function crisis(partial: Partial<ActiveCrisis>): ActiveCrisis {
  return {
    candidates: [],
    crisis_id: null,
    attempt: 1,
    stage: 1,
    inappropriate_action_ids: [],
    response: null,
    ...partial,
  };
}

const at = (patch: Partial<MissionState>): MissionState => ({ ...base, ...patch });

describe('symptomOf', () => {
  // Only symptoms in the evidence list are drawn (ROLE-TASKS C4). Wilting and
  // brown edges are not in it; stunting, dry wicks and rot have no drawing yet.
  it('draws only evidence-backed symptoms: droplets at stage 1, mold from stage 2', () => {
    expect(symptomOf('water_shortage', 3)).toBe('ok');
    expect(symptomOf('overwater_mold', 1)).toBe('drop');
    expect(symptomOf('overwater_mold', 2)).toBe('mold');
    expect(symptomOf('overwater_mold', 3)).toBe('mold');
    expect(symptomOf(null, 1)).toBe('ok');
    expect(symptomOf('unknown_crisis', 2)).toBe('ok');
  });
});

describe('spriteFor', () => {
  it('follows the growth stage of the game day when there is no crisis', () => {
    expect([1, 2, 3, 5, 6, 7].map((game_day) => spriteFor(at({ game_day })))).toEqual([
      'S0_sprout',
      'S0_sprout',
      'G0_growing',
      'G0_growing',
      'P0_preharvest',
      'H0_harvest_ready',
    ]);
  });

  it('shows the crisis symptom, using the first candidate before the API answers', () => {
    expect(spriteFor(at({ game_day: 4, phase: 'crisis', active_crisis: crisis({ crisis_id: 'overwater_mold', stage: 2 }) }))).toBe(
      'G4_mold',
    );
    expect(spriteFor(at({ game_day: 4, phase: 'crisis_pending', active_crisis: crisis({ candidates: ['overwater_mold'] }) }))).toBe(
      'G2_droplets_curling',
    );
    expect(spriteFor(at({ game_day: 2, phase: 'crisis_pending', active_crisis: crisis({ candidates: ['water_shortage'] }) }))).toBe(
      'S0_sprout',
    );
  });

  it('never picks a drawing of a symptom outside the evidence list', () => {
    const crises = ['water_shortage', 'overwater_mold'];
    for (const game_day of [1, 2, 3, 4, 5, 6, 7]) {
      for (const crisis_id of crises) {
        for (const stage of [1, 2, 3]) {
          const sprite = spriteFor(at({ game_day, phase: 'crisis', active_crisis: crisis({ crisis_id, stage }) }));
          expect(sprite).not.toMatch(/wilting|brown_edges/);
        }
      }
    }
  });

  it('shows the dead plant after an early failure', () => {
    expect(spriteFor(at({ game_day: 4, phase: 'failed' }))).toBe(DEAD_SPRITE);
  });
});
