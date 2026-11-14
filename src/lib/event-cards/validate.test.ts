import { describe, expect, it } from 'vitest';
import type { EventCardOutput } from '@/lib/contract/schemas';
import { eventList, findTimelineEvent, type CardEvent } from '@/lib/events';
import { getPremadeEventCard } from './premade';
import { validateEventCardOutput } from './validate';

const event = findTimelineEvent(eventList, 'thinning') as CardEvent;
const offeredActionIds = ['thin_to_one', 'keep_both', 'water_heavy_instead'];
const context = { event, offeredActionIds };

function output(): EventCardOutput {
  return structuredClone(getPremadeEventCard('thinning', offeredActionIds)!);
}

function issuesOf(value: unknown): string[] {
  const result = validateEventCardOutput(value, context);
  return result.ok ? [] : result.issues;
}

describe('validateEventCardOutput', () => {
  it('accepts the pre-made text', () => {
    expect(validateEventCardOutput(output(), context).ok).toBe(true);
  });

  it('accepts the offered actions in another order', () => {
    const value = output();
    value.options.reverse();
    expect(validateEventCardOutput(value, context).ok).toBe(true);
  });

  it('rejects a bad shape', () => {
    expect(issuesOf({ event_id: 'thinning', scene: 'Only a scene.' })[0]).toMatch(/^shape:/);
  });

  it('rejects another event id', () => {
    expect(issuesOf({ ...output(), event_id: 'wick_opening' })).toHaveLength(1);
  });

  it('rejects an extra, a missing, a foreign or a repeated action', () => {
    const value = output();
    const extra = { ...value, options: [...value.options, { ...value.options[0], action_id: 'open_wicks' }] };
    expect(issuesOf(extra).join(' ')).toMatch(/"open_wicks" is not offered/);

    expect(issuesOf({ ...value, options: value.options.slice(0, 2) }).join(' ')).toMatch(
      /"water_heavy_instead" has no option/,
    );

    const foreign = { ...value, options: [...value.options.slice(0, 2), { ...value.options[2], action_id: 'fan_high' }] };
    expect(issuesOf(foreign).join(' ')).toMatch(/"fan_high" is not offered/);

    const repeated = { ...value, options: [value.options[0], value.options[0], value.options[1]] };
    expect(issuesOf(repeated).join(' ')).toMatch(/more than one option/);
  });

  it('rejects a label that gives the verdict away', () => {
    const value = output();
    value.options[0].label = 'The recommended step: thin the pillow';
    expect(issuesOf(value).join(' ')).toMatch(/options\[0\]\.label gives the verdict away/);
  });

  it.each(['scene', 'plant_line', 'label', 'result_line', 'why'] as const)(
    'rejects a banned claim in %s',
    (field) => {
      const value = output();
      const claim = 'The leaves are edible.';
      if (field === 'scene' || field === 'plant_line') value[field] = claim;
      else value.options[1][field] = claim;
      expect(issuesOf(value).join(' ')).toMatch(/banned safety claim/);
    },
  );
});
