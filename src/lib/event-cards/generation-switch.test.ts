import { describe, expect, it } from 'vitest';
import { eventCardGenerationEnabled } from './generation-switch';

describe('eventCardGenerationEnabled', () => {
  it.each(['on', 'ON', 'On', 'true', 'TRUE', 'True', '1', '  on  ', ' TRUE', '1 '])('is on for %j', (value) => {
    expect(eventCardGenerationEnabled(value)).toBe(true);
  });

  it.each([undefined, '', '   ', 'off', 'OFF', '0', 'no', 'yes', 'false', 'enabled', 'o n', '10'])(
    'is off for %j',
    (value) => {
      expect(eventCardGenerationEnabled(value)).toBe(false);
    },
  );
});
