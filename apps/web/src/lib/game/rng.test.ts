import { describe, expect, it } from 'vitest';
import { nextRandom, toRngState } from './rng';

function sequence(seed: number, length: number): number[] {
  const values: number[] = [];
  let state = seed;
  for (let i = 0; i < length; i++) {
    const step = nextRandom(state);
    values.push(step.value);
    state = step.state;
  }
  return values;
}

describe('seeded generator', () => {
  it('gives the same sequence for the same seed', () => {
    expect(sequence(12345, 20)).toEqual(sequence(12345, 20));
  });

  it('gives different sequences for different seeds', () => {
    expect(sequence(1, 5)).not.toEqual(sequence(2, 5));
  });

  it('draws values in [0, 1)', () => {
    for (const value of sequence(987654321, 5000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('keeps the state an unsigned 32-bit integer', () => {
    let state = 0xffffffff;
    for (let i = 0; i < 100; i++) {
      state = nextRandom(state).state;
      expect(Number.isInteger(state)).toBe(true);
      expect(state).toBeGreaterThanOrEqual(0);
      expect(state).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('chains: the returned state continues the sequence', () => {
    const first = nextRandom(42);
    const second = nextRandom(first.state);
    expect(sequence(42, 2)).toEqual([first.value, second.value]);
  });

  it('is roughly uniform', () => {
    const values = sequence(2026, 10000);
    const below = values.filter((v) => v < 0.3).length / values.length;
    expect(below).toBeGreaterThan(0.27);
    expect(below).toBeLessThan(0.33);
  });

  it('normalizes negative and fractional seeds', () => {
    expect(toRngState(-1)).toBe(0xffffffff);
    expect(toRngState(7.9)).toBe(7);
  });
});
