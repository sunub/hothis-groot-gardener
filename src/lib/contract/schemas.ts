import { z } from 'zod';
import type {
  ActionDelta,
  AiCrisisOutput,
  CrisisRequest,
  CrisisResponse,
  EvidenceList,
  PlantState,
  SourceRef,
} from './types';

/**
 * Runtime schemas for the shapes in types.ts that cross a trust boundary:
 * AI output, API requests and responses, and the evidence list file.
 * Each schema is checked against its type with `satisfies`.
 */

const text = z.string().trim().min(1);

export const fanLevelSchema = z.enum(['low', 'high']);
export const lightLevelSchema = z.enum(['low', 'medium', 'high']);
export const metricSchema = z.enum(['root_moisture', 'humidity']);
export const verdictSchema = z.enum(['appropriate', 'partial', 'inappropriate']);
export const valueTypeSchema = z.enum(['measured', 'game_value']);
export const localeSchema = z.enum(['en', 'ko']);
export const crisisOutcomeSchema = z.enum([
  'resolved',
  'partial',
  'ground_support',
  'mission_failed',
]);

export const plantStateSchema = z.strictObject({
  plant_health: z.number().min(0).max(100),
  root_moisture: z.number().min(0).max(100),
  humidity: z.number().min(0).max(100),
  fan: fanLevelSchema,
  light: z.strictObject({ red: lightLevelSchema, blue: lightLevelSchema }),
}) satisfies z.ZodType<PlantState>;

// --- AI output format --------------------------------------------------------

export const AI_CLUES_MAX = 3;
export const AI_OPTIONS_MIN = 3;
export const AI_OPTIONS_MAX = 4;

/**
 * Shape check only. Whether the ids exist in the evidence list is checked by
 * validateAiOutput in src/lib/crisis/validate.ts.
 */
export const aiCrisisOutputSchema = z.strictObject({
  crisis_id: text,
  scene: text,
  plant_line: text,
  clues: z
    .array(z.strictObject({ symptom_id: text, text }))
    .min(1)
    .max(AI_CLUES_MAX),
  options: z
    .array(
      z.strictObject({
        action_id: text,
        label: text,
        result_line: text,
        why: text,
      }),
    )
    .min(AI_OPTIONS_MIN)
    .max(AI_OPTIONS_MAX),
}) satisfies z.ZodType<AiCrisisOutput>;

// --- Crisis API request ------------------------------------------------------

export const crisisRequestSchema = z.strictObject({
  locale: localeSchema,
  cultivation_day: z.number().int().min(1).max(33),
  state: plantStateSchema,
  danger_days: z.strictObject({
    root_moisture: z.number().int().min(0),
    humidity: z.number().int().min(0),
  }),
  history: z.array(
    z.strictObject({
      crisis_id: text,
      cultivation_day: z.number().int().min(1).max(33),
      choices: z.array(z.strictObject({ action_id: text, verdict: verdictSchema })),
      outcome: crisisOutcomeSchema,
    }),
  ),
  active: z
    .strictObject({
      crisis_id: text,
      attempt: z.number().int().min(1),
      chosen_action_ids: z.array(text),
    })
    .nullable(),
}) satisfies z.ZodType<CrisisRequest>;

// --- Shared pieces of the evidence list ---------------------------------------

export const sourceRefSchema = z.strictObject({
  title: text,
  url: z.url(),
  quote: text,
  license: text.optional(),
  note: text.optional(),
}) satisfies z.ZodType<SourceRef>;

const metricOpSchema = z.union([z.number(), z.literal('to_mid'), z.literal('half_to_mid')]);

export const actionDeltaSchema = z.strictObject({
  root_moisture: metricOpSchema.optional(),
  humidity: metricOpSchema.optional(),
  plant_health: z.number().optional(),
  fan: fanLevelSchema.optional(),
}) satisfies z.ZodType<ActionDelta>;

// --- Crisis API response -----------------------------------------------------

/** The screen checks the API response with this before the game logic uses it. */
export const crisisResponseSchema = z.strictObject({
  crisis_id: text,
  name: text,
  stage: z.number().int().min(1),
  attempt: z.number().int().min(1),
  scene: text,
  plant_line: text,
  clues: z
    .array(z.strictObject({ symptom_id: text, text }))
    .min(1)
    .max(AI_CLUES_MAX),
  options: z
    .array(
      z.strictObject({
        action_id: text,
        label: text,
        result_line: text,
        why: text,
        verdict: verdictSchema,
        reason: text,
        delta: actionDeltaSchema,
        value_type: valueTypeSchema,
        source: sourceRefSchema.nullable(),
      }),
    )
    .min(AI_OPTIONS_MIN)
    .max(AI_OPTIONS_MAX),
  record_note: z.string(),
  crisis_source: sourceRefSchema,
  origin: z.enum(['fallback', 'generated']),
}) satisfies z.ZodType<CrisisResponse>;

// --- Evidence list file ------------------------------------------------------

const harvestStepIdSchema = z.enum(['harvest_sanitize', 'freeze_return', 'ground_analysis']);

export const evidenceListSchema = z.strictObject({
  meta: z.strictObject({
    schema_version: z.number().int(),
    description: text,
    ai_disclosure: text,
    updated: text,
  }),
  crises: z
    .array(
      z.strictObject({
        crisis_id: text,
        name: text,
        summary: text,
        record: z.strictObject({ crop: text, experiment: text, note: z.string() }),
        trigger: z.strictObject({
          any_of: z
            .array(z.strictObject({ metric: metricSchema, side: z.enum(['low', 'high']) }))
            .min(1),
          fan: fanLevelSchema.optional(),
        }),
        symptoms: z
          .array(
            z.strictObject({
              symptom_id: text,
              name: text,
              stage: z.number().int().min(1),
              value_type: valueTypeSchema,
              source: sourceRefSchema.nullable(),
            }),
          )
          .min(1),
        actions: z
          .array(
            z.strictObject({
              action_id: text,
              name: text,
              verdict: verdictSchema,
              reason: text,
              delta: actionDeltaSchema,
              value_type: valueTypeSchema,
              source: sourceRefSchema.nullable(),
            }),
          )
          .min(1),
        source: sourceRefSchema,
      }),
    )
    .min(1),
  harvest: z.strictObject({
    steps: z.array(
      z.strictObject({
        step_id: harvestStepIdSchema,
        name: text,
        description: text,
        value_type: valueTypeSchema,
        source: sourceRefSchema.nullable(),
      }),
    ),
    microbial_range: z.strictObject({
      min: z.number(),
      max: z.number(),
      unit: text,
      description: text,
      value_type: z.literal('measured'),
      source: sourceRefSchema,
    }),
    pathogen_screen: z.strictObject({
      organisms: z.array(text).min(1),
      result: text,
      value_type: z.literal('measured'),
      source: sourceRefSchema,
    }),
    standards_note: z.strictObject({ text, source: sourceRefSchema }),
  }),
  background: z.array(z.strictObject({ claim_id: text, claim: text, source: sourceRefSchema })),
}) satisfies z.ZodType<EvidenceList>;
