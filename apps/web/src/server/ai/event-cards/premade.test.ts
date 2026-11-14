import { describe, expect, it } from 'vitest';
import { eventList } from '@/lib/events';
import { isCardEvent } from './pipeline';
import { getPremadeEventCard, premadeEventCards } from './premade';
import { validateEventCardOutput } from './validate';

const cardEvents = eventList.events.filter(isCardEvent);

describe('pre-made event cards', () => {
  it('cover exactly the card events of events.json, once each', () => {
    const ids = premadeEventCards.cards.map((c) => c.event_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(cardEvents.map((e) => e.event_id).sort());
    expect(cardEvents.map((e) => e.event_id).sort()).toEqual(
      ['fan_off_after_restart', 'mild_tip_burn', 'pillow_no_flow', 'thinning', 'wick_opening'].sort(),
    );
  });

  it.each(cardEvents.map((e) => [e.event_id, e] as const))(
    '%s passes validation with every action offered, options in list order',
    (_, event) => {
      const offeredActionIds = event.actions.map((a) => a.action_id);
      const entry = premadeEventCards.cards.find((c) => c.event_id === event.event_id);
      expect(entry?.options.map((o) => o.action_id)).toEqual(offeredActionIds);
      const result = validateEventCardOutput(entry, { event, offeredActionIds });
      expect(result).toEqual({ ok: true, value: entry });
    },
  );

  it('labels have at most 10 words', () => {
    for (const card of premadeEventCards.cards) {
      for (const option of card.options) {
        expect(option.label.split(/\s+/).length).toBeLessThanOrEqual(10);
      }
    }
  });

  it('cuts to the offered actions in the offered order and returns a copy', () => {
    const card = getPremadeEventCard('thinning', ['water_heavy_instead', 'thin_to_one']);
    expect(card?.options.map((o) => o.action_id)).toEqual(['water_heavy_instead', 'thin_to_one']);
    card!.options[0].label = 'changed';
    expect(getPremadeEventCard('thinning', ['water_heavy_instead'])?.options[0].label).not.toBe('changed');
  });

  it('returns null for an unknown event or an action without text', () => {
    expect(getPremadeEventCard('water_shortage', ['add_water_direct'])).toBeNull();
    expect(getPremadeEventCard('thinning', ['open_wicks'])).toBeNull();
  });
});
