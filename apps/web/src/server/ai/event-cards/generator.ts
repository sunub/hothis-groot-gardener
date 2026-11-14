import {
  AI_LABEL_MAX_LENGTH,
  AI_PLANT_LINE_MAX_LENGTH,
  AI_RESULT_LINE_MAX_LENGTH,
  AI_SCENE_MAX_LENGTH,
  AI_WHY_MAX_LENGTH,
  type EventCardRequest,
} from '@/lib/contract/schemas';
import type { Locale, Metric, ResponseOp, Verdict } from '@/lib/contract/types';
import type { GenerationMetric, GenerationState } from '@/server/ai/crisis/generator';
import type { CardEvent } from '@/lib/events';
import { zoneOf } from '@/lib/game/rules';

/**
 * The seam where event card text generation plugs in. Input shape and a pure
 * builder only; no prompt and no model call are built here.
 */

/** An action the card offers, with its operation and verdict from the event list. */
export interface EventCardGenerationAction {
  action_id: string;
  op: ResponseOp;
  verdict: Verdict;
}

/** The event the card is for. */
export interface EventCardGenerationEvent {
  event_id: string;
  kind: CardEvent['kind'];
  name: string;
  /** What was actually recorded. */
  summary: string;
  /** What the astronaut sees, when the event list gives it. */
  scene_hint: string | null;
}

/** Count and length limits of the output format. */
export interface EventCardGenerationLimits {
  /** The output must have exactly this many options, one per offered action. */
  options: number;
  scene_max_length: number;
  plant_line_max_length: number;
  label_max_length: number;
  result_line_max_length: number;
  why_max_length: number;
}

/** Everything a generator gets for one card. Serialized shape, so keys are snake_case. */
export interface EventCardGenerationInput {
  locale: Locale;
  cultivation_day: number;
  state: GenerationState;
  event: EventCardGenerationEvent;
  /** In the order shown. */
  actions: EventCardGenerationAction[];
  limits: EventCardGenerationLimits;
}

/**
 * Produces raw event card text. The result is untrusted and is checked by
 * `validateEventCardOutput` before use. The function must stop work when
 * `signal` aborts (the pipeline gives up after its timeout either way).
 * None is wired yet, so every card uses the pre-made text.
 */
export type EventCardGenerator = (
  input: EventCardGenerationInput,
  signal: AbortSignal,
) => Promise<unknown>;

/**
 * Build the generation input. `offeredActionIds` must already be checked to
 * be actions of the event.
 */
export function buildEventCardGenerationInput(
  request: EventCardRequest,
  event: CardEvent,
  name: string,
  offeredActionIds: readonly string[],
): EventCardGenerationInput {
  const metric = (m: Metric): GenerationMetric => ({
    value: request.state[m],
    zone: zoneOf(m, request.state[m]),
  });
  const actions = offeredActionIds.map((id): EventCardGenerationAction => {
    const action = event.actions.find((a) => a.action_id === id);
    if (!action) throw new Error(`Action ${id} is not in event ${event.event_id}.`);
    return { action_id: action.action_id, op: action.op, verdict: action.verdict };
  });
  return {
    locale: request.locale,
    cultivation_day: request.cultivation_day,
    state: {
      plant_health: request.state.plant_health,
      root_moisture: metric('root_moisture'),
      humidity: metric('humidity'),
      fan: request.state.fan,
      light: { ...request.state.light },
    },
    event: {
      event_id: event.event_id,
      kind: event.kind,
      name,
      summary: event.summary,
      scene_hint: event.scene_hint ?? null,
    },
    actions,
    limits: {
      options: actions.length,
      scene_max_length: AI_SCENE_MAX_LENGTH,
      plant_line_max_length: AI_PLANT_LINE_MAX_LENGTH,
      label_max_length: AI_LABEL_MAX_LENGTH,
      result_line_max_length: AI_RESULT_LINE_MAX_LENGTH,
      why_max_length: AI_WHY_MAX_LENGTH,
    },
  };
}
