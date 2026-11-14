/**
 * Shared type file: the single agreement between the screens, the game logic,
 * the crisis API and the data files.
 *
 * Naming rule: every shape that is serialized (API payloads, JSON data files,
 * saved mission records) uses snake_case keys, the same as the planning
 * document's formats. Functions and local variables use camelCase.
 *
 * Change this file first, then the modules that depend on it.
 */

// ---------------------------------------------------------------------------
// Plant and environment state
// ---------------------------------------------------------------------------

/** State items that have low/caution/normal/danger zones. */
export type Metric = 'root_moisture' | 'humidity';

export type FanLevel = 'low' | 'high';

export type LightLevel = 'low' | 'medium' | 'high';

/** Lighting is a daily-care-only control. It does not affect any rule. */
export interface LightSetting {
  red: LightLevel;
  blue: LightLevel;
}

export interface PlantState {
  /** 0-100. Game value. */
  plant_health: number;
  /** 0-100. */
  root_moisture: number;
  /** 0-100. */
  humidity: number;
  fan: FanLevel;
  light: LightSetting;
}

export type Zone =
  | 'danger_low'
  | 'caution_low'
  | 'normal'
  | 'caution_high'
  | 'danger_high';

export type ZoneSide = 'low' | 'high';

export type GrowthStage = 'germination' | 'growth' | 'pre_harvest' | 'harvest';

// ---------------------------------------------------------------------------
// Evidence list (src/data/evidence.json)
// ---------------------------------------------------------------------------

export type Verdict = 'appropriate' | 'partial' | 'inappropriate';

/** "measured": a value copied from a cited source. "game_value": set by the team for game balance. */
export type ValueType = 'measured' | 'game_value';

export interface SourceRef {
  title: string;
  url: string;
  /** Sentence copied verbatim from the source. */
  quote: string;
  license?: string;
  note?: string;
}

/**
 * How an action changes one metric.
 * - number: add this amount.
 * - "to_mid": if the metric is outside the normal zone, set it to the middle of the normal zone.
 * - "half_to_mid": if the metric is outside the normal zone, move it halfway to the middle.
 */
export type MetricOp = number | 'to_mid' | 'half_to_mid';

export interface ActionDelta {
  root_moisture?: MetricOp;
  humidity?: MetricOp;
  plant_health?: number;
  /** The action leaves the fan at this setting. */
  fan?: FanLevel;
}

export interface EvidenceAction {
  action_id: string;
  name: string;
  verdict: Verdict;
  /** Why this verdict. One sentence. */
  reason: string;
  delta: ActionDelta;
  /** Value type of `delta`. */
  value_type: ValueType;
  /** null only for distractor actions that have no recorded source. */
  source: SourceRef | null;
}

export interface EvidenceSymptom {
  symptom_id: string;
  name: string;
  /** Symptom stage at which this symptom can first be shown. Starts at 1. */
  stage: number;
  value_type: ValueType;
  source: SourceRef | null;
}

export interface TriggerCondition {
  metric: Metric;
  side: ZoneSide;
}

/** A crisis is a candidate when any `any_of` condition holds and, if set, the fan matches. */
export interface CrisisTrigger {
  any_of: TriggerCondition[];
  fan?: FanLevel;
}

export interface EvidenceCrisis {
  crisis_id: string;
  name: string;
  /** What was actually recorded. Shown on screen with the source. */
  summary: string;
  /** Crop and experiment of the record. `note` is shown when the record is not from lettuce. */
  record: {
    crop: string;
    experiment: string;
    note: string;
  };
  trigger: CrisisTrigger;
  symptoms: EvidenceSymptom[];
  actions: EvidenceAction[];
  source: SourceRef;
}

export interface HarvestStepEvidence {
  step_id: 'harvest_sanitize' | 'freeze_return' | 'ground_analysis';
  name: string;
  description: string;
  value_type: ValueType;
  source: SourceRef | null;
}

