import { crisisResponseSchema, eventCardResponseSchema, type EventCardResponse } from '@/lib/contract/schemas';
import type { Locale, MissionState } from '@/lib/contract/types';
import { evidence } from '@/lib/evidence';
import {
  advanceDay,
  applyCare,
  buildCrisisRequest,
  chooseOption,
  confirmFreeze,
  continueAfterResult,
  createMission,
  endDay,
  GameRuleError,
  harvestCrop,
  receiveCrisis,
  respondToEvent,
} from '@/lib/game/engine';
import {
  clearMission,
  loadMission,
  MISSION_STORAGE_KEY,
  saveMission,
  type MissionStorage,
} from '@/lib/game/storage';
import { TIMELINE_ENABLED } from '@/lib/game/timeline-flag';
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
  /**
   * Text of the event card that is shown (POST /api/event), or null. Kept in
   * memory only: after a reload the card is asked for again. Verdicts and
   * effects are applied from the event list, not from this response.
   */
  eventCard: EventCardResponse | null;
  /** Status of the event card request while a card waits for its text. */
  eventStatus: CrisisFetchStatus;
}

/** Crisis API route (POST, JSON CrisisRequest body). */
export const CRISIS_ENDPOINT = '/api/crisis';
/** Event card API route (POST, JSON EventCardRequest body). */
export const EVENT_ENDPOINT = '/api/event';

const SERVER_SNAPSHOT: MissionSnapshot = Object.freeze({
  ready: false,
  mission: null,
  crisisStatus: 'idle',
  eventCard: null,
  eventStatus: 'idle',
});

/** A fresh snapshot for a mission. The event card is dropped; it is asked for again when needed. */
function snapshotOf(mission: MissionState | null): MissionSnapshot {
  return { ready: true, mission, crisisStatus: 'idle', eventCard: null, eventStatus: 'idle' };
}

let snapshot: MissionSnapshot = SERVER_SNAPSHOT;
let loaded = false;
const listeners = new Set<() => void>();

let locale: Locale = 'en';
/** Key of the last crisis request sent; the same key is never sent twice on its own. */
let requestedKey: string | null = null;
let inFlight: AbortController | null = null;
/** Same for the event card request. */
let requestedEventKey: string | null = null;
let eventInFlight: AbortController | null = null;

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
  snapshot = snapshotOf(storage ? loadMission(storage) : null);
  // Another tab changed the saved mission: follow it, so that an older screen
  // in this tab cannot overwrite newer progress.
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== MISSION_STORAGE_KEY) return;
    const current = browserStorage();
    cancelRequest();
    markScreenChange(snapshot.mission, current ? loadMission(current) : null);
    setSnapshot(snapshotOf(current ? loadMission(current) : null));
  });
}

/**
 * A second click of a double click lands on whatever the next screen puts
 * under the pointer. Actions are ignored for this long after the screen changes.
 */
const CLICK_GUARD_MS = 600;
let screenChangedAt = 0;

/** The screen a mission state shows: one per phase, day and crisis presentation. */
function screenKeyOf(mission: MissionState | null): string {
  if (!mission) return 'none';
  const base = `${mission.mission_id}:${mission.game_day}:${mission.phase}:${mission.active_crisis?.attempt ?? 0}`;
  // Missions without a timeline keep the key they always had.
  if (!mission.timeline) return base;
  return `${base}:${mission.timeline.cultivation_day}:${mission.timeline.pending_event?.event_id ?? ''}`;
}

function markScreenChange(before: MissionState | null, after: MissionState | null): void {
  if (screenKeyOf(before) !== screenKeyOf(after)) screenChangedAt = Date.now();
}

function isGuarded(name: string): boolean {
  if (Date.now() - screenChangedAt >= CLICK_GUARD_MS) return false;
  console.warn(`${name}: ignored, the screen has just changed`);
  return true;
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
  markScreenChange(snapshot.mission, mission);
  persist(mission);
  // Keep the card text while the same card is still shown; drop it otherwise.
  const keepCard = eventKeyOf(mission) !== null && eventKeyOf(mission) === eventKeyOf(snapshot.mission);
  setSnapshot({ ...snapshotOf(mission), eventCard: keepCard ? snapshot.eventCard : null });
  requestCrisisIfDue();
  requestEventCardIfDue();
}

function cancelRequest(): void {
  inFlight?.abort();
  inFlight = null;
  requestedKey = null;
  eventInFlight?.abort();
  eventInFlight = null;
  requestedEventKey = null;
}

// --- Event card API (missions with a timeline) ----------------------------------

/** Identifies one shown event card; null when no card waits. */
function eventKeyOf(mission: MissionState | null): string | null {
  const pending = mission?.timeline?.pending_event;
  if (!mission || !pending) return null;
  return `${mission.mission_id}:${pending.cultivation_day}:${pending.event_id}:${pending.offered_action_ids.join(',')}`;
}

function requestEventCardIfDue(): void {
  const mission = snapshot.mission;
  const key = eventKeyOf(mission);
  if (!mission || !key || key === requestedEventKey || snapshot.eventCard) return;
  void sendEventCardRequest(mission, key);
}

async function sendEventCardRequest(mission: MissionState, key: string): Promise<void> {
  const pending = mission.timeline?.pending_event;
  if (!pending) return;
  eventInFlight?.abort();
  const controller = new AbortController();
  eventInFlight = controller;
  requestedEventKey = key;
  setSnapshot({ ...snapshot, eventStatus: 'loading' });

  const isCurrent = () => eventInFlight === controller && eventKeyOf(snapshot.mission) === key;
  try {
    const response = await fetch(EVENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale,
        cultivation_day: pending.cultivation_day,
        state: mission.plant,
        event_id: pending.event_id,
        offered_action_ids: pending.offered_action_ids,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Event API answered ${response.status}`);
    const card = eventCardResponseSchema.parse(await response.json());
    // The card must be for the event that waits, with exactly the offered actions.
    const ids = card.options.map((o) => o.action_id);
    if (card.event_id !== pending.event_id || ids.join(',') !== pending.offered_action_ids.join(',')) {
      throw new Error('Event API answered for another card');
    }
    if (!isCurrent()) return;
    setSnapshot({ ...snapshot, eventCard: card, eventStatus: 'idle' });
  } catch (error) {
    if (controller.signal.aborted || !isCurrent()) return;
    console.warn('Event card request failed', error);
    setSnapshot({ ...snapshot, eventStatus: 'error' });
  } finally {
    if (eventInFlight === controller) eventInFlight = null;
  }
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
  requestEventCardIfDue();
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
  if (isGuarded(name)) return;
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
    if (isGuarded('start')) return;
    cancelRequest();
    commit(
      createMission({ mission_id: crypto.randomUUID(), mode, seed: randomSeed(), timeline: TIMELINE_ENABLED }),
    );
  },
  applyCare(op) {
    act('applyCare', (m) => applyCare(m, op));
  },
  endDay() {
    act('endDay', endDay);
  },
  nextDay() {
    // Without a timeline this is the plain next day; with one it walks the days in between.
    act('nextDay', (m) => advanceDay(m, evidence));
  },
  respondToEvent(actionId) {
    act('respondToEvent', (m) => respondToEvent(m, actionId));
  },
  retryEvent() {
    ensureLoaded();
    if (eventInFlight) return;
    requestedEventKey = null;
    requestEventCardIfDue();
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
