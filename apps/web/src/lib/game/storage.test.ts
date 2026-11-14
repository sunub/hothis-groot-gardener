import { describe, expect, it } from 'vitest';
import { evidence } from '@/lib/evidence';
import { applyCare, createMission, endDay, nextDay } from './engine';
import {
  clearMission,
  loadMission,
  MISSION_STORAGE_KEY,
  saveMission,
  type MissionStorage,
} from './storage';

function memoryStorage(): MissionStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const throwing: MissionStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

function played() {
  const m = createMission({ mission_id: 'saved', mode: 'standard', seed: 5 });
  return nextDay(endDay(applyCare(m, { kind: 'water', level: 'normal' })), evidence);
}

describe('mission storage', () => {
  it('saves and loads the same mission', () => {
    const storage = memoryStorage();
    const mission = played();
    expect(saveMission(storage, mission)).toBe(true);
    expect(storage.data.has(MISSION_STORAGE_KEY)).toBe(true);
    expect(loadMission(storage)).toEqual(mission);
  });

  it('returns null when nothing is saved', () => {
    expect(loadMission(memoryStorage())).toBeNull();
  });

  it('returns null for damaged data', () => {
    const storage = memoryStorage();
    storage.setItem(MISSION_STORAGE_KEY, '{not json');
    expect(loadMission(storage)).toBeNull();
    storage.setItem(MISSION_STORAGE_KEY, 'null');
    expect(loadMission(storage)).toBeNull();
    storage.setItem(MISSION_STORAGE_KEY, JSON.stringify({ ...played(), phase: 'unknown' }));
    expect(loadMission(storage)).toBeNull();
    storage.setItem(MISSION_STORAGE_KEY, JSON.stringify({ ...played(), days: [] }));
    expect(loadMission(storage)).toBeNull();
    storage.setItem(
      MISSION_STORAGE_KEY,
      JSON.stringify({ ...played(), plant: { plant_health: 'high' } }),
    );
    expect(loadMission(storage)).toBeNull();
  });

  it('returns null for an old schema version', () => {
    const storage = memoryStorage();
    storage.setItem(MISSION_STORAGE_KEY, JSON.stringify({ ...played(), schema_version: 0 }));
    expect(loadMission(storage)).toBeNull();
  });

  it('survives storage that throws', () => {
    expect(loadMission(throwing)).toBeNull();
    expect(saveMission(throwing, played())).toBe(false);
    expect(() => clearMission(throwing)).not.toThrow();
  });

  it('clears the saved mission', () => {
    const storage = memoryStorage();
    saveMission(storage, played());
    clearMission(storage);
    expect(loadMission(storage)).toBeNull();
  });
});
