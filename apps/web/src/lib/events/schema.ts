import { z } from 'zod';
import {
  fanLevelSchema,
  metricSchema,
  sourceRefSchema,
  verdictSchema,
} from '@/lib/contract/schemas';
import type { EventList, MissionPhase, ResponseOp, Zone } from '@/lib/contract/types';

/**
 * Runtime schema of the event list (data/content/events.json). The shapes are in
 * src/lib/contract/types.ts; this file is the format the data file must keep.
 *
 * Unknown keys are allowed on events and tracks, so the data file can carry
 * working notes (`draft`, `open_questions`, `note`). The parts the engine
 * reads (condition, effect, flag effects) are strict: a misspelled key there
 * would silently change a rule.
 */

const text = z.string().trim().min(1);
const id = z.string().regex(/^[a-z0-9_]+$/);

/** First and last cultivation day of the timeline. */
export const TIMELINE_FIRST_DAY = 0;
export const TIMELINE_LAST_DAY = 33;

const day = z.number().int().min(TIMELINE_FIRST_DAY).max(TIMELINE_LAST_DAY);

export const RESPONSE_OPS = [
  'water_normal',
  'water_heavy',
  'fan_high',
  'fan_low',
  'open_wicks',
  'thin_to_one',
  'replace_pillow',
  'check_fan_running',
  'keep_observing',
  'do_nothing',
] as const satisfies readonly ResponseOp[];

export const responseOpSchema = z.enum(RESPONSE_OPS);

const ZONES = [
  'danger_low',
  'caution_low',
  'normal',
  'caution_high',
  'danger_high',
] as const satisfies readonly Zone[];

const PHASES = [
  'care',
  'crisis_pending',
  'crisis',
  'crisis_result',
  'night',
  'harvest',
  'freeze',
  'report',
  'failed',
] as const satisfies readonly MissionPhase[];

export const eventWindowSchema = z
  .strictObject({ from: day, to: day })
  .refine((w) => w.from <= w.to, { message: 'window.from must not be after window.to' });

const zoneTestSchema = z.strictObject({ metric: metricSchema, in: z.array(z.enum(ZONES)).min(1) });

export const eventConditionSchema = z.strictObject({
  fan: fanLevelSchema.optional(),
  min_health: z.number().min(0).max(100).optional(),
  zones: z.array(zoneTestSchema).optional(),
  any_zones: z.array(zoneTestSchema).min(1).optional(),
});

export const LOG_TONES = ['positive', 'negative', 'mixed', 'neutral'] as const;

export const eventEffectSchema = z.strictObject({
  root_moisture: z.number().optional(),
  humidity: z.number().optional(),
  plant_health: z.number().optional(),
  fan: fanLevelSchema.optional(),
  clear_flags: z.array(id).optional(),
});

export const eventActionSchema = z.object({
  action_id: id,
  op: responseOpSchema,
  verdict: verdictSchema,
  effect: eventEffectSchema,
  value_type: z.literal('game_value'),
});

export const flagEffectSchema = z.strictObject({
  night_drift: z
    .strictObject({ root_moisture: z.number().optional(), humidity: z.number().optional() })
    .optional(),
  blocks_watering: z.boolean().optional(),
});

const base = {
  event_id: id,
  window: eventWindowSchema,
  summary: text,
  source_chunks: z.array(text).min(1),
};

export const timelineEventSchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('crisis'), crisis_ref: id }),
  z.object({
    ...base,
    kind: z.literal('scheduled'),
    actions: z.array(eventActionSchema),
    maps_to_phase: z.enum(PHASES).optional(),
    name: text.optional(),
    scene_hint: text.optional(),
  }),
  z.object({
    ...base,
    kind: z.literal('conditional'),
    condition: eventConditionSchema,
    probability: z.number().gt(0).max(1),
    actions: z.array(eventActionSchema).min(2),
    on_occur: z.object({ set_flags: z.array(id) }).optional(),
    flag_effects: z.record(id, flagEffectSchema).optional(),
    chains_to: z.array(id).optional(),
    name: text.optional(),
    scene_hint: text.optional(),
  }),
  z.object({
    ...base,
    kind: z.literal('record'),
    tone: z.enum(LOG_TONES),
    condition: eventConditionSchema.optional(),
    probability: z.number().gt(0).max(1).optional(),
    group: id.optional(),
    foreshadows: z.array(id).optional(),
    text: text.optional(),
  }),
]);

export const parallelTrackSchema = z.object({
  experiment: text,
  entries: z
    .array(
      z.object({
        entry_id: id.optional(),
        day: day.nullable(),
        when: text.optional(),
        text: text.optional(),
        source_chunk: text,
        source_check: z.enum(['checked', 'not_checked']),
        verified_source: sourceRefSchema.optional(),
      }),
    )
    .min(1),
});

export const eventListSchema = z.object({
  meta: z.object({ schema_version: z.literal(1) }),
  events: z.array(timelineEventSchema),
  parallel_tracks: z.array(parallelTrackSchema),
}) satisfies z.ZodType<EventList>;
