import type { GrowthStage, MissionState } from '@/lib/contract/types';
import { growthStageOf } from '@/lib/game/rules';

/**
 * Picks the lettuce sprite in public/sprites for the current mission.
 * Sprite table from the euna demo branch (frontend notes v1.2, "assets in hand").
 * Read-only: it never changes the mission.
 */

export type Symptom = 'ok' | 'wilt' | 'drop' | 'brown' | 'mold';

const TABLE: Record<GrowthStage, Record<Symptom, string>> = {
  // Germination has only wilting and droplet drawings.
  germination: {
    ok: 'S0_sprout',
    wilt: 'S1_sprout_wilting',
    drop: 'S2_sprout_droplets',
    brown: 'S2_sprout_droplets',
    mold: 'S2_sprout_droplets',
  },
  growth: {
    ok: 'G0_growing',
    wilt: 'G1_wilting',
    drop: 'G2_droplets_curling',
    brown: 'G3_brown_edges',
    mold: 'G4_mold',
  },
  // No symptom drawings for pre-harvest yet; the harvest-size ones stand in.
  pre_harvest: {
    ok: 'P0_preharvest',
    wilt: 'H1_wilting',
    drop: 'H2_droplets_curling',
    brown: 'H3_brown_edges',
    mold: 'H4_mold',
  },
  harvest: {
    ok: 'H0_harvest_ready',
    wilt: 'H1_wilting',
    drop: 'H2_droplets_curling',
    brown: 'H3_brown_edges',
    mold: 'H4_mold',
  },
};

export const DEAD_SPRITE = 'D0_dead';

/** Visible symptom of a crisis. Unknown crises show no symptom. */
export function symptomOf(crisisId: string | null, stage: number): Symptom {
  if (crisisId === 'water_shortage') return 'wilt';
  if (crisisId === 'overwater_mold') return stage >= 3 ? 'mold' : stage === 2 ? 'brown' : 'drop';
  return 'ok';
}

export function spriteFor(mission: MissionState): string {
  if (mission.phase === 'failed') return DEAD_SPRITE;
  const crisis = mission.active_crisis;
  // Before the API answers, crisis_id is null; the first candidate is the crisis that occurred.
  const crisisId = crisis ? (crisis.crisis_id ?? crisis.candidates[0] ?? null) : null;
  return TABLE[growthStageOf(mission.game_day)][symptomOf(crisisId, crisis?.stage ?? 1)];
}

export function spriteUrl(sprite: string): string {
  return `/sprites/${sprite}.png`;
}
