import { describe, expect, it } from 'vitest';
import { AI_LABEL_MAX_LENGTH, type EventCardRequest } from '@/lib/contract/schemas';
import { eventList, findTimelineEvent, type CardEvent } from '@/lib/events';
import { INITIAL_PLANT_STATE, zoneOf } from '@/lib/game/rules';
import { buildEventCardGenerationInput } from './generator';

const request: EventCardRequest = {
  locale: 'en',
  cultivation_day: 10,
  state: { ...INITIAL_PLANT_STATE },
  event_id: 'fan_off_after_restart',
};
const event = findTimelineEvent(eventList, 'fan_off_after_restart') as CardEvent;

describe('buildEventCardGenerationInput', () => {
  it('carries the event, the offered actions in order and the state with zones', () => {
    const input = buildEventCardGenerationInput(request, event, 'Name', ['keep_observing', 'check_fan_running']);
    expect(input.event).toEqual({
      event_id: 'fan_off_after_restart',
      kind: 'conditional',
      name: 'Name',
      summary: event.summary,
      scene_hint: event.scene_hint,
    });
    expect(input.actions).toEqual([
      { action_id: 'keep_observing', op: 'keep_observing', verdict: 'inappropriate' },
      { action_id: 'check_fan_running', op: 'check_fan_running', verdict: 'appropriate' },
    ]);
    expect(input.state.root_moisture).toEqual({
      value: INITIAL_PLANT_STATE.root_moisture,
      zone: zoneOf('root_moisture', INITIAL_PLANT_STATE.root_moisture),
    });
    expect(input.limits).toMatchObject({ options: 2, label_max_length: AI_LABEL_MAX_LENGTH });
    // No effect numbers reach the generator; they are attached afterwards.
    expect(JSON.stringify(input)).not.toContain('effect');
  });

  it('throws for an action that is not in the event', () => {
    expect(() => buildEventCardGenerationInput(request, event, 'Name', ['open_wicks'])).toThrow();
  });
});
