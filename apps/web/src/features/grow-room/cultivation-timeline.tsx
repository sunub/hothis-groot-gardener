'use client';

import type { MissionState } from '@/lib/contract/types';
import { format, useDictionary } from '@/lib/i18n';
import {
  CULTIVATION_DAYS,
  FIRST_CRISIS_DAY,
  GAME_DAYS,
  LAST_CRISIS_DAY,
  cultivationDayOf,
  growthStageOf,
} from '@/lib/game/rules';

const LAST_CULTIVATION_DAY: number = CULTIVATION_DAYS[CULTIVATION_DAYS.length - 1];
const CULTIVATION_CELLS: readonly number[] = Array.from({ length: LAST_CULTIVATION_DAY + 1 }, (_, i) => i);
/** Cultivation days in which a morning check can raise a crisis (game days 2 to 6). */
const WINDOW_START: number = cultivationDayOf(FIRST_CRISIS_DAY);
const WINDOW_END: number = cultivationDayOf(LAST_CRISIS_DAY);

type CellState = 'today' | 'done' | 'future';

function cellClass(state: CellState, isStop: boolean): string {
  if (state === 'today') return 'border-ink bg-ink text-bg';
  if (state === 'done') return `${isStop ? 'border-accent' : 'border-accent-lo'} bg-accent-lo/50 text-ink`;
  return `${isStop ? 'border-accent' : 'border-line'} bg-surface ${isStop ? 'text-ink' : 'text-ink-muted'}`;
}

/**
 * The mission as a map of cultivation days 0 to 33, one square cell per day.
 * The seven game-day stops carry a "D1" to "D7" label; today is filled, finished
 * days are tinted, and the crisis window and crisis days are marked with a symbol
 * and a word, never with color alone. Read-only: it never changes the mission.
 * The visual map is hidden from screen readers; a plain list below it says the same.
 */
export function CultivationTimeline({ mission }: { mission: MissionState }) {
  const t = useDictionary();
  const tl = t.mission.timeline;
  const today = mission.game_day;
  const todayCultivation = cultivationDayOf(today);
  const gameDays = Array.from({ length: GAME_DAYS }, (_, i) => i + 1);

  return (
    <section aria-label={tl.label} className="pixel-frame m-1 space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-title text-lg">
          {format(tl.summary, {
            day: today,
            days: GAME_DAYS,
            cultivation_day: todayCultivation,
            stage: t.common.growth_stage[growthStageOf(today)],
          })}
        </p>
        <p className="font-data text-lg text-ink-muted">{format(tl.map_hint, { last: LAST_CULTIVATION_DAY })}</p>
      </div>

      <div aria-hidden className="overflow-x-auto pb-1">
        <div className="grid min-w-[44rem] grid-cols-[repeat(17,minmax(0,1fr))] gap-1.5">
          {CULTIVATION_CELLS.map((day) => {
            const gameDay = CULTIVATION_DAYS.indexOf(day) + 1;
            const isStop = gameDay > 0;
            const state: CellState = day === todayCultivation ? 'today' : day < todayCultivation ? 'done' : 'future';
            const hadCrisis = isStop && mission.days.find((d) => d.game_day === gameDay)?.crisis != null;
            const inWindow = day >= WINDOW_START && day <= WINDOW_END;
            return (
              <div
                key={day}
                className={`flex min-h-14 flex-col items-center justify-between border-2 py-1 text-center ${cellClass(state, isStop)}`}
              >
                <span className="font-data text-lg leading-none">{day}</span>
                <span className="font-data text-base leading-none">{hadCrisis ? '△' : inWindow ? '≈' : ''}</span>
                <span className="font-data text-sm leading-none">{isStop ? format(tl.day_short, { day: gameDay }) : ''}</span>
              </div>
            );
          })}
        </div>
      </div>

      <ul aria-hidden className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
        <li className="flex items-center gap-2">
          <span className="font-data text-base text-ink">D1–D{GAME_DAYS}</span>
          {tl.legend_stop}
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block size-3.5 border-2 border-ink bg-ink" />
          {tl.legend_today}
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block size-3.5 border-2 border-accent-lo bg-accent-lo/50" />
          {tl.legend_done}
        </li>
        <li className="flex items-center gap-2">
          <span className="font-data text-base text-ink">≈</span>
          {tl.legend_window}
        </li>
        <li className="flex items-center gap-2">
          <span className="font-data text-base text-caution">△</span>
          {tl.legend_crisis}
        </li>
      </ul>

      <ol className="sr-only">
        {gameDays.map((day) => {
          const record = mission.days.find((d) => d.game_day === day);
          return (
            <li key={day} aria-current={day === today ? 'step' : undefined}>
              {[
                format(tl.day_aria, {
                  day,
                  cultivation_day: cultivationDayOf(day),
                  stage: t.common.growth_stage[growthStageOf(day)],
                }),
                day === today ? tl.today : day < today ? tl.done : null,
                record?.crisis != null ? tl.crisis : null,
              ]
                .filter(Boolean)
                .join(', ')}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
