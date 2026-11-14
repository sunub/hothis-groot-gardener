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

/*
 * Length caps for generated text, in UTF-16 code units after trimming. Each is
 * at least 2.4x the longest English value in src/data/fallback-crises.json (measured
 * longest in parentheses), so a normal sentence fits while a runaway or
 * padded output is rejected and the pre-made crisis is used instead.
 */

/** Scene description (longest pre-made: 165). */
export const AI_SCENE_MAX_LENGTH = 400;
/** The plant's line (longest pre-made: 97). */
export const AI_PLANT_LINE_MAX_LENGTH = 240;
/** One clue's text (longest pre-made: 59). */
export const AI_CLUE_TEXT_MAX_LENGTH = 160;
/** One option label (longest pre-made: 39). Labels are buttons, so the cap is tight. */
export const AI_LABEL_MAX_LENGTH = 100;
/** The plant's line after a choice (longest pre-made: 64). */
export const AI_RESULT_LINE_MAX_LENGTH = 160;
/** Why the choice worked or not (longest pre-made: 111). */
export const AI_WHY_MAX_LENGTH = 280;

const aiClueSchema = z.strictObject({
  symptom_id: text,
  text: text.max(AI_CLUE_TEXT_MAX_LENGTH),
});

/** Text fields shared by the AI output and the API response, so their caps cannot drift. */
const aiOptionShape = {
  action_id: text,
  label: text.max(AI_LABEL_MAX_LENGTH),
  result_line: text.max(AI_RESULT_LINE_MAX_LENGTH),
  why: text.max(AI_WHY_MAX_LENGTH),
};
const aiSceneSchema = text.max(AI_SCENE_MAX_LENGTH);
const aiPlantLineSchema = text.max(AI_PLANT_LINE_MAX_LENGTH);

/**
 * Shape check only. Whether the ids exist in the evidence list, and the
 * content rules on the text, are checked by validateAiOutput in
 * src/lib/crisis/validate.ts.
 */
export const aiCrisisOutputSchema = z.strictObject({
  crisis_id: text,
  scene: aiSceneSchema,
  plant_line: aiPlantLineSchema,
  clues: z.array(aiClueSchema).min(1).max(AI_CLUES_MAX),
  options: z
    .array(z.strictObject(aiOptionShape))
    .min(AI_OPTIONS_MIN)
    .max(AI_OPTIONS_MAX),
}) satisfies z.ZodType<AiCrisisOutput>;

// --- Crisis API request ------------------------------------------------------

/*
 * Abuse guards for the request. They bound the work and the generation input
 * a single request can cause; they are not game rules, so they are set well
 * above anything a mission produces and need no change when the mission
 * timeline gets longer. The body size cap in src/app/api/crisis/route.ts is
 * the binding limit on the total size.
 */

/**
 * Largest POST /api/crisis body accepted, in bytes. A real request is a few
 * kilobytes even with a long history; the cap keeps one request from making
 * the server buffer and parse an arbitrarily large body. Kept here, not in the
 * route file, because a route file may export only route handlers and config.
 */
export const REQUEST_BODY_MAX_BYTES = 64 * 1024;

/**
 * Ids in the request are copied into the generation input, so only plain
 * snake_case ids are accepted: no spaces, punctuation or line breaks that
 * could carry instructions. Every id in the evidence list fits.
 */
export const REQUEST_ID_PATTERN = /^[a-z0-9_]+$/;
/** Longest id accepted (the longest id in the evidence list today is 20). */
export const REQUEST_ID_MAX_LENGTH = 64;
/** Finished crises in the history. One per crisis, far above any mission length. */
export const REQUEST_HISTORY_MAX = 200;
/** Choices recorded for one crisis. A crisis has a handful of actions. */
export const REQUEST_CHOICES_MAX = 50;
/** Actions already chosen in the active crisis. A crisis has a handful of actions. */
export const REQUEST_CHOSEN_ACTIONS_MAX = 50;
/** Presentation count of the active crisis. Bounded by the actions a crisis has. */
export const REQUEST_ATTEMPT_MAX = 50;
/** Consecutive nights in a danger zone. Far above any mission length. */
export const REQUEST_DANGER_DAYS_MAX = 1000;

/** Not built from `text`: trimming would accept an id padded with spaces. */
const requestId = z.string().max(REQUEST_ID_MAX_LENGTH).regex(REQUEST_ID_PATTERN);
const dangerDays = z.number().int().min(0).max(REQUEST_DANGER_DAYS_MAX);

export const crisisRequestSchema = z.strictObject({
  locale: localeSchema,
  cultivation_day: z.number().int().min(1).max(33),
  state: plantStateSchema,
  danger_days: z.strictObject({
    root_moisture: dangerDays,
    humidity: dangerDays,
  }),
  history: z
    .array(
      z.strictObject({
        crisis_id: requestId,
        cultivation_day: z.number().int().min(1).max(33),
        choices: z
          .array(z.strictObject({ action_id: requestId, verdict: verdictSchema }))
          .max(REQUEST_CHOICES_MAX),
        outcome: crisisOutcomeSchema,
      }),
    )
    .max(REQUEST_HISTORY_MAX),
  active: z
    .strictObject({
      crisis_id: requestId,
      attempt: z.number().int().min(1).max(REQUEST_ATTEMPT_MAX),
      chosen_action_ids: z.array(requestId).max(REQUEST_CHOSEN_ACTIONS_MAX),
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
  // Same caps as the AI output: the response text is the validated output, so
  // a valid server never trips them, and the screen can rely on the lengths.
  scene: aiSceneSchema,
  plant_line: aiPlantLineSchema,
  clues: z.array(aiClueSchema).min(1).max(AI_CLUES_MAX),
  options: z
    .array(
      z.strictObject({
        ...aiOptionShape,
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
