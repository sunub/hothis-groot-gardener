import { crisisResponseSchema } from '@/lib/contract/schemas';
import type { Locale, MissionState } from '@/lib/contract/types';
import { evidence } from '@/lib/evidence';
import {
  applyCare,
  buildCrisisRequest,
  chooseOption,
  confirmFreeze,
  continueAfterResult,
  createMission,
  endDay,
  GameRuleError,
  harvestCrop,
  nextDay,
  receiveCrisis,
} from '@/lib/game/engine';
import { clearMission, loadMission, saveMission, type MissionStorage } from '@/lib/game/storage';
import type { CrisisFetchStatus, MissionActions } from './use-mission';

/**
 * The one mission store of the app, shaped for React's useSyncExternalStore.
 * It owns the mission state, saves it to localStorage after every change, and
 * sends the crisis API request whenever the mission waits for a crisis.
 */

/** What the screens read. A new object only when something changed. */
export interface MissionSnapshot {
  ready: boolean;
  mission: MissionState | null;
  crisisStatus: CrisisFetchStatus;
}

/** Crisis API route (POST, JSON CrisisRequest body). */
export const CRISIS_ENDPOINT = '/api/crisis';

const SERVER_SNAPSHOT: MissionSnapshot = Object.freeze({
  ready: false,
  mission: null,
  crisisStatus: 'idle',
});

let snapshot: MissionSnapshot = SERVER_SNAPSHOT;
let loaded = false;
const listeners = new Set<() => void>();

let locale: Locale = 'en';
/** Key of the last crisis request sent; the same key is never sent twice on its own. */
let requestedKey: string | null = null;
let inFlight: AbortController | null = null;

function browserStorage(): MissionStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Some browsers throw on access when site data is blocked.
    return null;
  }
}

function ensureLoaded(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  const storage = browserStorage();
  snapshot = { ready: true, mission: storage ? loadMission(storage) : null, crisisStatus: 'idle' };
}

function emit(): void {
  for (const listener of listeners) listener();
}

function setSnapshot(next: MissionSnapshot): void {
  snapshot = next;
  emit();
}

function persist(mission: MissionState | null): void {
  const storage = browserStorage();
  if (!storage) return;
  if (mission) saveMission(storage, mission);
  else clearMission(storage);
}

/** Identifies one presentation of one crisis; null when no request is due. */
function requestKeyOf(mission: MissionState | null): string | null {
  if (!mission || mission.phase !== 'crisis_pending' || !mission.active_crisis) return null;
  return `${mission.mission_id}:${mission.game_day}:${mission.active_crisis.attempt}`;
}

function commit(mission: MissionState | null): void {
  persist(mission);
  setSnapshot({ ready: true, mission, crisisStatus: 'idle' });
  requestCrisisIfDue();
}

function cancelRequest(): void {
  inFlight?.abort();
  inFlight = null;
  requestedKey = null;
}

// --- Crisis API ----------------------------------------------------------------

function requestCrisisIfDue(): void {
  const mission = snapshot.mission;
  const key = requestKeyOf(mission);
  if (!mission || !key || key === requestedKey) return;
  void sendCrisisRequest(mission, key);
}

async function sendCrisisRequest(mission: MissionState, key: string): Promise<void> {
  inFlight?.abort();
  const controller = new AbortController();
  inFlight = controller;
  requestedKey = key;
  setSnapshot({ ...snapshot, crisisStatus: 'loading' });

  // Only the latest request for the mission that is still waiting may apply its result.
  const isCurrent = () => inFlight === controller && requestKeyOf(snapshot.mission) === key;
  try {
    const response = await fetch(CRISIS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCrisisRequest(mission, locale)),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Crisis API answered ${response.status}`);
    const body: unknown = await response.json();
    // Shape check here; the game logic then checks the ids against the evidence list.
    const crisis = crisisResponseSchema.parse(body);
    if (!isCurrent() || !snapshot.mission) return;
    commit(receiveCrisis(snapshot.mission, crisis, evidence));
  } catch (error) {
    if (controller.signal.aborted || !isCurrent()) return;
    console.warn('Crisis request failed', error);
    setSnapshot({ ...snapshot, crisisStatus: 'error' });
  } finally {
    if (inFlight === controller) inFlight = null;
  }
}

/**
 * Send the crisis request if the mission waits for one and it was not sent
 * yet. Safe to call many times (re-renders, strict-mode double effects).
 */
export function ensureCrisisRequest(nextLocale: Locale): void {
  locale = nextLocale;
  ensureLoaded();
  requestCrisisIfDue();
}

// --- useSyncExternalStore ------------------------------------------------------

/** Register a change listener. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current snapshot. Reads the saved mission on first client use. */
export function getSnapshot(): MissionSnapshot {
  ensureLoaded();
  return snapshot;
}

/** Snapshot on the server and during hydration: not ready. */
export function getServerSnapshot(): MissionSnapshot {
  return SERVER_SNAPSHOT;
}

// --- Actions -------------------------------------------------------------------

function act(name: string, transition: (mission: MissionState) => MissionState): void {
  ensureLoaded();
  const mission = snapshot.mission;
  if (!mission) {
    console.warn(`${name}: there is no mission`);
    return;
  }
  try {
    commit(transition(mission));
  } catch (error) {
    // A rule violation (double click, stale screen) keeps the state as it was.
    if (error instanceof GameRuleError) {
      console.warn(`${name}: ${error.message}`);
      return;
    }
    throw error;
  }
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

const actions: MissionActions = {
  start(mode) {
    ensureLoaded();
    cancelRequest();
    commit(createMission({ mission_id: crypto.randomUUID(), mode, seed: randomSeed() }));
  },
  applyCare(op) {
    act('applyCare', (m) => applyCare(m, op));
  },
  endDay() {
    act('endDay', endDay);
  },
  nextDay() {
    act('nextDay', (m) => nextDay(m, evidence));
  },
  chooseOption(actionId) {
    act('chooseOption', (m) => chooseOption(m, actionId, evidence));
  },
  continueAfterResult() {
    act('continueAfterResult', (m) => continueAfterResult(m, evidence));
  },
  harvestCrop(sanitize) {
    act('harvestCrop', (m) => harvestCrop(m, { sanitize }));
  },
  confirmFreeze() {
    act('confirmFreeze', confirmFreeze);
  },
  retryCrisis() {
    ensureLoaded();
    if (inFlight) return;
    requestedKey = null;
    requestCrisisIfDue();
  },
  reset() {
    ensureLoaded();
    cancelRequest();
    commit(null);
  },
};

/** Stable action object: the same functions on every render. */
export const missionActions: Readonly<MissionActions> = Object.freeze(actions);
