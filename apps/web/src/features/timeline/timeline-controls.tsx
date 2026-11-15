'use client';

import { Button } from '@/components/ui/button';
import { gameDayOn } from '@/lib/events/judge';
import { format, useDictionary } from '@/lib/i18n';
import { cn } from '@/lib/utils/cn';
import { msPerDay, SPEEDS, type PlaybackAction, type PlaybackState } from './playback';

/** Seconds per day at a speed, written the way the rate label shows it. */
function secondsPerDay(state: PlaybackState): string {
  const seconds = msPerDay({ ...state, target: null }) / 1000;
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(2).replace(/0$/, '');
}

/** What time is doing now, in words. Never only an icon or a color. */
export function playbackStatus(state: PlaybackState, t: ReturnType<typeof useDictionary>): string {
  const p = t.mission.playback;
  if (state.stopped?.kind === 'event') return p.status_event;
  if (state.stopped?.kind === 'milestone') {
    return format(p.status_milestone, { game_day: gameDayOn(state.stopped.cultivation_day) ?? '' });
  }
  if (state.finished) return p.status_finished;
  if (state.target !== null) return format(p.status_skipping, { day: state.target });
  if (state.playing) return format(p.status_running, { speed: state.speed });
  return p.status_paused;
}

/**
 * Pause/play, speed and "to the next stop". The rate label turns the speed into
 * real time ("4× · 1 day ≈ 0.5 s"), and the status line says why time is
 * stopped or where it is going, so every control gives feedback in words.
 */
export function TimelineControls({
  state,
  dispatch,
}: {
  state: PlaybackState;
  dispatch: (action: PlaybackAction) => void;
}) {
  const t = useDictionary();
  const p = t.mission.playback;
  const blocked = state.stopped !== null || state.finished;
  const status = playbackStatus(state, t);

  return (
    <section aria-label={p.label} className="m-1 space-y-3 pixel-frame-flat pixel-tone-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          className="min-w-28"
          onClick={() => dispatch({ type: state.playing ? 'pause' : 'play' })}
          disabled={blocked}
        >
          <span aria-hidden className="font-data">
            {state.playing ? '❚❚' : '▶'}
          </span>{' '}
          {state.playing ? p.pause : p.play}
        </Button>

        <fieldset className="flex items-center gap-1" disabled={state.target !== null}>
          <legend className="sr-only">{p.speed_label}</legend>
          {SPEEDS.map((speed) => (
            <Button
              key={speed}
              variant="toggle"
              size="sm"
              aria-pressed={state.speed === speed}
              onClick={() => dispatch({ type: 'set_speed', speed })}
              className="min-w-12 font-data"
            >
              {speed}×
            </Button>
          ))}
        </fieldset>

        <Button variant="secondary" onClick={() => dispatch({ type: 'skip_to_next' })} disabled={blocked || state.target !== null}>
          {p.skip}
        </Button>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-data text-data-sm text-accent">
          {format(p.rate, { speed: state.speed, seconds: secondsPerDay(state) })}
        </p>
        <p className="font-data text-data tabular-nums">{format(p.day, { day: state.day, last: state.lastDay })}</p>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          'flex items-center gap-2 px-3 py-2 text-body',
          state.stopped ? 'bg-caution/20 text-ink' : 'bg-surface-2 text-ink-muted',
        )}
      >
        <span aria-hidden className={cn('font-data', state.playing && 'animate-blink')}>
          {state.stopped || !state.playing ? '❚❚' : '▶'}
        </span>
        {status}
      </p>
    </section>
  );
}
