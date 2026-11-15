import type {
  ConditionalTimelineEvent,
  EventAction,
  EventCondition,
  EventFlag,
  EventList,
  Metric,
  ParallelTrackEntry,
  PlannedEvent,
  PlantState,
  RecordTimelineEvent,
  ScheduledTimelineEvent,
  TimelineEvent,
} from '@/lib/contract/types';
import { nextRandom, toRngState } from '@/lib/game/rng';
import { CULTIVATION_DAYS, METRICS, zoneOf } from '@/lib/game/rules';

/**
 * Event judgement: which events of the event list occur on a cultivation day.
 * Pure functions. Nothing here changes a mission; the engine will call these
 * when it starts to move through cultivation days (plan stage A3).
 *
 * Decisions behind the rules are in docs/TIMELINE-ENGINE-NOTES.md (T1-T12).
 */

/** An event that shows a card and waits for a response. */
export type CardEvent = ScheduledTimelineEvent | ConditionalTimelineEvent;

// --- Random numbers for events (notes, entry T1) -----------------------------

/** Mixed into the mission seed so event numbers never equal the crisis rolls. */
export const EVENT_SEED_SALT = 0x45564e54; // "EVNT"

/** 32-bit FNV-1a hash of an id. */
function hashId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Generator state for one event in one mission. It depends only on the
 * mission seed and the event id, so the crisis rolls (MissionState.rng_state)
 * are untouched, and adding or reordering events does not move other events.
 */
export function eventRngState(seed: number, eventId: string): number {
  return (toRngState(seed) ^ EVENT_SEED_SALT ^ hashId(eventId)) >>> 0;
}

// --- Mission plan for conditional events (notes, entry T2) -------------------

/**
 * Decide, from the seed alone, whether one conditional event is planned for
 * the mission and from which day. `probability` is the chance per mission,
 * not per day. The day is uniform over the event's window.
 */
export function planEvent(event: ConditionalTimelineEvent, seed: number): PlannedEvent {
  const first = nextRandom(eventRngState(seed, event.event_id));
  const second = nextRandom(first.state);
  const days = event.window.to - event.window.from + 1;
  return {
    event_id: event.event_id,
    planned: first.value < event.probability,
    earliest_day: event.window.from + Math.floor(second.value * days),
  };
}

/** The plan for every conditional event of the list, in list order. */
export function planEvents(list: EventList, seed: number): PlannedEvent[] {
  return list.events.filter(isConditional).map((event) => planEvent(event, seed));
}

// --- Conditions ---------------------------------------------------------------

/** True when every given part of the condition holds. An empty condition always holds. */
export function conditionHolds(condition: EventCondition, plant: PlantState): boolean {
  if (condition.fan !== undefined && condition.fan !== plant.fan) return false;
  if (condition.min_health !== undefined && plant.plant_health < condition.min_health) return false;
  for (const { metric, in: zones } of condition.zones ?? []) {
    if (!zones.includes(zoneOf(metric, plant[metric]))) return false;
  }
  if (condition.any_zones) {
    const any = condition.any_zones.some(({ metric, in: zones }) => zones.includes(zoneOf(metric, plant[metric])));
    if (!any) return false;
  }
  return true;
}

// --- Events of one day --------------------------------------------------------

/** What the judgement of one cultivation day reads. */
export interface DayContext {
  cultivation_day: number;
  plant: PlantState;
  /** From `planEvents`, made when the mission started. */
  plan: readonly PlannedEvent[];
  occurred_event_ids: readonly string[];
}

/** True for the kinds that show a card: scheduled and conditional events. */
export function isCardKind(event: TimelineEvent): event is CardEvent {
  return event.kind === 'scheduled' || event.kind === 'conditional';
}

function isConditional(event: TimelineEvent): event is ConditionalTimelineEvent {
  return event.kind === 'conditional';
}

