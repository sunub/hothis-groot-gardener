import { describe, expect, it } from 'vitest';
import { eventList } from './index';
import { eventNamesKo, localizeEventList } from './localize';

const named = eventList.events.filter((e) => 'name' in e && e.name !== undefined);

describe('localizeEventList', () => {
  it('returns the same list for English', () => {
    expect(localizeEventList(eventList, 'en')).toBe(eventList);
  });

  it('has a Korean name for every named event and no other', () => {
    expect(Object.keys(eventNamesKo).sort()).toEqual(named.map((e) => e.event_id).sort());
  });

  it('renames only, and leaves the shared list unchanged', () => {
    const withoutName = (events: typeof eventList.events) =>
      events.map((e) => {
        const { name, ...rest } = e as typeof e & { name?: string };
        void name;
        return rest;
      });
    const ko = localizeEventList(eventList, 'ko');
    expect(withoutName(ko.events)).toEqual(withoutName(eventList.events));
    for (const e of ko.events) if ('name' in e && e.name !== undefined) expect(e.name).toMatch(/[가-힣]/);
    for (const e of named) if ('name' in e) expect(e.name).toMatch(/[A-Za-z]/);
  });
});
