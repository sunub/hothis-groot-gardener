import { describe, expect, it } from 'vitest';
import evidence from '@content/evidence.json';
import {
  FORBIDDEN_CLAIM_PATTERNS,
  hasUndeniedSafe,
} from '@/lib/contract/claims';
import { en } from './en';
import { ko } from './ko';

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

function violations(strings: [string, string][]): string[] {
  const found: string[] = [];
  for (const [path, text] of strings) {
    for (const pattern of FORBIDDEN) {
      if (pattern.test(text)) found.push(`${path}: ${pattern} in "${text}"`);
    }
    if (hasUndeniedSafe(text)) {
      found.push(`${path}: "safe" without a denial in "${text}"`);
    }
  }
  return found;
}

describe('no safety verdict in any text', () => {
  it.each([
    ['en', en],
    ['ko', ko],
  ] as const)('%s screen text never says safe, passed or edible', (name, dictionary) => {
    const strings: [string, string][] = [];
    collectStrings(dictionary, name, strings);
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

describe('ko dictionary matches en', () => {
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it('has the same keys and the same {placeholders} in every string', () => {
    const english: [string, string][] = [];
    const korean: [string, string][] = [];
    collectStrings(en, '', english);
    collectStrings(ko, '', korean);
    expect(korean.map(([path]) => path)).toEqual(english.map(([path]) => path));
    const mismatched = english
      .map(([path, text], i) => ({ path, en: placeholders(text), ko: placeholders(korean[i][1]) }))
      .filter((row) => row.en.join() !== row.ko.join());
    expect(mismatched).toEqual([]);
  });

  it('leaves no string empty unless English is empty too', () => {
    const english: [string, string][] = [];
    const korean: [string, string][] = [];
    collectStrings(en, '', english);
    collectStrings(ko, '', korean);
    const empty = korean.filter(([, text], i) => text === '' && english[i][1] !== '').map(([path]) => path);
    expect(empty).toEqual([]);
  });
});
