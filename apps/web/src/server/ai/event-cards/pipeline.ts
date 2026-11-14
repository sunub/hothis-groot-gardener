import type {
  EventCardOption,
  EventCardOutput,
  EventCardRequest,
  EventCardResponse,
} from '@/lib/contract/schemas';
import type { EventList, TimelineEvent } from '@/lib/contract/types';
import {
  DEFAULT_GENERATION_TIMEOUT_MS,
  GENERATION_ATTEMPTS,
  GenerationTimeoutError,
} from '@/server/ai/crisis/pipeline';
import { eventList, findEventAction, findTimelineEvent, type CardEvent } from '@/lib/events';
import {
  buildEventCardGenerationInput,
  type EventCardGenerationInput,
  type EventCardGenerator,
} from './generator';
import { getPremadeEventCard } from './premade';
import { validateEventCardOutput, type EventCardValidationContext } from './validate';

/**
 * Event card creation for POST /api/event: check the request against the
 * event list, generate, validate, retry once, fall back to the pre-made
 * text, attach the verdicts and effects. No state is kept between requests;
 * the game engine decides which event occurs and which actions are offered.
 */

/**
 * The request names an event that is unknown, shows no card, is outside its
 * window on that day, or offers an action the event does not have. The
 * message is fixed so the offending value is never echoed back.
 */
export class InvalidEventRequestError extends Error {
  constructor(message = 'The request refers to an event or action that cannot be shown.') {
    super(message);
    this.name = 'InvalidEventRequestError';
  }
}

/** Replaceable parts of `createEventCard`, for wiring a generator and for tests. */
export interface CreateEventCardDeps {
  /** Text generator. Without one, the pre-made text is returned directly. */
  generator?: EventCardGenerator;
  /** Defaults to the shipped event list. */
  events?: EventList;
  /** Per attempt. Defaults to the crisis pipeline's DEFAULT_GENERATION_TIMEOUT_MS. */
  timeoutMs?: number;
}

/**
 * True for an event that shows a card: every conditional event, and a
 * scheduled event that has actions and is not a link to a mission phase.
 * Same rule as the private `showsCard` in src/lib/events/judge.ts.
 */
export function isCardEvent(event: TimelineEvent): event is CardEvent {
  if (event.kind === 'conditional') return true;
  return event.kind === 'scheduled' && event.maps_to_phase === undefined && event.actions.length > 0;
}

/**
 * Create one validated event card for the request.
 * Deterministic when no generator is given.
 *
 * @throws InvalidEventRequestError when the event or an offered action cannot be shown.
 * @throws Error when the event's name or pre-made text is missing or invalid (a bug in the data files).
 */
export async function createEventCard(
  request: EventCardRequest,
  deps: CreateEventCardDeps = {},
): Promise<EventCardResponse> {
  const list = deps.events ?? eventList;
  const event = findTimelineEvent(list, request.event_id);
  if (!event || !isCardEvent(event)) throw new InvalidEventRequestError();
  if (request.cultivation_day < event.window.from || request.cultivation_day > event.window.to) {
    throw new InvalidEventRequestError();
  }
  const offeredActionIds = request.offered_action_ids ?? event.actions.map((a) => a.action_id);
  if (
    new Set(offeredActionIds).size !== offeredActionIds.length ||
    !offeredActionIds.every((id) => findEventAction(event, id))
  ) {
    throw new InvalidEventRequestError();
  }
  if (event.name === undefined) {
    throw new Error(`Event ${event.event_id} has no name.`);
  }
  const name = event.name;
  const context: EventCardValidationContext = { event, offeredActionIds };

  if (deps.generator) {
    const input = buildEventCardGenerationInput(request, event, name, offeredActionIds);
    const timeoutMs = deps.timeoutMs ?? DEFAULT_GENERATION_TIMEOUT_MS;
    for (let i = 0; i < GENERATION_ATTEMPTS; i++) {
      let raw: unknown;
      try {
        raw = await generateWithTimeout(deps.generator, input, timeoutMs);
      } catch {
        continue;
      }
      const result = validateEventCardOutput(raw, context);
      if (result.ok) {
        return attachEventActions(result.value, event, name, offeredActionIds, request.cultivation_day, 'generated');
      }
    }
  }

  const output = getPremadeEventCard(event.event_id, offeredActionIds);
  if (!output) {
    throw new Error(`No pre-made card text for ${event.event_id}.`);
  }
  const result = validateEventCardOutput(output, context);
  if (!result.ok) {
    throw new Error(`Pre-made card ${event.event_id} is invalid: ${result.issues.join(' ')}`);
  }
  return attachEventActions(result.value, event, name, offeredActionIds, request.cultivation_day, 'fallback');
}

/**
 * Turn validated card text into the API response. Op, verdict, effect and
 * value type always come from the event list, never from the text. Options
 * follow the offered order.
 *
 * @throws Error when an offered action has no option or is not in the event. Validate first.
 */
export function attachEventActions(
  output: EventCardOutput,
  event: CardEvent,
  name: string,
  offeredActionIds: readonly string[],
  cultivationDay: number,
  origin: EventCardResponse['origin'],
): EventCardResponse {
  const options = offeredActionIds.map((id): EventCardOption => {
    const option = output.options.find((o) => o.action_id === id);
    const action = findEventAction(event, id);
    if (!option || !action) {
      throw new Error(`Action ${id} has no option or is not in event ${event.event_id}.`);
    }
    // Copies, so the screen can never mutate the shared event list.
    const { clear_flags, ...numbers } = action.effect;
    return {
      action_id: id,
      op: action.op,
      label: option.label,
      result_line: option.result_line,
      why: option.why,
      verdict: action.verdict,
      effect: clear_flags ? { ...numbers, clear_flags: [...clear_flags] } : { ...numbers },
      value_type: action.value_type,
    };
  });
  return {
    event_id: event.event_id,
    kind: event.kind,
    name,
    cultivation_day: cultivationDay,
    scene: output.scene,
    plant_line: output.plant_line,
    options,
    summary: event.summary,
    source_chunks: [...event.source_chunks],
    draft: true,
    origin,
  };
}

/**
 * Run the generator with a deadline. Same approach as the crisis pipeline,
 * whose helper is private: the race does not rely on the generator honouring
 * the abort signal, so a stuck generator cannot hold the request.
 */
async function generateWithTimeout(
  generator: EventCardGenerator,
  input: EventCardGenerationInput,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new GenerationTimeoutError(timeoutMs));
    }, timeoutMs);
  });
  // Wrapping also turns a synchronous throw into a rejection.
  const generation = Promise.resolve().then(() => generator(input, controller.signal));
  // A late rejection after the deadline must not become an unhandled rejection.
  generation.catch(() => undefined);
  try {
    return await Promise.race([generation, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