export interface HarvestEvidence {
  steps: HarvestStepEvidence[];
  /** Observed range used only for comparison. It is not a safety limit. */
  microbial_range: {
    min: number;
    max: number;
    unit: string;
    description: string;
    value_type: 'measured';
    source: SourceRef;
  };
  pathogen_screen: {
    organisms: string[];
    result: string;
    value_type: 'measured';
    source: SourceRef;
  };
  /** Statement that no microbial standard exists for fresh produce grown in space. */
  standards_note: {
    text: string;
    source: SourceRef;
  };
}

export interface BackgroundClaim {
  claim_id: string;
  claim: string;
  source: SourceRef;
}

export interface EvidenceList {
  meta: {
    schema_version: number;
    description: string;
    /** How AI tools were used to prepare this file. */
    ai_disclosure: string;
    updated: string;
  };
  crises: EvidenceCrisis[];
  harvest: HarvestEvidence;
  background: BackgroundClaim[];
}

// ---------------------------------------------------------------------------
// AI output format (planning document, "AI 출력 형식")
// The AI writes text and link ids only. Verdict, delta and source are attached by code.
// ---------------------------------------------------------------------------

export interface AiClue {
  symptom_id: string;
  text: string;
}

export interface AiOption {
  action_id: string;
  label: string;
  result_line: string;
  why: string;
}

export interface AiCrisisOutput {
  crisis_id: string;
  scene: string;
  plant_line: string;
  clues: AiClue[];
  options: AiOption[];
}

// ---------------------------------------------------------------------------
// Crisis API (POST /api/crisis)
// ---------------------------------------------------------------------------

export type Locale = 'en' | 'ko';

export type CrisisOutcome = 'resolved' | 'partial' | 'ground_support' | 'mission_failed';

export interface CrisisHistoryEntry {
  crisis_id: string;
  cultivation_day: number;
  choices: { action_id: string; verdict: Verdict }[];
  outcome: CrisisOutcome;
}

/** Set when the same crisis is shown again after an inappropriate choice. */
export interface ActiveCrisisContext {
  crisis_id: string;
  /** 1 for the first presentation, 2 after one inappropriate choice. */
  attempt: number;
  /** Inappropriate actions already chosen in this crisis. */
  chosen_action_ids: string[];
}

export interface CrisisRequest {
  locale: Locale;
  /** Cultivation day (1, 6, 12, 17, 22, 28, 33), not the game day. */
  cultivation_day: number;
  state: PlantState;
  /** Consecutive nights each metric has spent in a danger zone. */
  danger_days: Record<Metric, number>;
  history: CrisisHistoryEntry[];
  active: ActiveCrisisContext | null;
}

/** One option as the screen receives it: AI text plus the values attached from the evidence list. */
export interface CrisisOption extends AiOption {
  verdict: Verdict;
  reason: string;
  delta: ActionDelta;
  value_type: ValueType;
  source: SourceRef | null;
}

export interface CrisisResponse {
  crisis_id: string;
  name: string;
  stage: number;
  attempt: number;
  scene: string;
  plant_line: string;
  clues: AiClue[];
  /** The screen must hide verdict, reason, delta and source until the player chooses. */
  options: CrisisOption[];
  /** Crop note from the evidence list. Empty when the record is from lettuce. */
  record_note: string;
  crisis_source: SourceRef;
  /** "fallback": a pre-made crisis. "generated": written by the AI and validated. */
  origin: 'fallback' | 'generated';
}

