import { z } from 'zod';
import raw from '@content/event-cards.json';
import rawKo from '@content/event-cards.ko.json';
import { eventCardOutputSchema, type EventCardOutput } from '@/lib/contract/schemas';
import type { Locale } from '@/lib/contract/types';

/**
 * Pre-made event card text (data/content/event-cards.json): used when no
 * generator is connected, and when generated text fails twice. One entry per
 * card event and language (English: event-cards.json, Korean: event-cards.ko.json).
 */

const premadeFileSchema = z.strictObject({
  meta: z.strictObject({
    description: z.string().trim().min(1),
    status: z.literal('draft'),
    ai_disclosure: z.string().trim().min(1),
  }),
  cards: z.array(eventCardOutputSchema),
});

/** Shape of data/content/event-cards.json. */
export type PremadeEventCardFile = z.infer<typeof premadeFileSchema>;

/** The parsed file. Parsing at load time turns a broken file into an immediate, clear error. */
export const premadeEventCards: PremadeEventCardFile = premadeFileSchema.parse(raw);

/** The Korean file, same shape. */
export const premadeEventCardsKo: PremadeEventCardFile = premadeFileSchema.parse(rawKo);

/**
 * Pre-made text for an event, cut to the offered actions in the offered
 * order. Returns null when the event has no entry or an offered action has
 * no text in it.
 */
export function getPremadeEventCard(
  eventId: string,
  offeredActionIds: readonly string[],
  locale: Locale = 'en',
): EventCardOutput | null {
  const file = locale === 'ko' ? premadeEventCardsKo : premadeEventCards;
  const entry = file.cards.find((card) => card.event_id === eventId);
  if (!entry) return null;
  const options: EventCardOutput['options'] = [];
  for (const id of offeredActionIds) {
    const option = entry.options.find((o) => o.action_id === id);
    if (!option) return null;
    options.push({ ...option });
  }
  // A copy, so callers never mutate the loaded file.
  return { event_id: entry.event_id, scene: entry.scene, plant_line: entry.plant_line, options };
}
