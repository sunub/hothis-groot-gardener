import type {
  CareOp,
  CrisisAttemptRecord,
  CrisisOption,
  DayRecord,
  Metric,
  MissionState,
  PlantState,
  Zone,
} from '@/lib/contract/types';
import {
  METRIC_MAX,
  METRICS,
  NIGHT_DRIFT,
  NIGHT_HEALTH,
  clampMetric,
  isCaution,
  isDanger,
  zoneOf,
} from '@/lib/game/rules';

/** Pure read helpers for the grow room screens. They never change the mission. */

export function todayRecord(mission: MissionState): DayRecord | null {
  return mission.days.find((d) => d.game_day === mission.game_day) ?? null;
}

export function lastAttempt(day: DayRecord | null): CrisisAttemptRecord | null {
  const attempts = day?.crisis?.attempts;
  return attempts && attempts.length > 0 ? attempts[attempts.length - 1] : null;
}

export function chosenOption(
  mission: MissionState,
  attempt: CrisisAttemptRecord | null,
): CrisisOption | null {
  if (!attempt) return null;
  return mission.active_crisis?.response?.options.find((o) => o.action_id === attempt.action_id) ?? null;
}

export interface MetricForecast {
  metric: Metric;
  from: number;
  to: number;
  zone: Zone;
}

/** Tomorrow morning's metrics if the day ended now, from the night drift of the current fan. */
export function forecastNight(plant: PlantState): MetricForecast[] {
  const drift = NIGHT_DRIFT[plant.fan];
  return METRICS.map((metric) => {
    const to = clampMetric(plant[metric] + drift[metric]);
    return { metric, from: plant[metric], to, zone: zoneOf(metric, to) };
  });
}

export type HealthReason =
  | { kind: 'danger' | 'caution'; metric: Metric; change: number }
  | { kind: 'all_normal'; change: number };

/** Night health change broken down by metric, from the zones after the night drift. */
export function nightHealthReasons(zones: Record<Metric, Zone>): HealthReason[] {
  const reasons: HealthReason[] = [];
  for (const metric of METRICS) {
    const zone = zones[metric];
    if (isDanger(zone)) reasons.push({ kind: 'danger', metric, change: NIGHT_HEALTH.per_danger_metric });
    else if (isCaution(zone)) reasons.push({ kind: 'caution', metric, change: NIGHT_HEALTH.per_caution_metric });
  }
  return reasons.length > 0 ? reasons : [{ kind: 'all_normal', change: NIGHT_HEALTH.all_normal }];
}

/** True when the care operation would leave the plant state exactly as it is. */
export function isNoOpCare(plant: PlantState, op: CareOp): boolean {
  switch (op.kind) {
    case 'water':
      return plant.root_moisture >= METRIC_MAX;
    case 'fan':
      return plant.fan === op.level;
    case 'light':
      return plant.light.red === op.red && plant.light.blue === op.blue;
  }
}

/** Signed number with a real minus sign, for changes. */
export function signed(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return '0';
}
