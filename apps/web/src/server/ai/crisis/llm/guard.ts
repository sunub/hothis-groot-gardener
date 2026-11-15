import type { AiCrisisOutput } from '@/lib/contract/types';
import type { GenerationCandidate } from '../generator';
import type { StyleExample } from './prompt';

/**
 * Wording checks for generated text, on top of validateAiOutput.
 * validateAiOutput checks ids and counts; these catch what small models
 * tend to get wrong in the words themselves (implementation notes, entry 35):
 *
 * 1. Symptoms that are not allowed at this stage ("wilting" in a water
 *    shortage, whose recorded symptoms do not include wilting; "mold" at stage 1).
 * 2. Labels that hint at the answer ("the best option", "you should").
 * 3. A scene, plant line or clue that names the cause, a setting or a reading.
 * 4. Facts that are wrong for Veggie or microgravity (soil, dripping water).
 * 5. Result lines that are too short, and text far longer than the format asks for.
 * 6. Labels that no longer name their action, a narrator instead of the
 *    lettuce, and a scene or plant line copied from the style example.
 *
 * On a problem the model rewrites once (generator.ts); after that the attempt
 * fails, the pipeline retries once and then shows the pre-made crisis.
 */

interface SymptomGroup {
  name: string;
  pattern: RegExp;
  /** Plain words for the prompt's "do not use" line. */
  examples: string;
}

/** Symptom words a model may invent. A group is allowed only when an allowed symptom name matches it. */
export const SYMPTOM_GROUPS: SymptomGroup[] = [
  // "turgid"/"turgor": a run wrote "lack turgidity" for stressed plants, a technical word for wilting.
  { name: 'wilting', pattern: /\b(wilt\w*|droop\w*|limp\w*|sag(s|ged|ging)?|flop\w*|floppy|turgid\w*|turgor\w*)\b/i, examples: 'wilting, wilted, drooping, limp, sagging, floppy, turgor, turgidity' },
  { name: 'fungus', pattern: /\b(molds?|mouldy?|moldy|mildew\w*|fung\w*|mycel\w*|spores?)\b/i, examples: 'mold, mildew, fungus, fungal, mycelium, spores' },
  { name: 'rot', pattern: /\b(rot|rots|rotting|rotten|decay\w*|mush\w*)\b/i, examples: 'rot, rotting, decay, mushy' },
  // "spots" is not listed: the reviewed rot text uses "soft spots".
  { name: 'discoloration', pattern: /\b(yellow\w*|brown\w*|chloro\w*|necro\w*|blacken\w*|blotch\w*)\b/i, examples: 'yellowing, browning, chlorosis, necrosis, blackened, blotches' },
  { name: 'curling', pattern: /\b(curl\w*|epinast\w*)\b/i, examples: 'curling, curled' },
  { name: 'burn', pattern: /\b(scorch\w*|burn\w*|sunburn\w*)\b/i, examples: 'scorched, burned' },
  { name: 'death', pattern: /\b(dies|died|dying|dead|death)\b/i, examples: 'dying, dead, died' },
];

/** Words that make a label give the answer away. */
export const LABEL_HINT = /\b(best|correct(ly)?|should|safe(st|ly)?|recommended|recommend|proper(ly)?|wrong|mistake|ideal|optimal|right answer|appropriate|inappropriate)\b/i;

/**
 * Never in any generated text: a safety or edibility conclusion
 * (planning document: "수확 후 미생물 평가 > 말하지 않는 것"; same rule as
 * src/lib/i18n/strings.test.ts for the screen text).
 */
export const SAFETY_CLAIM = /\b(edible|safe|safely|safety|ok to eat|okay to eat|can be eaten|approved|certified)\b/i;

/**
 * Settings and readings in the scene, the plant line or a clue. The status
 * panel shows them, and the fan is also an option, so naming it hints at the
 * answer ("the fan remains on a low setting" in a mold crisis).
 */
