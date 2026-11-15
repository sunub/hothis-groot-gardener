import { describe, expect, it } from 'vitest';
import { FIXTURE_SCHEDULED_EVENT } from '@/lib/contract/fixtures';
import { eventCardResponseSchema, type EventCardResponse } from '@/lib/contract/schemas';
import { en } from '@/lib/i18n/en';
import { buildEventCardRequest, effectRows, outcomeOf, toEventCardView } from './view';

const response: EventCardResponse = eventCardResponseSchema.parse({
  event_id: 'thinning',
  kind: 'scheduled',
  name: 'Thin to one plant per pillow',
  cultivation_day: 7,
  scene: 'Two seedlings share one pillow.',
  plant_line: 'It feels crowded down here.',
  options: [
    {
      action_id: 'thin_to_one',
      op: 'thin_to_one',
      label: 'Thin the pillow to one seedling',
      result_line: 'I have the pillow to myself now.',
      why: 'The recorded procedure is to thin the seedlings.',
      verdict: 'appropriate',
      effect: { plant_health: 2 },
      value_type: 'game_value',
    },
    {
      action_id: 'keep_both',
      op: 'do_nothing',
      label: 'Leave both seedlings in the pillow',
      result_line: 'We are still crowding each other.',
      why: 'No source measures the effect of skipping thinning.',
      verdict: 'inappropriate',
      effect: { plant_health: -3 },
      value_type: 'game_value',
    },
  ],
  summary: 'Each pillow was thinned to one plant on day 7.',
  source_chunks: ['veggie-seed-wicks-thinning'],
  draft: true,
  origin: 'fallback',
});

describe('toEventCardView', () => {
  it('keeps only what may be shown before the choice', () => {
    const view = toEventCardView(response);
    expect(view).toEqual({
      cultivation_day: 7,
      scene: 'Two seedlings share one pillow.',
      plant_line: 'It feels crowded down here.',
      labels: ['Thin the pillow to one seedling', 'Leave both seedlings in the pillow'],
      origin: 'fallback',
    });
    // The name gives the answer away; verdicts, reasons and effects come after the choice.
    const text = JSON.stringify(view);
    for (const hidden of ['Thin to one plant', 'appropriate', 'procedure', 'plant_health', 'thin_to_one', 'thinned']) {
      expect(text).not.toContain(hidden);
    }
  });
});

describe('outcomeOf', () => {
  it('reveals the chosen option, the event name and the record', () => {
    expect(outcomeOf(response, 1)).toEqual({
      action_id: 'keep_both',
      name: 'Thin to one plant per pillow',
      label: 'Leave both seedlings in the pillow',
      verdict: 'inappropriate',
      result_line: 'We are still crowding each other.',
      why: 'No source measures the effect of skipping thinning.',
      effect: { plant_health: -3 },
      summary: 'Each pillow was thinned to one plant on day 7.',
      origin: 'fallback',
    });
  });

  it('returns null for a position that is not an option', () => {
    expect(outcomeOf(response, 5)).toBeNull();
  });
});

describe('effectRows', () => {
  it('lists each changed number, the fan setting and a resolved problem in a fixed order', () => {
    const rows = effectRows({ clear_flags: ['fan_actually_off'], fan: 'high', humidity: -5, plant_health: 2 }, en);
    expect(rows).toEqual([
      { key: 'plant_health', label: 'Plant health', value: '+2' },
      { key: 'humidity', label: 'Chamber humidity', value: '−5' },
      { key: 'fan', label: 'Fan', value: 'Set to High' },
      { key: 'clear_flags', label: 'Underlying problem', value: 'Resolved' },
    ]);
  });

  it('says so when nothing changes', () => {
    expect(effectRows({}, en)).toEqual([
      { key: 'none', label: 'What this action changes', value: 'No number changes', unchanged: true },
    ]);
  });
});

describe('buildEventCardRequest', () => {
  it('asks for the pending event with the offered actions in their order', () => {
    const { plant, timeline } = FIXTURE_SCHEDULED_EVENT;
    expect(buildEventCardRequest(timeline.pending_event!, plant, 'en')).toEqual({
      locale: 'en',
      cultivation_day: 3,
      state: plant,
      event_id: 'wick_opening',
      offered_action_ids: ['open_wicks', 'water_heavy_instead', 'do_nothing'],
    });
  });
});
