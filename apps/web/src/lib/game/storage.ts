import { plantStateSchema } from '@/lib/contract/schemas';
import type { MissionPhase, MissionState } from '@/lib/contract/types';
import { GAME_DAYS } from './rules';

/**
 * Save and load the mission in browser storage. The storage is passed in so
 * the functions work with localStorage, sessionStorage or a test double.
 */

/** The part of the Web Storage API the functions use. */
export type MissionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Storage key. The version suffix changes when the saved shape changes. */
export const MISSION_STORAGE_KEY = 'space-garden-simulator:mission:v1';

const PHASES: readonly MissionPhase[] = [
  'care',
  'crisis_pending',
  'crisis',
  'crisis_result',
  'night',
  'harvest',
  'freeze',
  'report',
  'failed',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Shape check of a saved mission. It checks the fields the screens and the
 * engine read first, so an old or damaged save is dropped instead of crashing.
 */
export function isMissionState(value: unknown): value is MissionState {
  if (!isRecord(value)) return false;
  if (value.schema_version !== 1) return false;
  if (typeof value.mission_id !== 'string' || value.mission_id === '') return false;
  if (value.mode !== 'standard' && value.mode !== 'demo') return false;
  if (!isCount(value.seed) || !isCount(value.rng_state)) return false;
  if (!PHASES.includes(value.phase as MissionPhase)) return false;
  const gameDay = value.game_day;
  if (!isCount(gameDay) || gameDay < 1 || gameDay > GAME_DAYS) return false;
  if (!plantStateSchema.safeParse(value.plant).success) return false;
  if (!isCount(value.care_ops_used)) return false;
  const dangerDays = value.danger_days;
  if (!isRecord(dangerDays) || !isCount(dangerDays.root_moisture) || !isCount(dangerDays.humidity)) {
    return false;
  }
  if (value.recurrence !== null && !isRecord(value.recurrence)) return false;
  if (value.active_crisis !== null && !isRecord(value.active_crisis)) return false;
  if (value.harvest !== null && !isRecord(value.harvest)) return false;
  // One record per game day, in order.
  const days = value.days;
  if (!Array.isArray(days) || days.length !== gameDay) return false;
  return days.every((day, i) => isRecord(day) && day.game_day === i + 1 && isRecord(day.start));
}

/** Save the mission. Returns false when the storage refused the write (full, blocked). */
export function saveMission(storage: MissionStorage, state: MissionState): boolean {
  try {
    storage.setItem(MISSION_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Saved mission, or null when there is none or it cannot be read. */
export function loadMission(storage: MissionStorage): MissionState | null {
  let raw: string | null;
  try {
    raw = storage.getItem(MISSION_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isMissionState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Delete the saved mission. */
export function clearMission(storage: MissionStorage): void {
  try {
    storage.removeItem(MISSION_STORAGE_KEY);
  } catch {
    // Blocked storage: nothing was saved there either.
  }
}