export const SETTING_WORDS = /\b(fans?|settings?|sensors?|readings?|percent)\b/i;

/**
 * Wrong in microgravity: water does not drip or pool on the ISS (seen in a
 * real Gemma run: "pooling around the base", "my leaves are dripping").
 */
export const GRAVITY_WATER = /\b(drip(s|ped|ping|py)?|pool(s|ed|ing)?|puddl\w*|run(s|ning)? down|trickl\w* down)\b/i;

/** Wrong for Veggie: the plants grow in a calcined clay substrate (seen in a real Gemma run: "the soil around me"). */
export const WRONG_SETTING_FACTS = /\b(soil|dirt|potting mix)\b/i;

/**
 * Per crisis: words in the scene, the plant line or a clue that would name the
 * cause (seen in a real Gemma run: "struggling with dehydration" in the scene).
 */
export const CAUSE_WORDS: Record<string, { pattern: RegExp; examples: string }> = {
  // "lack ... moisture": "The unit seems to lack proper moisture circulation."
  // (fifth log) and "the substrate below me is lacking moisture" (fourth log).
  water_shortage: {
    pattern:
      /\b(water(ing)?|thirst\w*|reservoir|drink\w*|dehydrat\w*)\b|\b(lack\w*|insufficient|not enough|too little)\s+(\w+\s+){0,2}(moisture|hydration|liquid|fluid)\b/i,
    examples: 'water, watering, thirsty, reservoir, dehydrated, lack of moisture',
  },
  overwater_mold: {
    pattern: /\b(overwater\w*|too much water|fan|air ?flow|ventilat\w*|stagnant)\b/i,
    examples: 'overwatered, too much water, air flow, ventilation, stagnant',
  },
};

/** Shortest result line that still says what changed ("I feel worse." came out twice in one crisis). */
export const MIN_RESULT_LINE = 25;

/**
 * Key words of an action. A label keeps at least one key word of its action's
 * name, so it still names the same action. After the prompt banned "water" in
 * the scene, a run carried the ban into the labels and wrote "Wait for the next
 * scheduled nutrient cycle" for "Wait for the next scheduled watering" and
 * "Increase the airflow rate in the chamber" for "Set the fan to high".
 */
export const ACTION_KEY_WORDS: { words: string[]; pattern: RegExp }[] = [
  { words: ['water'], pattern: /\bwater(s|ed|ing)?\b/i },
  { words: ['reservoir'], pattern: /\breservoirs?\b/i },
  { words: ['fan'], pattern: /\bfans?\b/i },
  { words: ['clean', 'wipe'], pattern: /\b(clean\w*|wip(e|es|ed|ing))\b/i },
];

/** The key words a label for this action must keep, or an empty list. */
export function actionKeyWords(actionName: string): { words: string[]; pattern: RegExp }[] {
  return ACTION_KEY_WORDS.filter((k) => k.pattern.test(actionName));
}

/**
 * The lettuce speaks for itself in the plant line and the result lines. A run
 * wrote 13 of 33 result lines as a narrator ("The wetness around the plants
 * appears to diminish noticeably.").
 */
export const FIRST_PERSON = /\b(i|me|my|mine|myself)\b/i;

/** Result lines per crisis that may go without I, me or my. */
export const MAX_NARRATED_RESULT_LINES = 1;

/** Consecutive words shared with the style example that count as copying. */
export const COPY_RUN = 8;

/**
 * Words the model must not use for this candidate, for the prompt. The same
 * lists are enforced by checkWording: `anywhere` in the scene, plant line,
 * clues and result lines; `describing` only in the scene, plant line and clues.
 */
export function bannedWordsFor(candidate: GenerationCandidate): { anywhere: string[]; describing: string[] } {
  const allowedText = candidate.symptoms.map((s) => s.name).join(' | ');
  const anywhere = SYMPTOM_GROUPS.filter((g) => !g.pattern.test(allowedText)).map((g) => g.examples);
  anywhere.push('dripping, pooling, puddles', 'soil, dirt');
  const describing = ['fan, setting, reading'];
  const cause = CAUSE_WORDS[candidate.crisis_id];
  if (cause) describing.push(cause.examples);
  return { anywhere, describing };
}

