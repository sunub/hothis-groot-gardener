import { describe, expect, it } from 'vitest';
import {
  initialPlayback,
  msPerDay,
  playbackReducer,
  SKIP_MS_PER_DAY,
  type PlaybackState,
  type Stop,
} from './playback';

const STOPS: Stop[] = [
  { cultivation_day: 3, kind: 'event' },
  { cultivation_day: 6, kind: 'milestone' },
];

function run(state: PlaybackState, ...actions: Parameters<typeof playbackReducer>[1][]): PlaybackState {
  return actions.reduce(playbackReducer, state);
}

const start = initialPlayback({ day: 1, lastDay: 33, stops: STOPS });

describe('speed', () => {
  it('takes 2 seconds a day at 1× and halves with each step', () => {
    expect([1, 2, 4, 8].map((speed) => msPerDay({ ...start, speed: speed as PlaybackState['speed'] }))).toEqual([
      2000, 1000, 500, 250,
    ]);
  });

  it('runs at the skip pace while moving to the next stop, whatever the speed', () => {
    const skipping = run(start, { type: 'skip_to_next' });
    expect(msPerDay(skipping)).toBe(SKIP_MS_PER_DAY);
  });
});

describe('ticks', () => {
  it('moves one cultivation day per tick only while playing', () => {
    expect(run(start, { type: 'tick' }).day).toBe(1);
    expect(run(start, { type: 'play' }, { type: 'tick' }).day).toBe(2);
  });

  it('stops on a day with an event and says why', () => {
    const s = run(start, { type: 'play' }, { type: 'tick' }, { type: 'tick' });
    expect(s).toMatchObject({ day: 3, playing: false, stopped: { cultivation_day: 3, kind: 'event' } });
    // Play does nothing until the stop is resolved; time stays stopped.
    expect(run(s, { type: 'play' }, { type: 'tick' }).day).toBe(3);
  });

  it('moves on after the stop is resolved', () => {
    const s = run(start, { type: 'play' }, { type: 'tick' }, { type: 'tick' }, { type: 'resolve_stop' });
    expect(s).toMatchObject({ day: 3, playing: true, stopped: null });
    expect(run(s, { type: 'tick' }).day).toBe(4);
  });

  it('stops at the last day', () => {
    const s = run(initialPlayback({ day: 32, lastDay: 33, stops: [] }), { type: 'play' }, { type: 'tick' }, { type: 'tick' });
    expect(s).toMatchObject({ day: 33, playing: false, finished: true });
  });
});

describe('skip to the next stop', () => {
  it('targets the next stop day and clears the target when it stops there', () => {
    const skipping = run(start, { type: 'skip_to_next' });
    expect(skipping).toMatchObject({ playing: true, target: 3 });
    const arrived = run(skipping, { type: 'tick' }, { type: 'tick' });
    expect(arrived).toMatchObject({ day: 3, playing: false, target: null, stopped: { kind: 'event' } });
  });

  it('does nothing while time is stopped or when no stop is left', () => {
    const stopped = run(start, { type: 'play' }, { type: 'tick' }, { type: 'tick' });
    expect(run(stopped, { type: 'skip_to_next' })).toEqual(stopped);
    const none = initialPlayback({ day: 7, lastDay: 33, stops: STOPS });
    expect(run(none, { type: 'skip_to_next' }).target).toBe(33);
  });

  it('is cancelled by pause', () => {
    expect(run(start, { type: 'skip_to_next' }, { type: 'pause' })).toMatchObject({ playing: false, target: null });
  });
});

describe('speed changes', () => {
  it('keep playing and only accept the four steps', () => {
    const s = run(start, { type: 'play' }, { type: 'set_speed', speed: 4 });
    expect(s).toMatchObject({ playing: true, speed: 4 });
  });
});

describe('stops already passed', () => {
  it('a stop on the start day counts as already handled', () => {
    const s = run(initialPlayback({ day: 3, lastDay: 33, stops: STOPS }), { type: 'play' }, { type: 'tick' });
    expect(s.day).toBe(4);
  });
});
