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

const GAME_DAY_LIST: readonly number[] = Array.from({ length: GAME_DAYS }, (_, i) => i + 1);

type SegmentState = 'done' | 'crisis' | 'none';

/** The line from game day `gameDay - 1` to `gameDay`: walked, a possible-crisis stretch, or plain. */
function segmentState(gameDay: number, today: number): SegmentState {
  if (gameDay <= today) return 'done';
  if (gameDay >= FIRST_CRISIS_DAY && gameDay <= LAST_CRISIS_DAY) return 'crisis';
  return 'none';
}

const CRISIS_HATCH = 'bg-[repeating-linear-gradient(135deg,#e3b95b_0_3px,#3a3220_3px_6px)]';

const segmentClass: Record<SegmentState, string> = {
  done: 'bg-accent-lo',
  crisis: CRISIS_HATCH,
  none: 'bg-surface-2',
};

type DayState = 'done' | 'today' | 'alert' | 'upcoming';

/**
 * Each day number sits in a square whose fill tells the state, so walked and
 * coming days are told apart at a glance (and not by text color alone):
 * walked days are filled, today is bright with a ring, coming days are hollow.
 */
const dayBoxClass: Record<DayState, string> = {
  done: 'bg-accent-lo text-accent-ink',
  today: 'bg-accent text-accent-ink outline-2 outline-offset-1 outline-accent',
  alert: 'bg-caution text-accent-ink outline-2 outline-offset-1 outline-caution',
  upcoming: 'border-2 border-line bg-bg text-ink-muted',
};

const dayLabelClass: Record<DayState, string> = {
  done: 'text-ink-muted',
  today: 'text-ink',
  alert: 'text-caution',
  upcoming: 'text-ink-faint',
};

/** Labels hang under their square; the first and last are pinned to the edge so they stay inside the line. */
function labelAlign(gameDay: number): string {
  if (gameDay === 1) return 'left-0';
  if (gameDay === GAME_DAYS) return 'right-0';
  return 'left-1/2 -translate-x-1/2';
}

/**
 * The mission as one borderless line: the seven game days as numbered squares on a
 * thin line, each with its cultivation day (or "today") underneath.
 * A heading says which mission day it is, and a small legend says what the fills
 * and the hatched stretch (the window in which a crisis can come) mean. Read-only.
 * The visual line is hidden from screen readers; a plain list below says the same.
 */
export function CultivationTimeline({ mission }: { mission: MissionState }) {
  const t = useDictionary();
  const tl = t.mission.timeline;
  const today = mission.game_day;
  // A mission with a timeline knows the cultivation day between two game days.
  const todayCultivation = mission.timeline?.cultivation_day ?? cultivationDayOf(today);
  const alerting = Boolean(mission.timeline?.pending_event) || mission.phase.startsWith('crisis');

  return (
    <section aria-label={tl.label} className="border-y border-dashed border-line py-3">
      <p className="sr-only">
        {format(tl.summary, {
          day: today,
          days: GAME_DAYS,
          cultivation_day: todayCultivation,
          stage: t.common.growth_stage[growthStageOf(today)],
        })}
      </p>

      {/* Heading and legend: what the numbers are and what the fills mean. */}
      <div aria-hidden className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="font-data text-data text-ink">
          {format(tl.progress, { day: today, days: GAME_DAYS })}
          <span className="ml-2 text-ink-muted">
            · {format(tl.cultivation_mid, { day: todayCultivation })}
          </span>
        </p>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 bg-accent-lo" />
            {tl.legend_done}
          </li>
          <li className="flex items-center gap-1.5">
            <span className={`size-2.5 ${alerting ? 'bg-caution' : 'bg-accent'}`} />
            {tl.legend_today}
          </li>
          <li className="flex items-center gap-1.5">
            <span className={`h-1.5 w-4 ${CRISIS_HATCH}`} />
            {tl.legend_window}
          </li>
        </ul>
      </div>

      {/* The line: numbered squares on a thin line, the cultivation day (or "today") under each. */}
      <div aria-hidden className="flex items-start pb-5">
        {GAME_DAY_LIST.map((gameDay) => {
          const state: DayState =
            gameDay === today ? (alerting ? 'alert' : 'today') : gameDay < today ? 'done' : 'upcoming';
          const isToday = gameDay === today;
          return (
            <div key={gameDay} className="contents">
              {gameDay > 1 ? (
                <span className={`mt-[9px] h-1.5 min-w-3 flex-1 ${segmentClass[segmentState(gameDay, today)]}`} />
              ) : null}
              <div className="relative">
                <span
                  className={`flex size-6 items-center justify-center font-data text-data leading-none ${dayBoxClass[state]}`}
                >
                  {gameDay}
                </span>
                <span className={`absolute top-full mt-1 whitespace-nowrap ${labelAlign(gameDay)} text-caption leading-tight ${dayLabelClass[state]}`}>
                  {isToday ? (
                    tl.today
                  ) : (
                    <>
                      <span className="sm:hidden">{CULTIVATION_DAYS[gameDay - 1]}</span>
                      <span className="hidden sm:inline">
                        {format(tl.cultivation_mid, { day: CULTIVATION_DAYS[gameDay - 1] })}
                      </span>
                    </>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <ol className="sr-only">
        {GAME_DAY_LIST.map((day) => {
          const record = mission.days.find((d) => d.game_day === day);
          return (
            <li key={day} aria-current={day === today ? 'step' : undefined}>
              {[
                format(tl.day_aria, {
                  day,
                  cultivation_day: CULTIVATION_DAYS[day - 1],
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
