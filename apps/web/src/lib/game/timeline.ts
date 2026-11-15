import type {
  EventEffect,
  EventList,
  EventLogEntry,
  LogTone,
  Metric,
  PendingEvent,
  PlantState,
  TimelineLogEntry,
  TimelineState,
  Verdict,
} from '@/lib/contract/types';
import {
  activeFlagEffects,
  flagsAfterOccur,
  gameDayOn,
  nextEventOn,
  offeredActionIds,
  planEvents,
  recordsOn,
  trackEntriesOn,
  type CardEvent,
} from '@/lib/events';
import { clampHealth, clampMetric, METRICS } from './rules';

/**
 * The cultivation timeline of a mission (plan stage A3, ROLE-TASKS A1).
 * Pure functions on TimelineState. The game engine (engine.ts) decides when
 * they run; nothing here changes the game-day flow by itself.
 *
 * A mission has a timeline only when it was started with the timeline switch
 * on (timeline-flag.ts). Without one, the engine runs exactly as before.
 * Decisions: docs/TIMELINE-ENGINE-NOTES.md, entries T12 and T13.
 */

/** Sign of a log line for the verdict of an event response. */
export const TONE_OF_VERDICT: Record<Verdict, LogTone> = {
  appropriate: 'positive',
  partial: 'mixed',
  inappropriate: 'negative',
};

/** What happens on one cultivation day before any card is shown: the log lines. */
function linesOfDay(
  events: EventList,
  day: number,
  plant: PlantState,
  seed: number,
): TimelineLogEntry[] {
  const lines: TimelineLogEntry[] = [];
  const gameDay = gameDayOn(day);
  if (gameDay !== null) lines.push({ type: 'milestone', cultivation_day: day, game_day: gameDay, tone: 'neutral' });
  // Between two game days the plant already holds the next morning's state, so it is the heading state (T12).
  for (const record of recordsOn(events, { cultivation_day: day, heading: plant, seed })) {
    lines.push({ type: 'record', cultivation_day: day, event_id: record.event_id, tone: record.tone });
  }
  for (const found of trackEntriesOn(events, day)) {
    lines.push({
      type: 'track',
      cultivation_day: day,
      experiment: found.experiment,
      entry_key: found.entry_key,
      source_chunk: found.entry.source_chunk,
      tone: 'neutral',
    });
  }
  return lines;
}

/** Move to `day` and write its log lines. The caller then looks for cards. */
export function enterDay(
  timeline: TimelineState,
  events: EventList,
  day: number,
  plant: PlantState,
  seed: number,
): TimelineState {
  return {
    ...timeline,
    cultivation_day: day,
    status: 'running',
    log: [...timeline.log, ...linesOfDay(events, day, plant, seed)],
  };
}

/** The next card due today, or null. */
export function dueCard(timeline: TimelineState, events: EventList, plant: PlantState): CardEvent | null {
  return nextEventOn(events, {
    cultivation_day: timeline.cultivation_day,
    plant,
    plan: timeline.event_plan,
    occurred_event_ids: timeline.occurred_event_ids,
  });
}

/** Show a card: time stops until the player responds. Its flags are set the moment it occurs. */
export function openEvent(timeline: TimelineState, event: CardEvent, plant: PlantState): TimelineState {
  const flags = flagsAfterOccur(timeline.flags, event);
  const pending: PendingEvent = {
    event_id: event.event_id,
    kind: event.kind,
    cultivation_day: timeline.cultivation_day,
    offered_action_ids: offeredActionIds(event, plant),
  };
  const entry: EventLogEntry = {
    type: 'event',
    cultivation_day: timeline.cultivation_day,
    event_id: event.event_id,
    kind: event.kind,
    flags_set: flags.filter((f) => !timeline.flags.includes(f)),
    response: null,
    tone: 'neutral',
  };
  return {
    ...timeline,
    status: 'event',
    flags,
    occurred_event_ids: [...timeline.occurred_event_ids, event.event_id],
    pending_event: pending,
    log: [...timeline.log, entry],
  };
}

/**
 * The timeline of a new mission: day 0 (records dated before sowing), then
 * day 1 with its lines, and the first card of day 1 if one is due.
 */
export function initialTimeline(events: EventList, plant: PlantState, seed: number): TimelineState {
  const empty: TimelineState = {
    cultivation_day: 0,
    status: 'running',
    flags: [],
    event_plan: planEvents(events, seed),
    occurred_event_ids: [],
    pending_event: null,
    log: [],
  };
  const day1 = enterDay(enterDay(empty, events, 0, plant, seed), events, 1, plant, seed);
  const card = dueCard(day1, events, plant);
  return card ? openEvent(day1, card, plant) : { ...day1, status: 'milestone' };
}

/** A plant after an event action. Numbers are added and clamped; the fan is set. */
export function applyEventEffect(plant: PlantState, effect: EventEffect): PlantState {
  const next: PlantState = { ...plant, light: { ...plant.light } };
  for (const metric of METRICS) {
    const change = effect[metric];
    if (change !== undefined) next[metric] = clampMetric(next[metric] + change);
  }
  if (effect.plant_health !== undefined) next.plant_health = clampHealth(next.plant_health + effect.plant_health);
  if (effect.fan !== undefined) next.fan = effect.fan;
  return next;
}

/** Extra overnight change from the flags that are set. All zero without a timeline. */
export function flagNightDrift(timeline: TimelineState | undefined, events: EventList): Record<Metric, number> {
  if (!timeline) return { root_moisture: 0, humidity: 0 };
  return activeFlagEffects(events, timeline.flags).night_drift;
}

/** True when a set flag makes watering add nothing to root moisture. False without a timeline. */
export function wateringBlocked(timeline: TimelineState | undefined, events: EventList): boolean {
  if (!timeline) return false;
  return activeFlagEffects(events, timeline.flags).blocks_watering;
}
