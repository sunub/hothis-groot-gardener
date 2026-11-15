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

const segmentClass: Record<SegmentState, string> = {
  done: 'bg-accent-lo',
  crisis: 'bg-[repeating-linear-gradient(135deg,#e3b95b_0_3px,#3a3220_3px_6px)]',
  none: 'bg-surface-2',
};

/**
 * The mission as one borderless line: the seven game days
 * as bare numbers on a thin line, each with its cultivation day (or "today") underneath.
 * The hatched stretch is the window in which a crisis can come.
 * No card and no boxes around the numbers: the state of a day is told by the number's
 * color and weight,. Read-only.
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

      {/* Only the line: bare day numbers on a thin line, the cultivation day (or "today") under each. */}
      <div aria-hidden className="flex items-start">
        {GAME_DAY_LIST.map((gameDay) => {
          const isToday = gameDay === today;
          const tone = isToday
            ? alerting
              ? 'text-caution'
              : 'text-ink'
            : gameDay < today
              ? 'text-accent-hi'
              : 'text-ink-muted';
          return (
            <div key={gameDay} className="contents">
              {gameDay > 1 ? (
                <span className={`mt-2.5 h-1.5 min-w-2 flex-1 ${segmentClass[segmentState(gameDay, today)]}`} />
              ) : null}
              <div className="flex flex-col items-center">
                <span className={`px-1.5 font-data text-data leading-none ${tone}`}>
                  {gameDay}
                </span>
                <span
                  className="mt-0.5 whitespace-nowrap text-caption leading-tight text-ink-muted"
                >
                  {isToday ? tl.today : CULTIVATION_DAYS[gameDay - 1]}
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
