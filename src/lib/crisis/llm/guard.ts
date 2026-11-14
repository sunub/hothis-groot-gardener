import type { AiCrisisOutput } from '@/lib/contract/types';
import type { GenerationCandidate } from '../generator';

/**
 * Wording checks for generated text, on top of validateAiOutput.
 * validateAiOutput checks ids and counts; these catch what small models
 * tend to get wrong in the words themselves (implementation notes, entry 35):
 *
 * 1. Symptoms that are not allowed at this stage ("wilting" in a water
 *    shortage, whose recorded symptoms do not include wilting; "mold" at stage 1).
 * 2. Labels that hint at the answer ("the best option", "you should").
 * 3. A plant line that names the cause.
 * 4. Text far longer than the format asks for.
 *
 * A failed check counts as a failed attempt: the pipeline retries once and
 * then shows the pre-made crisis.
 */

interface SymptomGroup {
  name: string;
  pattern: RegExp;
}

/** Symptom words a model may invent. A group is allowed only when an allowed symptom name matches it. */
export const SYMPTOM_GROUPS: SymptomGroup[] = [
  { name: 'wilting', pattern: /\b(wilt\w*|droop\w*|limp\w*|sag(s|ged|ging)?|flop\w*|floppy)\b/i },
  { name: 'fungus', pattern: /\b(molds?|mouldy?|moldy|mildew\w*|fung\w*|mycel\w*|spores?)\b/i },
  { name: 'rot', pattern: /\b(rot|rots|rotting|rotten|decay\w*|mush\w*)\b/i },
  // "spots" is not listed: the reviewed rot text uses "soft spots".
  { name: 'discoloration', pattern: /\b(yellow\w*|brown\w*|chloro\w*|necro\w*|blacken\w*|blotch\w*)\b/i },
  { name: 'curling', pattern: /\b(curl\w*|epinast\w*)\b/i },
  { name: 'burn', pattern: /\b(scorch\w*|burn\w*|sunburn\w*)\b/i },
  { name: 'death', pattern: /\b(dies|died|dying|dead|death)\b/i },
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

/** Per crisis: words in the plant line that would name the cause. */
export const CAUSE_WORDS: Record<string, RegExp> = {
  water_shortage: /\b(water(ing)?|thirst\w*|reservoir|drink\w*|dehydrat\w*)\b/i,
  overwater_mold: /\b(overwater\w*|too much water|fan|air ?flow|ventilat\w*|stagnant)\b/i,
};

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
  }

  const seen: [string, string][] = [
    ['scene', output.scene],
    ['plant_line', output.plant_line],
    ...output.clues.map((c, i): [string, string] => [`clues.${i}.text`, c.text]),
  ];
  for (const [field, text] of seen) {
    const setting = text.match(SETTING_WORDS);
    if (setting) issues.push(`${field}: "${setting[0]}" names a setting or reading, which hints at the answer.`);
  }

  output.options.forEach((option, i) => {
    const hint = option.label.match(LABEL_HINT);
    if (hint) issues.push(`options.${i}.label: "${hint[0]}" hints at the answer.`);
  });

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
  }

  const cause = CAUSE_WORDS[candidate.crisis_id];
  const causeHit = cause && output.plant_line.match(cause);
  if (causeHit) issues.push(`plant_line: "${causeHit[0]}" names the cause.`);

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
