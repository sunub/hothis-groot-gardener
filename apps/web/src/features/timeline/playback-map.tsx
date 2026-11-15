'use client';

import { gameDayOn } from '@/lib/events/judge';
import { useDictionary } from '@/lib/i18n';
import { cn } from '@/lib/utils/cn';
import type { PlaybackState } from './playback';

/**
 * Cultivation days 0 to the last day, one cell per day, while time passes.
 * Today moves one cell per day, so the speed shows as how fast the filled cell
 * travels. Stops (◆ event, D1–D7 game day) and the "to the next stop" target
 * (▸) are marked with a symbol and a word, never with color alone. The map is
 * hidden from screen readers; the controls' day counter and status say the same.
 */
export function PlaybackMap({ state }: { state: PlaybackState }) {
  const p = useDictionary().mission.playback;
  const days = Array.from({ length: state.lastDay + 1 }, (_, i) => i);
  const stopOn = new Map(state.stops.map((s) => [s.cultivation_day, s]));

  return (
    <div aria-hidden className="space-y-2">
      <ol className="grid grid-cols-[repeat(17,minmax(0,1fr))] gap-1">
        {days.map((day) => {
          const stop = stopOn.get(day);
          const gameDay = stop?.kind === 'milestone' ? gameDayOn(day) : null;
          const isToday = day === state.day;
          const isTarget = state.target === day;
          return (
            <li
              key={day}
              className={cn(
                'flex h-11 flex-col items-center justify-center border-2 font-data text-data-sm leading-none tabular-nums',
                isToday && 'border-ink bg-ink text-bg',
                !isToday && day < state.day && 'border-accent-lo bg-accent-lo/50 text-ink',
                !isToday && day > state.day && (stop ? 'border-accent text-ink' : 'border-line text-ink-muted'),
                isTarget && 'outline-2 outline-offset-1 outline-accent outline-dashed',
              )}
            >
              <span>{day}</span>
              <span className="mt-0.5 text-[0.7rem] font-bold">
                {isTarget ? '▸' : stop?.kind === 'event' ? '◆' : gameDay ? `D${gameDay}` : ''}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="flex flex-wrap gap-x-4 gap-y-1 font-data text-data-sm text-ink-muted">
        <span>◆ {p.map_event}</span>
        <span>D1–D7 {p.map_game_day}</span>
        <span>▸ {p.map_target}</span>
      </p>
    </div>
  );
}
