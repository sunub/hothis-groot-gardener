/**
 * Screen-side playback of cultivation days: pause, speed and "to the next stop".
 * Playback is a screen setting; it is not saved with the mission. It only
 * decides when the screen shows the next day. Which day holds an event or a
 * game day comes from the engine (ROLE-TASKS A1) as a list of stops.
 */

export const SPEEDS = [1, 2, 4, 8] as const;
export type Speed = (typeof SPEEDS)[number];

/** One cultivation day takes this long at 1×. 33 days take about a minute. */
export const MS_PER_DAY_AT_1X = 2000;
/** Pace of "to the next stop", whatever the speed. */
export const SKIP_MS_PER_DAY = 120;

/** A day on which time stops: an event card waits, or a game day was reached. */
export interface Stop {
  cultivation_day: number;
  kind: 'event' | 'milestone';
}

export interface PlaybackState {
  day: number;
  lastDay: number;
  playing: boolean;
  speed: Speed;
  /** Day "to the next stop" is moving to. null when not skipping. */
  target: number | null;
  /** The stop time is waiting on. Play does nothing until it is resolved. */
  stopped: Stop | null;
  finished: boolean;
  stops: readonly Stop[];
}

export type PlaybackAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'set_speed'; speed: Speed }
  | { type: 'skip_to_next' }
  | { type: 'tick' }
  /** The player answered the event, or the game day flow ended. */
  | { type: 'resolve_stop' };

export function initialPlayback({
  day,
  lastDay,
  stops,
  speed = 1,
}: {
  day: number;
  lastDay: number;
  stops: readonly Stop[];
  speed?: Speed;
}): PlaybackState {
  return { day, lastDay, playing: false, speed, target: null, stopped: null, finished: day >= lastDay, stops };
}

export function msPerDay(state: PlaybackState): number {
  return state.target !== null ? SKIP_MS_PER_DAY : MS_PER_DAY_AT_1X / state.speed;
}

function nextStopAfter(state: PlaybackState): Stop | null {
  return state.stops.find((s) => s.cultivation_day > state.day) ?? null;
}

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case 'play':
      if (state.stopped || state.finished) return state;
      return { ...state, playing: true };
    case 'pause':
      return { ...state, playing: false, target: null };
    case 'set_speed':
      return SPEEDS.includes(action.speed) ? { ...state, speed: action.speed } : state;
    case 'skip_to_next': {
      if (state.stopped || state.finished) return state;
      const next = nextStopAfter(state);
      return { ...state, playing: true, target: next ? next.cultivation_day : state.lastDay };
    }
    case 'resolve_stop':
      if (!state.stopped) return state;
      return { ...state, stopped: null, playing: !state.finished };
    case 'tick': {
      if (!state.playing || state.stopped || state.finished) return state;
      const day = state.day + 1;
      const stop = state.stops.find((s) => s.cultivation_day === day) ?? null;
      const finished = day >= state.lastDay;
      const arrived = state.target !== null && day >= state.target;
      return {
        ...state,
        day,
        stopped: stop,
        finished,
        playing: !stop && !finished && !arrived,
        target: stop || finished || arrived ? null : state.target,
      };
    }
  }
}