export interface ApiError {
  error: {
    code: 'bad_request' | 'no_candidate' | 'internal';
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Mission record (saved in the browser)
// ---------------------------------------------------------------------------

export type MissionMode = 'standard' | 'demo';

export type MissionPhase =
  /** Daily care. Up to two care operations, then end the day. */
  | 'care'
  /** A crisis occurred. Waiting for the crisis API response. */
  | 'crisis_pending'
  /** Crisis shown. Waiting for the player's choice. */
  | 'crisis'
  /** Choice made. Verdict, result and source are shown. */
  | 'crisis_result'
  /** Overnight summary shown. */
  | 'night'
  /** Game day 7. Harvest and sanitize. */
  | 'harvest'
  /** Samples frozen for return. */
  | 'freeze'
  /** Ground analysis report. End of mission. */
  | 'report'
  /** Plant health reached 0. Cultivation record summary. End of mission. */
  | 'failed';

export type CareOp =
  | { kind: 'water'; level: 'normal' | 'heavy' }
  | { kind: 'fan'; level: FanLevel }
  | { kind: 'light'; red: LightLevel; blue: LightLevel };

export interface CrisisRollRecord {
  candidates: string[];
  probability: number;
  roll: number;
  occurred: boolean;
}

export interface CrisisAttemptRecord {
  attempt: number;
  stage: number;
  offered_action_ids: string[];
  action_id: string;
  label: string;
  verdict: Verdict;
  delta: ActionDelta;
  before: PlantState;
  after: PlantState;
  /** True when this choice triggered ground control support. */
  ground_support: boolean;
}

export interface CrisisRecord {
  crisis_id: string;
  name: string;
  start_stage: number;
  /** Highest symptom stage reached in this crisis. */
  max_stage: number;
  attempts: CrisisAttemptRecord[];
  /** null while the crisis is in progress. */
  outcome: CrisisOutcome | null;
}

export interface NightRecord {
  drift: Record<Metric, number>;
  zones: Record<Metric, Zone>;
  health_change: number;
  end: PlantState;
}

export interface DayRecord {
  game_day: number;
  cultivation_day: number;
  growth_stage: GrowthStage;
  start: PlantState;
  /** null on days without a crisis roll (game days 1 and 7). */
  roll: CrisisRollRecord | null;
  care: CareOp[];
  crisis: CrisisRecord | null;
  /** null until the day ends. Game day 7 has no night. */
  night: NightRecord | null;
}

export type HarvestGrade = 'excellent' | 'success' | 'fail';

export type MicrobialFactorKey =
  | 'baseline'
  | 'humidity_caution_days'
  | 'humidity_danger_days'
  | 'mold_partial_end'
  | 'mold_inappropriate'
  | 'mold_stage_3'
  | 'crisis_sanitize'
  | 'harvest_sanitize';

export interface MicrobialFactor {
  key: MicrobialFactorKey;
  /** How many times the condition occurred. */
  count: number;
  /** Total change in log10 CFU/g from this condition. */
  change: number;
}

export type RangeClass = 'below_range' | 'within_range' | 'above_range';

/** Game value. Calculated from the cultivation record, never measured. */
export interface MicrobialResult {
  value: number;
  factors: MicrobialFactor[];
  classification: RangeClass;
}

export interface HarvestRecord {
  sanitized: boolean;
  final_health: number;
  grade: HarvestGrade;
  microbial: MicrobialResult;
}

export interface ActiveCrisis {
  /** Crises whose trigger held when the crisis occurred. */
  candidates: string[];
  /** null until the first API response arrives. */
  crisis_id: string | null;
  attempt: number;
  stage: number;
  inappropriate_action_ids: string[];
  response: CrisisResponse | null;
}

export interface MissionState {
  schema_version: 1;
  mission_id: string;
  mode: MissionMode;
  seed: number;
  /** Internal state of the seeded random number generator. */
  rng_state: number;
  phase: MissionPhase;
  /** 1-7. */
  game_day: number;
  plant: PlantState;
  care_ops_used: number;
  danger_days: Record<Metric, number>;
  /** After a partial verdict: the same crisis is more likely on this game day. */
  recurrence: { crisis_id: string; game_day: number } | null;
  active_crisis: ActiveCrisis | null;
  /** Cultivation record. One entry per game day, in order. */
  days: DayRecord[];
  harvest: HarvestRecord | null;
}

export interface ReportMetrics {
  verdict_counts: Record<Verdict, number>;
  total_choices: number;
  /** Choices needed to end each crisis. */
  attempts_per_crisis: { crisis_id: string; name: string; game_day: number; attempts: number; outcome: CrisisOutcome | null }[];
  /** Nights with at least one metric in a danger zone. */
  danger_nights: number;
  danger_nights_by_metric: Record<Metric, number>;
}

// ---------------------------------------------------------------------------
// Cultivation timeline and events (src/data/events.json)
// Plan: docs/TIMELINE-EVENTS-PLAN.md. Decisions: docs/TIMELINE-ENGINE-NOTES.md.
// The engine does not use these shapes yet (stage S1/A1). MissionState is unchanged.
// ---------------------------------------------------------------------------

/** How the player answers an event: a care operation or a procedure (plan, section 4). */
export type ResponseOp =
  | 'water_normal'
  | 'water_heavy'
  | 'fan_high'
  | 'fan_low'
  | 'open_wicks'
  | 'thin_to_one'
  | 'replace_pillow'
  | 'check_fan_running'
  | 'keep_observing'
  | 'do_nothing';

/**
 * A lasting condition set by an event, such as "water_blocked". The ids are
 * defined by the event list, so this is a plain string.
 */
export type EventFlag = string;

/** First and last cultivation day (0-33, inclusive) on which an event can occur. */
export interface EventWindow {
  from: number;
  to: number;
}

/** State a conditional event needs. Every given part must hold. An empty condition always holds. */
export interface EventCondition {
  fan?: FanLevel;
  /** Plant health must be at least this. */
  min_health?: number;
  /** Each listed metric must be in one of the listed zones. */
  zones?: { metric: Metric; in: Zone[] }[];
}

/** What one event action changes. All numbers are game values. */
export interface EventEffect {
  /** Added to the metric. */
  root_moisture?: number;
  humidity?: number;
  plant_health?: number;
  /** The action leaves the fan at this setting. */
  fan?: FanLevel;
  /** Flags this action removes. */
  clear_flags?: EventFlag[];
}

export interface EventAction {
  action_id: string;
  op: ResponseOp;
  verdict: Verdict;
  effect: EventEffect;
  value_type: 'game_value';
}

/** What a flag does while it is set. */
export interface FlagEffect {
  /** Added to the overnight change of each metric. */
  night_drift?: Partial<Record<Metric, number>>;
  /** Watering adds nothing to root moisture. */
  blocks_watering?: boolean;
}

interface TimelineEventBase {
  event_id: string;
  window: EventWindow;
  /** What was actually recorded, in the words of the cited chunks. */
  summary: string;
  /** Chunk ids in data/json/total_RAG.json. */
  source_chunks: string[];
}

/** An existing crisis placed on the timeline. Trigger, actions and numbers stay in evidence.json. */
export interface CrisisTimelineEvent extends TimelineEventBase {
  kind: 'crisis';
  crisis_ref: string;
}

/** Occurs on `window.from`, always. */
export interface ScheduledTimelineEvent extends TimelineEventBase {
  kind: 'scheduled';
  actions: EventAction[];
  /** Set when the event only links an existing mission phase to chunks. Such an event shows no card. */
  maps_to_phase?: MissionPhase;
  /** Screen text. Moves to src/lib/i18n in S1, so it is optional here. */
  name?: string;
  scene_hint?: string;
}

/** May occur inside its window when its condition holds. */
export interface ConditionalTimelineEvent extends TimelineEventBase {
  kind: 'conditional';
  condition: EventCondition;
  /** Chance that the event is planned for a mission (notes, entry T2). */
  probability: number;
  actions: EventAction[];
  /** Flags set the moment the event occurs. */
  on_occur?: { set_flags: EventFlag[] };
  /** Effects of the flags this event sets, by flag id. */
  flag_effects?: Record<EventFlag, FlagEffect>;
  /** Crises that become more likely while the flags are set. For display and checks only. */
  chains_to?: string[];
  name?: string;
  scene_hint?: string;
}

export type TimelineEvent =
  | CrisisTimelineEvent
  | ScheduledTimelineEvent
  | ConditionalTimelineEvent;

/** One dated line from a real experiment, shown beside the player's run. Never changes a number. */
export interface ParallelTrackEntry {
  /** Stable id for the screen text. Optional until the data file carries it. */
  entry_id?: string;
  /** Cultivation day, or null when the source gives no day (then `when` says roughly when). */
  day: number | null;
  when?: string;
  /** Screen text. Moves to src/lib/i18n in S1, so it is optional here. */
  text?: string;
  source_chunk: string;
}

export interface ParallelTrack {
  experiment: string;
  entries: ParallelTrackEntry[];
}

export interface EventList {
  meta: { schema_version: 1 };
  events: TimelineEvent[];
  parallel_tracks: ParallelTrack[];
}

/**
 * Where one conditional event sits in one mission. Fixed from the mission
 * seed when the mission starts, so it does not depend on what the player does.
 */
export interface PlannedEvent {
  event_id: string;
  /** False: the event does not occur in this mission. */
  planned: boolean;
  /** Earliest cultivation day on which it can occur. Meaningful only when `planned`. */
  earliest_day: number;
}

/** An event that is shown and waits for the player's response. Time does not move while it is set. */
export interface PendingEvent {
  event_id: string;
  kind: 'scheduled' | 'conditional';
  cultivation_day: number;
  /** Actions offered, in the order shown. */
  offered_action_ids: string[];
}

/** Sign shown at the end of a log line. */
export type LogTone = 'positive' | 'negative' | 'mixed' | 'neutral';

/** An event occurred. Written when the event appears; `response` is filled when the player answers. */
export interface EventLogEntry {
  type: 'event';
  cultivation_day: number;
  event_id: string;
  kind: 'scheduled' | 'conditional';
  flags_set: EventFlag[];
  /** null while the event waits for a response. */
  response: {
    action_id: string;
    op: ResponseOp;
    verdict: Verdict;
    effect: EventEffect;
    before: PlantState;
    after: PlantState;
    flags_cleared: EventFlag[];
  } | null;
  tone: LogTone;
}

/** A line from a real experiment that falls on this cultivation day. */
export interface TrackLogEntry {
  type: 'track';
  cultivation_day: number;
  experiment: string;
  /** `entry_id` of the entry, or "<experiment>#<index>" when the entry has none. */
  entry_key: string;
  source_chunk: string;
  tone: 'neutral';
}

/** A game day was reached: the pause card, daily care and the crisis roll happen here. */
export interface MilestoneLogEntry {
  type: 'milestone';
  cultivation_day: number;
  game_day: number;
  tone: 'neutral';
}

export type TimelineLogEntry = EventLogEntry | TrackLogEntry | MilestoneLogEntry;

export type TimelineStatus =
  /** Cultivation days are passing between two game days. */
  | 'running'
  /** An event card is shown. Time is stopped until the player responds. */
  | 'event'
  /** A game day was reached. The existing day flow (MissionPhase) takes over. */
  | 'milestone';

/**
 * Timeline part of a mission. It will be stored next to the existing mission
 * fields when the engine starts to use it (A3/A4, saved shape version 2).
 */
export interface TimelineState {
  /** 0-33. Day 0 is before sowing. */
  cultivation_day: number;
  status: TimelineStatus;
  /** Flags set now, in the order they were set. */
  flags: EventFlag[];
  /** One entry per conditional event of the list. */
  event_plan: PlannedEvent[];
  /** Events that have occurred. An event occurs at most once per mission. */
  occurred_event_ids: string[];
  pending_event: PendingEvent | null;
  /** Oldest first. */
  log: TimelineLogEntry[];
}
