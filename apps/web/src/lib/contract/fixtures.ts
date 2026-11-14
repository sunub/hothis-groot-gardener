import type {
  EventLogEntry,
  MilestoneLogEntry,
  PlannedEvent,
  PlantState,
  TimelineState,
  TrackLogEntry,
} from './types';

/**
 * Example timeline states for building screens before the engine produces
 * real ones (plan, work package S1). One fixture per screen state.
 *
 * Every id here exists in data/content/events.json, and every state is one the
 * judgement rules allow; src/lib/contract/fixtures.test.ts checks both.
 * The numbers are examples, not results of a played mission.
 *
 * Not in these shapes on purpose: whether an event card is folded away
 * ("대응을 기다리는 중" band) and whether pause cards are muted. Both are
 * screen settings. Time is stopped whenever `pending_event` is set, folded or not.
 */

export interface TimelineFixture {
  id: string;
  /** What the screen shows in this state. */
  title: string;
  plant: PlantState;
  timeline: TimelineState;
}

const LIGHT = { red: 'medium', blue: 'medium' } as const;

function plant(health: number, rootMoisture: number, humidity: number, fan: 'low' | 'high' = 'low'): PlantState {
  return { plant_health: health, root_moisture: rootMoisture, humidity, fan, light: { ...LIGHT } };
}

/** A plan in which the fan fault is planned from day 9 and the other two are not. */
const PLAN: PlannedEvent[] = [
  { event_id: 'pillow_no_flow', planned: false, earliest_day: 1 },
  { event_id: 'fan_off_after_restart', planned: true, earliest_day: 9 },
  { event_id: 'mild_tip_burn', planned: false, earliest_day: 14 },
];

function milestone(cultivationDay: number, gameDay: number): MilestoneLogEntry {
  return { type: 'milestone', cultivation_day: cultivationDay, game_day: gameDay, tone: 'neutral' };
}

function track(cultivationDay: number, experiment: string, index: number, chunk: string): TrackLogEntry {
  return {
    type: 'track',
    cultivation_day: cultivationDay,
    experiment,
    entry_key: `${experiment}#${index}`,
    source_chunk: chunk,
    tone: 'neutral',
  };
}

const DAY_1 = milestone(1, 1);
const VEG03J_DAY_3 = track(3, 'VEG-03J', 0, 'VEG-03J-05');

const WICKS_PENDING: EventLogEntry = {
  type: 'event',
  cultivation_day: 3,
  event_id: 'wick_opening',
  kind: 'scheduled',
  flags_set: [],
  response: null,
  tone: 'neutral',
};

const WICKS_DONE: EventLogEntry = {
  ...WICKS_PENDING,
  response: {
    action_id: 'open_wicks',
    op: 'open_wicks',
    verdict: 'appropriate',
    effect: { plant_health: 0 },
    before: plant(73, 45, 60),
    after: plant(73, 45, 60),
    flags_cleared: [],
  },
  tone: 'positive',
};

const DAY_6 = milestone(6, 2);

const THINNING_DONE: EventLogEntry = {
  type: 'event',
  cultivation_day: 7,
  event_id: 'thinning',
  kind: 'scheduled',
  flags_set: [],
  response: {
    action_id: 'keep_both',
    op: 'do_nothing',
    verdict: 'partial',
    effect: { plant_health: -3 },
    before: plant(76, 45, 65),
    after: plant(73, 45, 65),
    flags_cleared: [],
  },
  tone: 'mixed',
};

const VEG01A_DAY_7 = track(7, 'VEG-01A', 1, 'veg01-early-a');
const VEG03J_DAY_7 = track(7, 'VEG-03J', 1, 'VEG-03J-06');

const FAN_FAULT_PENDING: EventLogEntry = {
  type: 'event',
  cultivation_day: 9,
  event_id: 'fan_off_after_restart',
  kind: 'conditional',
  flags_set: ['fan_actually_off'],
  response: null,
  tone: 'neutral',
};

/** The player kept observing: inappropriate, and the flag stays set. */
const FAN_FAULT_IGNORED: EventLogEntry = {
  ...FAN_FAULT_PENDING,
  response: {
    action_id: 'keep_observing',
    op: 'keep_observing',
    verdict: 'inappropriate',
    effect: { plant_health: -5 },
    before: plant(73, 45, 65),
    after: plant(68, 45, 65),
    flags_cleared: [],
  },
  tone: 'negative',
};

const DAY_12 = milestone(12, 3);