export const MAX_LENGTH = {
  scene: 420,
  plant_line: 220,
  clue: 160,
  label: 90,
  result_line: 220,
  why: 280,
};

/** Every wording problem in the output, or an empty list. */
export function checkWording(output: AiCrisisOutput, candidate: GenerationCandidate): string[] {
  const issues: string[] = [];
  const allowedText = candidate.symptoms.map((s) => s.name).join(' | ');
  const forbidden = SYMPTOM_GROUPS.filter((g) => !g.pattern.test(allowedText));

  const described: [string, string][] = [
    ['scene', output.scene],
    ['plant_line', output.plant_line],
    ...output.clues.map((c, i): [string, string] => [`clues.${i}.text`, c.text]),
    ...output.options.map((o, i): [string, string] => [`options.${i}.result_line`, o.result_line]),
  ];
  for (const [field, text] of described) {
    for (const group of forbidden) {
      const hit = text.match(group.pattern);
      if (hit) issues.push(`${field}: "${hit[0]}" describes ${group.name}, which is not an allowed symptom at this stage.`);
    }
    const gravity = text.match(GRAVITY_WATER);
    if (gravity) issues.push(`${field}: "${gravity[0]}" cannot happen in microgravity; water clings to surfaces.`);
  }

  const seen: [string, string][] = [
    ['scene', output.scene],
    ['plant_line', output.plant_line],
    ...output.clues.map((c, i): [string, string] => [`clues.${i}.text`, c.text]),
  ];
  const cause = CAUSE_WORDS[candidate.crisis_id];
  for (const [field, text] of seen) {
    const setting = text.match(SETTING_WORDS);
    if (setting) issues.push(`${field}: "${setting[0]}" names a setting or reading, which hints at the answer.`);
    const causeHit = cause && text.match(cause.pattern);
    if (causeHit) issues.push(`${field}: "${causeHit[0]}" names the cause.`);
  }

  output.options.forEach((option, i) => {
    const hint = option.label.match(LABEL_HINT);
    if (hint) issues.push(`options.${i}.label: "${hint[0]}" hints at the answer.`);
    const action = candidate.actions.find((a) => a.action_id === option.action_id);
    const keys = action ? actionKeyWords(action.name) : [];
    if (action && keys.length > 0 && !keys.some((k) => k.pattern.test(option.label))) {
      const words = keys.flatMap((k) => k.words).map((w) => `"${w}"`).join(' or ');
      issues.push(`options.${i}.label: "${option.label}" no longer names the action "${action.name}"; use the word ${words}.`);
    }
  });

  if (!FIRST_PERSON.test(output.plant_line)) {
    issues.push('plant_line: the lettuce speaks for itself, with I, me or my.');
  }
  // One line without I, me or my is fine (the reviewed stage 3 text has "Nothing
  // changed, and the soft spots feel worse."); two or more means a narrator.
  const narrated = output.options
    .map((o, i) => ({ i, line: o.result_line }))
    .filter(({ line }) => !FIRST_PERSON.test(line));
  if (narrated.length >= MAX_NARRATED_RESULT_LINES + 1) {
    for (const { i, line } of narrated) {
      issues.push(`options.${i}.result_line: "${line}" sounds like a narrator; the lettuce says it, with I, me or my.`);
    }
  }

  const allText: [string, string][] = [
    ...described,
    ...output.options.flatMap((o, i): [string, string][] => [
      [`options.${i}.label`, o.label],
      [`options.${i}.why`, o.why],
    ]),
  ];
  for (const [field, text] of allText) {
    const claim = text.match(SAFETY_CLAIM);
    if (claim) issues.push(`${field}: "${claim[0]}" is a safety or edibility claim.`);
    const wrong = text.match(WRONG_SETTING_FACTS);
    if (wrong) issues.push(`${field}: "${wrong[0]}" is wrong for Veggie, where plants grow in a clay substrate.`);
  }

  output.options.forEach((o, i) => {
    if (o.result_line.trim().length < MIN_RESULT_LINE) {
      issues.push(`options.${i}.result_line is too short; say in one sentence what changed for the plant.`);
    }
  });

  const tooLong = (field: string, text: string, max: number) => {
    if (text.length > max) issues.push(`${field} is ${text.length} characters; at most ${max}.`);
  };
  tooLong('scene', output.scene, MAX_LENGTH.scene);
  tooLong('plant_line', output.plant_line, MAX_LENGTH.plant_line);
  output.clues.forEach((c, i) => tooLong(`clues.${i}.text`, c.text, MAX_LENGTH.clue));
  output.options.forEach((o, i) => {
    tooLong(`options.${i}.label`, o.label, MAX_LENGTH.label);
    tooLong(`options.${i}.result_line`, o.result_line, MAX_LENGTH.result_line);
    tooLong(`options.${i}.why`, o.why, MAX_LENGTH.why);
  });

  return issues;
}

