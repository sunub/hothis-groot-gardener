import type { GrowthStage, Metric, PlantState, Zone } from '@/lib/contract/types';
import { CULTIVATION_DAYS, GROWTH_STAGES, METRICS, zoneOf } from '@/lib/game/rules';

/**
 * The plant on one cultivation day, as the screen shows it while time passes.
 * The engine is to hand these over for the days up to the next game day
 * (ROLE-TASKS A2, D1: "show day by day"); the screen only reads them.
 */
export interface TimelineFrame {
  cultivation_day: number;
  plant: PlantState;
}

/** Growth stage on a cultivation day: the stage of the last game day on or before it. */
export function growthStageOnDay(cultivationDay: number): GrowthStage {
  let stage: GrowthStage = GROWTH_STAGES[0];
  CULTIVATION_DAYS.forEach((day, i) => {
    if (day <= cultivationDay) stage = GROWTH_STAGES[i];
  });
  return stage;
}

export interface ZoneChange {
  metric: Metric;
  from: Zone;
  to: Zone;
}

/** Metrics whose zone differs between two days, in the order of METRICS. */
export function zoneChanges(before: PlantState, after: PlantState): ZoneChange[] {
  return METRICS.flatMap((metric) => {
    const from = zoneOf(metric, before[metric]);
    const to = zoneOf(metric, after[metric]);
    return from === to ? [] : [{ metric, from, to }];
  });
}

/** The frame of a day, or the closest earlier one when the day has none. */
export function frameOn(frames: readonly TimelineFrame[], cultivationDay: number): TimelineFrame | null {
  let found: TimelineFrame | null = null;
  for (const frame of frames) {
    if (frame.cultivation_day <= cultivationDay && (!found || frame.cultivation_day >= found.cultivation_day)) found = frame;
  }
  return found;
}
