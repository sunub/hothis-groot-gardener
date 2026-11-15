import koRaw from '@content/events.ko.json';
import type { EventList, Locale } from '@/lib/contract/types';

/** Korean event names (data/content/events.ko.json), keyed by event id. Everything else stays in events.json. */
export const eventNamesKo: Readonly<Record<string, string>> = koRaw.names;

/**
 * A copy of the list whose event names are in the given language. English
 * returns the list itself. An event without a Korean name keeps its English name.
 */
export function localizeEventList(
  list: EventList,
  locale: Locale,
  names: Readonly<Record<string, string>> = eventNamesKo,
): EventList {
  if (locale === 'en') return list;
  return {
    ...list,
    events: list.events.map((event) =>
      'name' in event && event.name !== undefined && names[event.event_id]
        ? { ...event, name: names[event.event_id] }
        : event,
    ),
  };
}