/**
 * Scene and plant line copied from the style example. Copying is not wrong in
 * content (the example is reviewed text), but every run then reads the same:
 * two of three overwater stage 1 runs in the fourth log opened with the
 * example's scene sentence.
 */
export function checkCopying(output: AiCrisisOutput, example: StyleExample | undefined): string[] {
  if (!example) return [];
  const source = new Set<string>();
  // Clues are left out: "fuzzy growth covers parts of the leaves and stems" is
  // simply how that symptom is said, and a scene may say it too.
  for (const text of [example.scene, example.plant_line]) {
    for (const run of wordRuns(text)) source.add(run);
  }
  const issues: string[] = [];
  for (const [field, text] of [['scene', output.scene], ['plant_line', output.plant_line]] as const) {
    const copied = wordRuns(text).find((run) => source.has(run));
    if (copied) issues.push(`${field}: "${copied}" is copied from the example; write it in new words.`);
  }
  return issues;
}

function wordRuns(text: string): string[] {
  const words = text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z']+/g, ' ').trim().split(' ').filter(Boolean);
  const runs: string[] = [];
  for (let i = 0; i + COPY_RUN <= words.length; i++) runs.push(words.slice(i, i + COPY_RUN).join(' '));
  return runs;
}

/**
 * Structure problems that validateAiOutput would also reject, checked here so
 * the model can fix them in a rewrite instead of losing the attempt.
 */
export function checkStructure(output: AiCrisisOutput, candidate: GenerationCandidate): string[] {
  const issues: string[] = [];
  const symptomIds = output.clues.map((c) => c.symptom_id);
  for (const id of new Set(symptomIds)) {
    if (symptomIds.filter((s) => s === id).length > 1) issues.push(`clues: symptom_id "${id}" is used more than once.`);
  }
  const actionIds = output.options.map((o) => o.action_id);
  for (const id of new Set(actionIds)) {
    if (actionIds.filter((a) => a === id).length > 1) issues.push(`options: action_id "${id}" is used more than once.`);
  }
  const appropriate = candidate.actions.filter((a) => a.verdict === 'appropriate').map((a) => a.action_id);
  if (!actionIds.some((id) => appropriate.includes(id))) {
    issues.push(`options: include the appropriate action (${appropriate.join(', ')}).`);
  }
  const lines = output.options.map((o) => o.result_line.trim().toLowerCase().replace(/\s+/g, ' '));
  if (new Set(lines).size < lines.length) {
    issues.push('options: two result_line texts are the same; each option needs its own.');
  }
  if (output.clues.length < candidate.clues_min) {
    issues.push(`clues: write at least ${candidate.clues_min}.`);
  }
  return issues;
}
