import type { AiCrisisOutput, Zone } from '@/lib/contract/types';
import type { GenerationCandidate, GenerationInput } from '../generator';
import type { EvidenceChunk } from './retrieval';

/**
 * The prompt (planning document: "AI 처리 단계 > 입력 조립"): role and rules,
 * the evidence for one crisis, the current state, and the output format.
 * The model only writes text; the code decides the crisis, the actions and
 * their verdicts.
 */

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

/** Longest background excerpt passed to the model, in characters. */
export const EXCERPT_MAX_CHARS = 600;

export const SYSTEM_PROMPT = `You write the text for one crisis in Space Garden Simulator, a training game about growing 'Outredgeous' red romaine lettuce in the ISS Veggie plant growth unit.
The game code has already decided which crisis happens, which actions are offered and whether each action is right. You only write short English text for it.
Setting: each plant grows in a plant pillow filled with calcined clay (arcillite) substrate, not soil. Wicks draw water from a reservoir into the pillows.

Rules:
1. Plain English for astronauts in training. Short sentences. No numbers, no units.
2. scene: 2 or 3 sentences about what the astronaut sees on the plants and in the growth chamber now. Describe only the ALLOWED SYMPTOMS. Do not name the crisis or its cause. Do not mention the fan, any setting or any reading: the player sees those on the status panel, and mentioning them hints at the answer.
3. plant_line: 1 or 2 sentences in the first person, spoken by the lettuce. Only how it looks and feels, using the ALLOWED SYMPTOMS. Never the cause, never what to do, never the fan or a setting.
4. clues: one clue per symptom, with that symptom's symptom_id. Each clue text is one short sentence about that symptom only.
5. options: exactly one option for each ACTION, with that action's action_id.
   - label: a short neutral instruction of at most 10 words saying what the astronaut does. It must not hint whether the action is right or wrong: do not use words such as best, correct, should, safe, recommended, proper, wrong or mistake.
   - result_line: what the lettuce says right after that action, in the first person. It must match the verdict: appropriate means clearly better; partial means a little better but not fixed; inappropriate means worse or no better.
   - why: one sentence that restates the given reason in your own words. Add nothing that is not in the reason.
6. Never mention a symptom, cause, event or number that is not given in this message, and do not add details such as colors, textures or amounts that the symptom names do not give. Background excerpts are only for accurate wording; do not take new symptoms or events from them.
7. Write new wording. Do not copy the example.
8. Reply with JSON only, in the required format.`;

const ZONE_WORDS: Record<Zone, string> = {
  danger_low: 'far too low',
  caution_low: 'low',
  normal: 'normal',
  caution_high: 'high',
  danger_high: 'far too high',
};

/** JSON schema for one candidate. Enums make it impossible to output an unknown id. */
export function buildOutputSchema(candidate: GenerationCandidate, cluesMax: number) {
  const symptomIds = candidate.symptoms.map((s) => s.symptom_id);
  const actionIds = candidate.actions.map((a) => a.action_id);
  const optionCount = Math.min(actionIds.length, 4);
  const clueMax = Math.max(candidate.clues_min, Math.min(cluesMax, symptomIds.length));
  return {
    type: 'object',
    additionalProperties: false,
    required: ['crisis_id', 'scene', 'plant_line', 'clues', 'options'],
    properties: {
      crisis_id: { type: 'string', enum: [candidate.crisis_id] },
      scene: { type: 'string' },
      plant_line: { type: 'string' },
      clues: {
        type: 'array',
        minItems: candidate.clues_min,
        maxItems: clueMax,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['symptom_id', 'text'],
          properties: {
            symptom_id: { type: 'string', enum: symptomIds },
            text: { type: 'string' },
          },
        },
      },
      options: {
        type: 'array',
        minItems: Math.min(3, optionCount),
        maxItems: optionCount,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['action_id', 'label', 'result_line', 'why'],
          properties: {
            action_id: { type: 'string', enum: actionIds },
            label: { type: 'string' },
            result_line: { type: 'string' },
            why: { type: 'string' },
          },
        },
      },
    },
  } as const;
}

export interface PromptParts {
  input: GenerationInput;
  candidate: GenerationCandidate;
  /** Retrieved background excerpts. Empty when search is off or failed. */
  excerpts: readonly EvidenceChunk[];
  /** A reviewed pre-made crisis for the same crisis, as a style example. */
  example?: AiCrisisOutput;
}

export function buildMessages(parts: PromptParts): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(parts) },
  ];
}

export function buildUserPrompt({ input, candidate, excerpts, example }: PromptParts): string {
  const s = input.state;
  const lines: string[] = [];

  lines.push(`CRISIS: ${candidate.name} (crisis_id: ${candidate.crisis_id})`);
  lines.push(`WHAT WAS RECORDED: ${candidate.summary}`);
  if (candidate.record_note) lines.push(`RECORD NOTE: ${candidate.record_note}`);
  lines.push(`SYMPTOM STAGE: ${candidate.stage}`);
  lines.push(`CULTIVATION DAY: ${input.cultivation_day} of 33`);
  lines.push(
    `CURRENT STATE (so the text does not contradict it; do not mention it): root moisture is ${ZONE_WORDS[s.root_moisture.zone]}; chamber humidity is ${ZONE_WORDS[s.humidity.zone]}; fan is set to ${s.fan}.`,
  );
  lines.push('');

  lines.push('ALLOWED SYMPTOMS (describe only these):');
  for (const symptom of candidate.symptoms) {
    lines.push(`- ${symptom.symptom_id}: ${symptom.name}`);
  }
  lines.push(
    `Write ${candidate.clues_min} to ${Math.max(candidate.clues_min, Math.min(input.limits.clues_max, candidate.symptoms.length))} clues.`,
  );
  lines.push('');

  lines.push('ACTIONS (write exactly one option for each):');
  for (const action of candidate.actions) {
    lines.push(`- ${action.action_id}: ${action.name} | verdict: ${action.verdict} | reason: ${action.reason}`);
  }

  if (input.active && input.active.crisis_id === candidate.crisis_id && input.active.attempt > 1) {
    lines.push('');
    lines.push(
      `THIS CRISIS IS SHOWN AGAIN (attempt ${input.active.attempt}): the astronaut's last choice did not help. Describe the allowed symptoms as worse than before.`,
    );
  }

  const earlier = input.history.filter((h) => h.crisis_id === candidate.crisis_id);
  if (earlier.length > 0) {
    lines.push('');
    lines.push(
      `THIS CRISIS HAPPENED BEFORE IN THIS MISSION on cultivation day ${earlier.map((h) => h.cultivation_day).join(', ')}. You may say it looks familiar.`,
    );
  }

  if (example) {
    lines.push('');
    lines.push('STYLE EXAMPLE (a reviewed text for this crisis; match the tone and length, write new wording):');
    lines.push(JSON.stringify(example));
  }

  if (excerpts.length > 0) {
    lines.push('');
    lines.push('BACKGROUND EXCERPTS (NASA plant research, for accurate wording only; take no new symptoms or events from them):');
    excerpts.forEach((chunk, i) => {
      lines.push(`[${i + 1}] ${chunk.subsection}: ${truncate(chunk.text, EXCERPT_MAX_CHARS)}`);
    });
  }

  return lines.join('\n');
}

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}
