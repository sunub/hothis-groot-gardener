import { describe, expect, it } from 'vitest';
import { FIXTURE_CONDITIONAL_EVENT, FIXTURE_MILESTONE } from '@/lib/contract/fixtures';
import type { PlantState } from '@/lib/contract/types';
import { eventList } from '@/lib/events';
import { diaryLines } from './diary';
import { frameOn, growthStageOnDay, zoneChanges, type TimelineFrame } from './frames';

function plant(health: number, root: number, humidity: number): PlantState {
  return { plant_health: health, root_moisture: root, humidity, fan: 'low', light: { red: 'medium', blue: 'medium' } };
}

describe('frames', () => {
  it('reads the growth stage of the last game day on or before a cultivation day', () => {
    expect([0, 1, 5, 6, 11, 12, 27, 28, 33].map(growthStageOnDay)).toEqual([
      'germination',
      'germination',
      'germination',
      'germination',
      'germination',
      'growth',
      'growth',
      'pre_harvest',
      'harvest',
    ]);
  });

  it('finds zone changes between two days', () => {
    expect(zoneChanges(plant(70, 45, 60), plant(70, 38, 60))).toEqual([
      { metric: 'root_moisture', from: 'normal', to: 'caution_low' },
    ]);
    expect(zoneChanges(plant(70, 45, 60), plant(65, 44, 61))).toEqual([]);
  });

  it('falls back to the closest earlier frame', () => {
    const frames: TimelineFrame[] = [
      { cultivation_day: 1, plant: plant(70, 55, 55) },
      { cultivation_day: 4, plant: plant(70, 45, 60) },
    ];
    expect(frameOn(frames, 3)?.cultivation_day).toBe(1);
    expect(frameOn(frames, 9)?.cultivation_day).toBe(4);
    expect(frameOn(frames, 0)).toBeNull();
  });
});

describe('diaryLines', () => {
  const { timeline } = FIXTURE_MILESTONE;

  it('lists only lines up to the shown day, newest first', () => {
    const lines = diaryLines(timeline.log, [], 7, eventList);
    expect(lines.every((l) => l.day <= 7)).toBe(true);
    expect(lines[0].day).toBe(7);
    expect(lines.at(-1)).toMatchObject({ kind: 'game_day', day: 1, game_day: 1 });
  });

  it('shows the event name only after the player answered', () => {
    const answered = diaryLines(timeline.log, [], 12, eventList).find((l) => l.kind === 'event' && l.day === 7);
    expect(answered).toMatchObject({ name: 'Thin to one plant per pillow', verdict: 'partial', tone: 'mixed' });

    const pending = diaryLines(FIXTURE_CONDITIONAL_EVENT.timeline.log, [], 9, eventList).find(
      (l) => l.kind === 'event' && l.day === 9,
    );
    expect(pending).toMatchObject({ name: null, verdict: null });
  });

  it('marks experiment lines as recorded only when checked against the source', () => {
    const experiments = diaryLines(timeline.log, [], 12, eventList).filter((l) => l.kind === 'experiment');
    expect(experiments.length).toBeGreaterThan(0);
    for (const line of experiments) {
      if (line.kind !== 'experiment') continue;
      expect(line.text).not.toBe('');
      const entry = eventList.parallel_tracks
        .flatMap((t) => t.entries)
        .find((e) => e.text === line.text);
      expect(line.checked).toBe(entry?.source_check === 'checked');
    }
  });

  it('marks observation lines written from the plant state as game values', () => {
    const observations = diaryLines(timeline.log, [], 12, eventList).filter((l) => l.kind === 'observation');
    const find = (start: string) => observations.find((l) => l.kind === 'observation' && l.text.startsWith(start));
    // Lights were programmed on day 1 in every mission; sprouts coming up evenly depends on the state.
    expect(find('The lights were set')).toMatchObject({ from_state: false });
    expect(find('The sprouts are coming up evenly')).toMatchObject({ from_state: true });
  });

  it('adds a line when a metric moves into another zone', () => {
    const frames: TimelineFrame[] = [
      { cultivation_day: 9, plant: plant(70, 41, 60) },
      { cultivation_day: 10, plant: plant(70, 38, 60) },
    ];
    const zone = diaryLines([], frames, 10, eventList);
    expect(zone).toEqual([
      {
        kind: 'zone',
        key: 'zone-10-root_moisture',
        day: 10,
        tone: 'negative',
        metric: 'root_moisture',
        from: 'normal',
        to: 'caution_low',
      },
    ]);
    expect(diaryLines([], frames, 9, eventList)).toEqual([]);
  });
});
