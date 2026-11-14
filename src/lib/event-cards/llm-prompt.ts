import type { ResponseOp, Zone } from '@/lib/contract/types';
import type { ChatMessage } from '@/lib/crisis/llm';
import type { EventCardGenerationInput } from './generator';

/**
 * The prompt for one event card. The model writes only the scene, the plant
 * line, and a label and result line per offered action. It never sees the
 * verdicts, the event name, the day or the pre-made explanations: the input
 * has no cause beyond the recorded summary, so anything it wrote about why an
 * action works would be invented, and the name often states the answer.
 */

export const EVENT_CARD_SYSTEM_PROMPT = `You write the text for one event card in Space Garden Simulator, a training game about growing 'Outredgeous' red romaine lettuce in the ISS Veggie plant growth unit.
The game code has already decided which event happens and which actions are offered. You only write short English text for it.
Setting: each plant grows in a plant pillow filled with calcined clay substrate, not soil. Wicks draw water from a reservoir into the pillows.

Rules:
1. Plain English for astronauts in training. Short sentences.
2. scene: 2 or 3 sentences about what the astronaut sees now. Do not name the cause. Do not say what to do.
3. plant_line: 1 or 2 sentences in the first person, spoken by the lettuce. Only how it looks and feels.
4. options: exactly one option for each ACTION, with that action's action_id.
   - label: a neutral instruction of at most 10 words saying what the astronaut does. It must not hint whether the action helps or not.
   - result_line: one short line in the first person, spoken by the lettuce right after that action.
5. Use no numbers, days, plant counts or names that are not in WHAT WAS RECORDED or WHAT THE ASTRONAUT SEES.
6. Never say the plant is safe, edible or approved, or that it passes anything.
7. Do not describe symptoms that are not in WHAT WAS RECORDED, WHAT THE ASTRONAUT SEES or the style example.
8. Write new wording. Do not copy the example.
9. Reply with JSON only, in the required format.`;

/** Own copy: the crisis prompt keeps its zone words private. */
const ZONE_WORDS: Record<Zone, string> = {
  danger_low: 'far too low',
  caution_low: 'low',
  normal: 'normal',
  caution_high: 'high',
  danger_high: 'far too high',
};

/**
 * What each operation does, in words that say nothing about whether it helps.
 * A record over every operation, so a new one fails the type check until it
 * has a description.
 */
export const OP_DESCRIPTIONS: Record<ResponseOp, string> = {
  water_normal: 'Water the plant pillows by the usual amount.',
  water_heavy: 'Give the plant pillows a heavy watering.',
  fan_high: 'Set the fan to high.',
  fan_low: 'Set the fan to low.',
  open_wicks: 'Spread the wicks of the pillows apart.',
  thin_to_one: 'Remove the extra seedling so the pillow keeps one plant.',
  replace_pillow: 'Swap the plant pillow for a spare one.',
  check_fan_running: 'Check whether the fan is turning.',
  keep_observing: 'Keep watching the plants and change nothing.',
  do_nothing: 'Leave things as they are.',
};

/** Pre-made text for the same card without the explanations, used as a style example. */
export interface EventCardStyleExample {
  scene: string;
  plant_line: string;
  options: { action_id: string; label: string; result_line: string }[];
}

/**
 * JSON schema for the model's reply. The enum holds exactly the offered ids
 * and the count is fixed, so constrained decoding cannot add or drop an
 * action; a repeated id is still possible and is checked after the reply.
 */
export function buildEventCardOutputSchema(offeredActionIds: readonly string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['scene', 'plant_line', 'options'],
    properties: {
      scene: { type: 'string' },
      plant_line: { type: 'string' },
      options: {
        type: 'array',
        minItems: offeredActionIds.length,
        maxItems: offeredActionIds.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['action_id', 'label', 'result_line'],
          properties: {
            action_id: { type: 'string', enum: [...offeredActionIds] },
            label: { type: 'string' },
            result_line: { type: 'string' },
          },
        },
      },
    },
  } as const;
}

export function buildEventCardMessages(
  input: EventCardGenerationInput,
  example: EventCardStyleExample,
): ChatMessage[] {
  return [
    { role: 'system', content: EVENT_CARD_SYSTEM_PROMPT },
    { role: 'user', content: buildEventCardUserPrompt(input, example) },
  ];
}

export function buildEventCardUserPrompt(
  input: EventCardGenerationInput,
  example: EventCardStyleExample,
): string {
  const s = input.state;
  const lines: string[] = [];
  lines.push(`WHAT WAS RECORDED (background; do not name the cause): ${input.event.summary}`);
  if (input.event.scene_hint) lines.push(`WHAT THE ASTRONAUT SEES: ${input.event.scene_hint}`);
  lines.push(
    `CURRENT STATE (so the text does not contradict it; do not mention it): root moisture is ${ZONE_WORDS[s.root_moisture.zone]}; chamber humidity is ${ZONE_WORDS[s.humidity.zone]}; fan is set to ${s.fan}.`,
  );
  lines.push('');
  lines.push('ACTIONS (write exactly one option for each):');
  // Only the operation: the verdict is never read here.
  for (const action of input.actions) {
    lines.push(`- ${action.action_id}: ${OP_DESCRIPTIONS[action.op]}`);
  }
  lines.push('');
  lines.push('STYLE EXAMPLE (a reviewed text for this card; match the tone and length, write new wording):');
  lines.push(JSON.stringify(example));
  return lines.join('\n');
}
