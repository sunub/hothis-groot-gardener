import { describe, expect, it } from 'vitest';
import { eventList } from '@/lib/events';
import { conditionHolds, findEventAction, findTimelineEvent, gameDayOn, trackEntriesOn } from '@/lib/events/judge';
import { plantStateSchema } from './schemas';
import { TIMELINE_FIXTURES } from './fixtures';

/**
 * The fixtures are what the screens are built against, so they must be states
 * the event list and the judgement rules allow.
 */
describe('timeline fixtures', () => {
  it('have unique ids', () => {
    const ids = TIMELINE_FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const fixture of TIMELINE_FIXTURES) {
    const { timeline } = fixture;

    describe(fixture.id, () => {
      it('has a valid plant state and day', () => {
        expect(plantStateSchema.safeParse(fixture.plant).success).toBe(true);
        expect(timeline.cultivation_day).toBeGreaterThanOrEqual(0);
        expect(timeline.cultivation_day).toBeLessThanOrEqual(33);
      });

      it('has a status that fits the pending event and the day', () => {
        expect(timeline.status === 'event').toBe(timeline.pending_event !== null);
        if (timeline.status === 'milestone') expect(gameDayOn(timeline.cultivation_day)).not.toBeNull();
      });

      it('plans exactly the conditional events of the list', () => {
        expect(timeline.event_plan.map((p) => p.event_id)).toEqual(
          eventList.events.filter((e) => e.kind === 'conditional').map((e) => e.event_id),
        );
      });

      it('refers only to events, actions and flags of the list', () => {
        const knownFlags = new Set(
          eventList.events.flatMap((e) => (e.kind === 'conditional' ? (e.on_occur?.set_flags ?? []) : [])),
        );
        for (const flag of timeline.flags) expect(knownFlags.has(flag), flag).toBe(true);
        for (const id of timeline.occurred_event_ids) expect(findTimelineEvent(eventList, id), id).toBeDefined();
        const pending = timeline.pending_event;
        if (pending) {
          const event = findTimelineEvent(eventList, pending.event_id);
          expect(event?.kind).toBe(pending.kind);
          if (!event || event.kind === 'crisis') throw new Error('pending event is not a card event');
          expect(pending.cultivation_day).toBe(timeline.cultivation_day);
          expect(timeline.occurred_event_ids).toContain(pending.event_id);
          for (const id of pending.offered_action_ids) expect(findEventAction(event, id), id).toBeDefined();
          if (event.kind === 'conditional') expect(conditionHolds(event.condition, fixture.plant)).toBe(true);
        }
      });

      it('has a log in day order that matches the list', () => {
        const days = timeline.log.map((entry) => entry.cultivation_day);
        expect(days).toEqual([...days].sort((a, b) => a - b));
        for (const entry of timeline.log) {
          expect(entry.cultivation_day).toBeLessThanOrEqual(timeline.cultivation_day);
          if (entry.type === 'milestone') expect(gameDayOn(entry.cultivation_day)).toBe(entry.game_day);
          if (entry.type === 'track') {
            const keys = trackEntriesOn(eventList, entry.cultivation_day).map((e) => e.entry_key);
            expect(keys).toContain(entry.entry_key);
          }
          if (entry.type === 'event') {
            const event = findTimelineEvent(eventList, entry.event_id);
            if (!event || event.kind === 'crisis') throw new Error(`${entry.event_id} is not a card event`);
            expect(entry.cultivation_day).toBeGreaterThanOrEqual(event.window.from);
            expect(entry.cultivation_day).toBeLessThanOrEqual(event.window.to);
            if (entry.response) {
              const action = findEventAction(event, entry.response.action_id);
              expect(action?.verdict).toBe(entry.response.verdict);
              expect(action?.op).toBe(entry.response.op);
              expect(action?.effect).toEqual(entry.response.effect);
            } else {
              expect(timeline.pending_event?.event_id).toBe(entry.event_id);
            }
          }
        }
      });
    });
  }
});
