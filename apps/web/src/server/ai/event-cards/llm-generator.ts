import { z } from 'zod';
import {
  AI_LABEL_MAX_LENGTH,
  AI_PLANT_LINE_MAX_LENGTH,
  AI_RESULT_LINE_MAX_LENGTH,
  AI_SCENE_MAX_LENGTH,
  type EventCardOutput,
} from '@/lib/contract/schemas';
import { chatJson, GenerationRejectedError, SYMPTOM_GROUPS, type LlmConfig } from '@/server/ai/crisis/llm';
import type { EventCardGenerationInput, EventCardGenerator } from './generator';
import { buildEventCardMessages, buildEventCardOutputSchema, type EventCardStyleExample } from './llm-prompt';
import { getPremadeEventCard } from './premade';

/**
 * The event card text generator: one model call per attempt.
 *
 * 1. Call the model with a JSON schema whose enum holds exactly the offered
 *    action ids. It writes the scene, the plant line, and a label and result
 *    line per action.
 * 2. Check the shape and the ids, then the wording (invented symptoms).
 * 3. Assemble the card in code: the event id from the input and each `why`
 *    from the pre-made card for the same action. The input has only the
 *    operation and the verdict, so a generated explanation would invent a
 *    cause and drop the wording that marks effects as game values.
 *
 * Any problem throws, so the pipeline counts a failed attempt: one retry,
 * then the pre-made card. validateEventCardOutput still runs on the result
 * in the pipeline (ids, reveal words in labels, banned claims). Options are
 * not shuffled: the game engine decides the order and the pipeline keeps it.
 */

export interface EventCardLlmGeneratorDeps {
  fetchImpl?: typeof fetch;
}

export function createEventCardLlmGenerator(
  config: LlmConfig,
  deps: EventCardLlmGeneratorDeps = {},
): EventCardGenerator {
  const fetchImpl = deps.fetchImpl ?? fetch;

  return async (input: EventCardGenerationInput, signal: AbortSignal): Promise<unknown> => {
    const offeredIds = input.actions.map((a) => a.action_id);
    const premade = getPremadeEventCard(input.event.event_id, offeredIds);
    // Without pre-made text there is no `why` to attach; the pipeline then fails loudly on its own fallback.
    if (!premade) throw new Error(`No pre-made card text for ${input.event.event_id}.`);

    const messages = buildEventCardMessages(input, styleExample(premade));
    const raw = await chatJson(config, messages, buildEventCardOutputSchema(offeredIds), signal, fetchImpl);

    const parsed = modelReplySchema(offeredIds).safeParse(raw);
    if (!parsed.success) {
      throw new GenerationRejectedError(
        parsed.error.issues.map((i) => `shape: ${i.path.join('.') || '(root)'}: ${i.message}`),
      );
    }
    const reply = parsed.data;
    const issues = [
      ...checkActionIds(reply, offeredIds),
      ...checkEventCardWording(reply, allowedSymptomText(input, premade)),
    ];
    if (issues.length > 0) throw new GenerationRejectedError(issues);

    const whyById = new Map(premade.options.map((o) => [o.action_id, o.why]));
    const output: EventCardOutput = {
      event_id: input.event.event_id,
      scene: reply.scene,
      plant_line: reply.plant_line,
      options: offeredIds.map((id) => {
        const option = reply.options.find((o) => o.action_id === id)!;
        return { action_id: id, label: option.label, result_line: option.result_line, why: whyById.get(id)! };
      }),
    };
    return output;
  };
}

const replyText = z.string().trim().min(1);

/** The reply as the model must write it. The caps are the ones the card format uses. */
function modelReplySchema(offeredIds: readonly string[]) {
  return z.strictObject({
    scene: replyText.max(AI_SCENE_MAX_LENGTH),
    plant_line: replyText.max(AI_PLANT_LINE_MAX_LENGTH),
    options: z
      .array(
        z.strictObject({
          action_id: z.enum(offeredIds as [string, ...string[]]),
          label: replyText.max(AI_LABEL_MAX_LENGTH),
          result_line: replyText.max(AI_RESULT_LINE_MAX_LENGTH),
        }),
      )
      .length(offeredIds.length),
  });
}

/** The model-written part of a card: the same fields as the style example. */
export type EventCardModelReply = EventCardStyleExample;

/** The pre-made card without `why` and `event_id`, so neither the explanation nor its verdict words reach the model. */
export function styleExample(premade: EventCardOutput): EventCardStyleExample {
  return {
    scene: premade.scene,
    plant_line: premade.plant_line,
    options: premade.options.map((o) => ({ action_id: o.action_id, label: o.label, result_line: o.result_line })),
  };
}

/** Text that may name a symptom: what was recorded and what the reviewed card already shows. */
export function allowedSymptomText(input: EventCardGenerationInput, premade: EventCardOutput): string {
  return [input.event.summary, input.event.scene_hint ?? '', premade.scene, premade.plant_line].join(' | ');
}

/** Each offered id exactly once. The schema enum cannot stop a repeated id. */
function checkActionIds(reply: EventCardModelReply, offeredIds: readonly string[]): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const option of reply.options) {
    if (!offeredIds.includes(option.action_id)) issues.push(`action_id "${option.action_id}" is not offered.`);
    if (seen.has(option.action_id)) issues.push(`action_id "${option.action_id}" is used more than once.`);
    seen.add(option.action_id);
  }
  for (const id of offeredIds) {
    if (!seen.has(id)) issues.push(`Offered action "${id}" has no option.`);
  }
  return issues;
}

/**
 * Symptom words in model-written text. A symptom group may appear only when
 * its pattern also matches `allowedText`; otherwise the model invented it.
 */
export function checkEventCardWording(reply: EventCardModelReply, allowedText: string): string[] {
  const forbidden = SYMPTOM_GROUPS.filter((g) => !g.pattern.test(allowedText));
  const fields: [string, string][] = [
    ['scene', reply.scene],
    ['plant_line', reply.plant_line],
    ...reply.options.flatMap((o, i): [string, string][] => [
      [`options.${i}.label`, o.label],
      [`options.${i}.result_line`, o.result_line],
    ]),
  ];
  const issues: string[] = [];
  for (const [field, text] of fields) {
    for (const group of forbidden) {
      const hit = text.match(group.pattern);
      if (hit) issues.push(`${field}: "${hit[0]}" describes ${group.name}, which this event does not record.`);
    }
  }
  return issues;
}