/** True for a scheduled event that shows a card: it has actions and is not a link to a phase. */
function showsCard(event: ScheduledTimelineEvent): boolean {
  return event.maps_to_phase === undefined && event.actions.length > 0;
}

function inWindow(event: TimelineEvent, day: number): boolean {
  return day >= event.window.from && day <= event.window.to;
}

/**
 * Events that occur on the day, in list order. An event occurs at most once
 * per mission (notes, entry T3).
 * - scheduled: on its day, always.
 * - conditional: planned for this mission, the day is on or after its
 *   planned day and inside its window, and its condition holds.
 * Crisis events are not judged here: the crisis roll stays in the game engine.
 */
export function eventsDueOn(list: EventList, context: DayContext): CardEvent[] {
  const due: CardEvent[] = [];
  for (const event of list.events) {
    if (event.kind === 'crisis' || event.kind === 'record') continue;
    if (context.occurred_event_ids.includes(event.event_id)) continue;
    if (!inWindow(event, context.cultivation_day)) continue;
    if (event.kind === 'scheduled') {
      if (showsCard(event)) due.push(event);
      continue;
    }
    const planned = context.plan.find((p) => p.event_id === event.event_id);
    if (!planned || !planned.planned) continue;
    if (context.cultivation_day < planned.earliest_day) continue;
    if (conditionHolds(event.condition, context.plant)) due.push(event);
  }
  return due;
}

/**
 * The event to show now, or null. When several are due on one day they are
 * shown one after another: call again with the first added to
 * `occurred_event_ids` (notes, entry T4).
 */
export function nextEventOn(list: EventList, context: DayContext): CardEvent | null {
  return eventsDueOn(list, context)[0] ?? null;
}

// --- Record events (notes, entry T12) ----------------------------------------

/** What the judgement of record events on one day reads. */
export interface RecordDayContext {
  cultivation_day: number;
  /**
   * The state the plant is heading to: the morning of the next game day,
   * after the night's change. Known once the previous game day has ended.
   */
  heading: PlantState;
  /** Mission seed, for records with a `probability`. */
  seed: number;
}

/** True when a record with a `probability` is drawn for this mission. Always true without one. */
export function recordDrawn(event: RecordTimelineEvent, seed: number): boolean {
  if (event.probability === undefined) return true;
  return nextRandom(eventRngState(seed, event.event_id)).value < event.probability;
}

/**
 * Record events written on the day, in list order. A record occurs on its
 * day when it is drawn for the mission and its condition holds for the
 * heading state. Of the records that share a `group`, only the first is written.
 */
export function recordsOn(list: EventList, context: RecordDayContext): RecordTimelineEvent[] {
  const found: RecordTimelineEvent[] = [];
  const usedGroups = new Set<string>();
  for (const event of list.events) {
    if (event.kind !== 'record') continue;
    if (event.window.from !== context.cultivation_day) continue;
    if (event.group !== undefined && usedGroups.has(event.group)) continue;
    if (!recordDrawn(event, context.seed)) continue;
    if (event.condition && !conditionHolds(event.condition, context.heading)) continue;
    if (event.group !== undefined) usedGroups.add(event.group);
    found.push(event);
  }
  return found;
}

// --- Offered actions (notes, entry T11) ---------------------------------------

/** Least number of actions a card shows. */
export const CARD_OPTIONS_MIN = 2;

/**
 * True when the action would set the fan to the setting it already has, so
 * choosing it changes nothing. Such an option still carries a verdict, which
 * would confuse the player ("partial" for doing nothing).
 */
function isNoOpForState(action: EventAction, plant: PlantState): boolean {
  if (action.op === 'fan_high') return plant.fan === 'high';
  if (action.op === 'fan_low') return plant.fan === 'low';
  return false;
}

/**
 * Actions to offer on the event card, in list order: every action of the
 * event except those that change nothing in the current state. The result is
 * what the engine sends as `offered_action_ids` to POST /api/event.
 *
 * Nothing is removed when removing would leave fewer than CARD_OPTIONS_MIN
 * actions or no appropriate one, so a card can always be shown.
 */
