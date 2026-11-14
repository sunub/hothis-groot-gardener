/**
 * Planning document, "수확 후 미생물 평가 > 말하지 않는 것": the product never
 * says the harvest is safe, passed, or can be eaten. One list for every text
 * the product shows: screen strings and the evidence list (checked in
 * src/lib/i18n/strings.test.ts) and generated crisis text (checked at run
 * time by validateAiOutput). English patterns only.
 */

/** Phrases that state a safety or approval verdict wherever they appear. */
export const FORBIDDEN_CLAIM_PATTERNS: readonly RegExp[] = [
  /\bedible\b/i,
  /\bsafe to eat\b/i,
  /\bok to eat\b/i,
  /\bcan be eaten\b/i,
  /\bpass(ed|es)?\b/i,
  /\bapproved\b/i,
  /\bcertified\b/i,
];

/** "safe" may appear only in a sentence that denies a safety conclusion. */
export const SAFE_PATTERN = /\bsafe(ty)?\b/i;
/** A denial before "safe" in the same sentence. */
export const SAFE_DENIAL_PATTERN = /\b(not|never|no|cannot|without)\b[^.]*\bsafe(ty)?\b/i;

/** Every banned claim in `text`, as a short description. Empty when the text is clean. */
export function findBannedClaims(text: string): string[] {
  const found: string[] = [];
  for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
    if (pattern.test(text)) found.push(String(pattern));
  }
  if (SAFE_PATTERN.test(text) && !SAFE_DENIAL_PATTERN.test(text)) {
    found.push('"safe" without a denial');
  }
  return found;
}
