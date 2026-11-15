/**
 * Planning document, "수확 후 미생물 평가 > 말하지 않는 것": the product never
 * says the harvest is safe, passed, or can be eaten. One list for every text
 * the product shows: screen strings and the evidence list (checked in
 * src/lib/i18n/strings.test.ts) and generated crisis text (checked at run
 * time by validateAiOutput). English and Korean patterns.
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
  // Korean: edible, passed, approved, certified.
  /먹어도\s*(됩|돼|되|좋|괜찮)/,
  /(섭취|식용)[^.。!?]*(가능|해도|할\s*수\s*있|적합)/,
  /통과/,
  /합격/,
  /승인/,
  /인증\s*(됨|됐|되었|받|완료)/,
  /적합\s*판정/,
];

/** "safe" may appear only in a sentence that denies a safety conclusion. */
export const SAFE_PATTERN = /\bsafe(ty)?\b/i;
/** A denial before "safe" in the same sentence. */
export const SAFE_DENIAL_PATTERN = /\b(not|never|no|cannot|without)\b[^.]*\bsafe(ty)?\b/i;

/** Korean "safe": 안전. Allowed only in a sentence that denies a safety conclusion. */
export const SAFE_PATTERN_KO = /안전/;
/** A denial after 안전 in the same sentence ("안전하다는 뜻은 아닙니다", "안전을 보장하지 않습니다"). */
export const SAFE_DENIAL_PATTERN_KO =
  /안전[^.。!?]*(아닙니다|아니다|아니에요|않|없|못|말할\s*수\s*없)/;

/** True when `text` says "safe" (English or Korean) in a sentence that does not deny it. */
export function hasUndeniedSafe(text: string): boolean {
  if (SAFE_PATTERN.test(text) && !SAFE_DENIAL_PATTERN.test(text)) return true;
  return SAFE_PATTERN_KO.test(text) && !SAFE_DENIAL_PATTERN_KO.test(text);
}

/** Every banned claim in `text`, as a short description. Empty when the text is clean. */
export function findBannedClaims(text: string): string[] {
  const found: string[] = [];
  for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
    if (pattern.test(text)) found.push(String(pattern));
  }
  if (hasUndeniedSafe(text)) {
    found.push('"safe" without a denial');
  }
  return found;
}
