import type { GrowthStage, MissionState } from '@/lib/contract/types';
import { growthStageOf } from '@/lib/game/rules';

/**
 * Picks the lettuce sprite in public/sprites for the current mission.
 * Sprite table from the euna demo branch (frontend notes v1.2, "assets in hand").
 * Read-only: it never changes the mission.
 *
 * Only symptoms in the evidence list are drawn (ROLE-TASKS C4). The asset set also
 * has wilting (S1, G1, H1) and brown-edge (G3, H3) drawings; neither symptom is in
 * the evidence list, so they are not used. Stunting with dry wicks (water shortage)
 * and rot (overwatering stage 3) have no drawing yet: water shortage shows the
 * healthy plant and stage 3 keeps the mold drawing, and the crisis text says the rest.
 */

export type Symptom = 'ok' | 'drop' | 'mold';

const TABLE: Record<GrowthStage, Record<Symptom, string>> = {
  // Germination has no mold drawing; the droplet one stands in.
  germination: {
    ok: 'S0_sprout',
    drop: 'S2_sprout_droplets',
    mold: 'S2_sprout_droplets',
  },
  growth: {
    ok: 'G0_growing',
    drop: 'G2_droplets_curling',
    mold: 'G4_mold',
  },
  // No symptom drawings for pre-harvest yet; the harvest-size ones stand in.
  pre_harvest: {
    ok: 'P0_preharvest',
    drop: 'H2_droplets_curling',
    mold: 'H4_mold',
  },
  harvest: {
    ok: 'H0_harvest_ready',
    drop: 'H2_droplets_curling',
    mold: 'H4_mold',
  },
};

export const DEAD_SPRITE = 'D0_dead';

/** Visible symptom of a crisis. Unknown crises show no symptom. */
export function symptomOf(crisisId: string | null, stage: number): Symptom {
  if (crisisId === 'overwater_mold') return stage >= 2 ? 'mold' : 'drop';
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