/** Time is passing between game days 1 and 2. Nothing waits for the player. */
export const FIXTURE_RUNNING: TimelineFixture = {
  id: 'running',
  title: 'Time is passing (day 4), no event',
  plant: plant(73, 45, 60),
  timeline: {
    cultivation_day: 4,
    status: 'running',
    flags: [],
    event_plan: PLAN,
    occurred_event_ids: ['wick_opening'],
    pending_event: null,
    log: [DAY_1, VEG03J_DAY_3, WICKS_DONE],
  },
};

/** A scheduled event card: opening the wicks on day 3. */
export const FIXTURE_SCHEDULED_EVENT: TimelineFixture = {
  id: 'scheduled_event',
  title: 'Scheduled event card (day 3, open the wicks)',
  plant: plant(73, 45, 60),
  timeline: {
    cultivation_day: 3,
    status: 'event',
    flags: [],
    event_plan: PLAN,
    occurred_event_ids: ['wick_opening'],
    pending_event: {
      event_id: 'wick_opening',
      kind: 'scheduled',
      cultivation_day: 3,
      offered_action_ids: ['open_wicks', 'water_heavy_instead', 'do_nothing'],
    },
    log: [DAY_1, VEG03J_DAY_3, WICKS_PENDING],
  },
};

/** A conditional event card: the fan reads low but is off. Its flag is already set. */
export const FIXTURE_CONDITIONAL_EVENT: TimelineFixture = {
  id: 'conditional_event',
  title: 'Conditional event card (day 9, fan fault), flag set',
  plant: plant(73, 45, 65),
  timeline: {
    cultivation_day: 9,
    status: 'event',
    flags: ['fan_actually_off'],
    event_plan: PLAN,
    occurred_event_ids: ['wick_opening', 'thinning', 'fan_off_after_restart'],
    pending_event: {
      event_id: 'fan_off_after_restart',
      kind: 'conditional',
      cultivation_day: 9,
      offered_action_ids: ['check_fan_running', 'fan_high', 'keep_observing'],
    },
    log: [
      DAY_1,
      VEG03J_DAY_3,
      WICKS_DONE,
      DAY_6,
      VEG01A_DAY_7,
      VEG03J_DAY_7,
      THINNING_DONE,
      FAN_FAULT_PENDING,
    ],
  },
};

/** After an inappropriate response: time passes again and the flag is still set. */
export const FIXTURE_FLAG_ACTIVE: TimelineFixture = {
  id: 'flag_active',
  title: 'Time is passing (day 10) with the fan-fault flag still set',
  plant: plant(68, 45, 65),
  timeline: {
    cultivation_day: 10,
    status: 'running',
    flags: ['fan_actually_off'],
    event_plan: PLAN,
    occurred_event_ids: ['wick_opening', 'thinning', 'fan_off_after_restart'],
    pending_event: null,
    log: [
      DAY_1,
      VEG03J_DAY_3,
      WICKS_DONE,
      DAY_6,
      VEG01A_DAY_7,
      VEG03J_DAY_7,
      THINNING_DONE,
      FAN_FAULT_IGNORED,
    ],
  },
};

/**
 * A game day was reached (day 12, game day 3): the pause card. The log shows
 * every entry type and every tone, newest last.
 */
export const FIXTURE_MILESTONE: TimelineFixture = {
  id: 'milestone',
  title: 'Pause card at a game day (day 12), full log',
  plant: plant(62, 35, 75),
  timeline: {
    cultivation_day: 12,
    status: 'milestone',
    flags: ['fan_actually_off'],
    event_plan: PLAN,
    occurred_event_ids: ['wick_opening', 'thinning', 'fan_off_after_restart'],
    pending_event: null,
    log: [
      DAY_1,
      VEG03J_DAY_3,
      WICKS_DONE,
      DAY_6,
      VEG01A_DAY_7,
      VEG03J_DAY_7,
      THINNING_DONE,
      FAN_FAULT_IGNORED,
      DAY_12,
    ],
  },
};

/** Day 0, before sowing: the empty state. */
export const FIXTURE_START: TimelineFixture = {
  id: 'start',
  title: 'Before sowing (day 0), empty log',
  plant: plant(70, 55, 55),
  timeline: {
    cultivation_day: 0,
    status: 'running',
    flags: [],
    event_plan: PLAN,
    occurred_event_ids: [],
    pending_event: null,
    log: [],
  },
};

export const TIMELINE_FIXTURES: readonly TimelineFixture[] = [
  FIXTURE_START,
  FIXTURE_SCHEDULED_EVENT,
  FIXTURE_RUNNING,
  FIXTURE_CONDITIONAL_EVENT,
  FIXTURE_FLAG_ACTIVE,
  FIXTURE_MILESTONE,
];
