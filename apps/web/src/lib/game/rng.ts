/**
 * Seeded random number generator (mulberry32). The generator state is a
 * single unsigned 32-bit integer, so it can be saved with the mission and the
 * same seed always gives the same sequence of crisis rolls.
 */

/** Result of one draw. */
export interface RandomStep {
  /** Uniform value in [0, 1). */
  value: number;
  /** Generator state to pass to the next call. */
  state: number;
}

/** Normalize any number to a valid generator state (unsigned 32-bit integer). */
export function toRngState(seed: number): number {
  return Math.trunc(seed) >>> 0;
}

/** Draw one value. Pure: the input state is not changed; use the returned state next time. */
export function nextRandom(state: number): RandomStep {
  const next = (toRngState(state) + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: next };
}