export function offeredActionIds(event: CardEvent, plant: PlantState): string[] {
  const all = event.actions.map((action) => action.action_id);
  const kept = event.actions.filter((action) => !isNoOpForState(action, plant));
  const hasAppropriate = kept.some((action) => action.verdict === 'appropriate');
  if (kept.length < CARD_OPTIONS_MIN || !hasAppropriate) return all;
  return kept.map((action) => action.action_id);
}

// --- Flags (notes, entry T5) --------------------------------------------------

/** Combined effect of the flags that are set. */
export interface ActiveFlagEffects {
  /** Added to the overnight change of each metric. */
  night_drift: Record<Metric, number>;
  /** Watering adds nothing to root moisture. */
  blocks_watering: boolean;
}

/** Sum the effects of the given flags. A flag without an effect entry changes nothing. */
export function activeFlagEffects(list: EventList, flags: readonly EventFlag[]): ActiveFlagEffects {
  const result: ActiveFlagEffects = {
    night_drift: { root_moisture: 0, humidity: 0 },
    blocks_watering: false,
  };
  const set = new Set(flags);
  for (const event of list.events) {
    if (event.kind !== 'conditional' || !event.flag_effects) continue;
    for (const [flag, effect] of Object.entries(event.flag_effects)) {
      if (!set.has(flag)) continue;
      for (const metric of METRICS) result.night_drift[metric] += effect.night_drift?.[metric] ?? 0;
      if (effect.blocks_watering) result.blocks_watering = true;
    }
  }
  return result;
}

/** Flags after an event occurred: the event's flags are added once, order kept. */
export function flagsAfterOccur(flags: readonly EventFlag[], event: CardEvent): EventFlag[] {
  const next = [...flags];
  const added = event.kind === 'conditional' ? (event.on_occur?.set_flags ?? []) : [];
  for (const flag of added) if (!next.includes(flag)) next.push(flag);
  return next;
}

/** Flags after an action: the action's `clear_flags` are removed. */
export function flagsAfterAction(flags: readonly EventFlag[], action: EventAction): EventFlag[] {
  const cleared = new Set(action.effect.clear_flags ?? []);
  return flags.filter((flag) => !cleared.has(flag));
}

// --- Records from real experiments -------------------------------------------

export interface TrackEntryOnDay {
  experiment: string;
  /** `entry_id`, or "<experiment>#<index>" when the entry has none. */
  entry_key: string;
  entry: ParallelTrackEntry;
}

/** Key of a track entry for the log and the screen text. */
export function trackEntryKey(experiment: string, entry: ParallelTrackEntry, index: number): string {
  return entry.entry_id ?? `${experiment}#${index}`;
}

/** Track entries dated on the given cultivation day, in list order. Undated entries never match. */
export function trackEntriesOn(list: EventList, cultivationDay: number): TrackEntryOnDay[] {
  const found: TrackEntryOnDay[] = [];
  for (const track of list.parallel_tracks) {
    track.entries.forEach((entry, index) => {
      if (entry.day !== cultivationDay) return;
      found.push({
        experiment: track.experiment,
        entry_key: trackEntryKey(track.experiment, entry, index),
        entry,
      });
    });
  }
  return found;
}

// --- Lookups ------------------------------------------------------------------

export function findTimelineEvent(list: EventList, eventId: string): TimelineEvent | undefined {
  return list.events.find((event) => event.event_id === eventId);
}

export function findEventAction(event: CardEvent, actionId: string): EventAction | undefined {
  return event.actions.find((action) => action.action_id === actionId);
}

/** Game day (1-7) that falls on the cultivation day, or null between game days. */
export function gameDayOn(cultivationDay: number): number | null {
  const index = CULTIVATION_DAYS.indexOf(cultivationDay);
  return index === -1 ? null : index + 1;
}
