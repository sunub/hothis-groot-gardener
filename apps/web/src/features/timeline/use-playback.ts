'use client';

import { useEffect, useReducer } from 'react';
import { initialPlayback, msPerDay, playbackReducer, type PlaybackState, type Stop } from './playback';

/**
 * Playback state plus a timer that moves one cultivation day every
 * msPerDay while playing. The timer restarts on every day, speed or target
 * change, so a new speed takes effect from the next day.
 */
export function usePlayback(options: { day: number; lastDay: number; stops: readonly Stop[] }) {
  const [state, dispatch] = useReducer(playbackReducer, options, initialPlayback);

  useEffect(() => {
    if (!state.playing) return;
    const timer = setTimeout(() => dispatch({ type: 'tick' }), msPerDay(state));
    return () => clearTimeout(timer);
  }, [state]);

  return [state, dispatch] as const satisfies readonly [PlaybackState, unknown];
}
