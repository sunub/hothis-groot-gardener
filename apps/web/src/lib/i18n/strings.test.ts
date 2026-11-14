import { describe, expect, it } from 'vitest';
import evidence from '@content/evidence.json';
import {
  FORBIDDEN_CLAIM_PATTERNS,
  SAFE_DENIAL_PATTERN,
  SAFE_PATTERN,
} from '@/lib/contract/claims';
import { en } from './en';

/**
 * Planning document, "수확 후 미생물 평가 > 말하지 않는 것": the product never
 * says the harvest is safe, passed, or can be eaten. This test reads every
 * string shown on screen and every string in the evidence list.
 */

function collectStrings(value: unknown, path: string, out: [string, string][]): void {
  if (typeof value === 'string') {
    out.push([path, value]);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectStrings(child, path ? `${path}.${key}` : key, out);
    }
  }
}

// Shared with the generated-text check, so screen text and generated text follow one list.
const FORBIDDEN = FORBIDDEN_CLAIM_PATTERNS;
const SAFE = SAFE_PATTERN;
const SAFE_DENIAL = SAFE_DENIAL_PATTERN;

function violations(strings: [string, string][]): string[] {
  const found: string[] = [];
  for (const [path, text] of strings) {
    for (const pattern of FORBIDDEN) {
      if (pattern.test(text)) found.push(`${path}: ${pattern} in "${text}"`);
    }
    if (SAFE.test(text) && !SAFE_DENIAL.test(text)) {
      found.push(`${path}: "safe" without a denial in "${text}"`);
    }
  }
  return found;
}

describe('no safety verdict in any text', () => {
  it('screen text never says safe, passed or edible', () => {
    const strings: [string, string][] = [];
    collectStrings(en, 'en', strings);
    expect(strings.length).toBeGreaterThan(0);
    expect(violations(strings)).toEqual([]);
  });

  it('evidence list text written by the team never says safe, passed or edible', () => {
    const strings: [string, string][] = [];
    collectStrings(evidence, 'evidence', strings);
    // Quotes are verbatim source sentences; they are shown as quotes, not as the product's claim.
    const own = strings.filter(([path]) => !path.endsWith('.quote') && !path.endsWith('.title'));
    expect(violations(own)).toEqual([]);
  });
});
