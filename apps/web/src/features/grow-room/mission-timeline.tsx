'use client';

import type { MissionState } from '@/lib/contract/types';
import { format, useDictionary } from '@/lib/i18n';
import { GAME_DAYS, cultivationDayOf, growthStageOf } from '@/lib/game/rules';

/** The seven game days with cultivation day and growth stage; today highlighted, crisis days marked. */
export function MissionTimeline({ mission }: { mission: MissionState }) {
  const t = useDictionary();
  const tl = t.mission.timeline;
  const days = Array.from({ length: GAME_DAYS }, (_, i) => i + 1);
  const today = mission.game_day;

  return (
    <section aria-label={tl.label} className="m-1 pixel-frame pixel-tone-line bg-surface p-3 sm:p-4">
      <p className="mb-3 text-body text-ink-muted">
        {format(tl.summary, {
          day: today,
          days: GAME_DAYS,
          cultivation_day: cultivationDayOf(today),
          stage: t.common.growth_stage[growthStageOf(today)],
        })}
      </p>
      <ol className="grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((day) => {
          const record = mission.days.find((d) => d.game_day === day);
          const hadCrisis = record?.crisis != null;
          const isToday = day === today;
          const isDone = day < today;
          const stage = t.common.growth_stage[growthStageOf(day)];
          const cult = cultivationDayOf(day);
          return (
            <li
              key={day}
              aria-current={isToday ? 'step' : undefined}
              className={`flex min-h-16 flex-col justify-between border px-1 py-1.5 text-center md:px-2 md:text-left ${
                isToday
                  ? 'border-accent bg-accent/10'
                  : isDone
                    ? 'border-line bg-surface-2'
                    : 'border-line/60 bg-transparent text-ink-muted'
              }`}
            >
              <span className="sr-only">
                {[
                  format(tl.day_aria, { day, cultivation_day: cult, stage }),
                  isToday ? tl.today : isDone ? tl.done : null,
                  hadCrisis ? tl.crisis : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </span>
              <span aria-hidden className="block">
                <span className="block text-caption font-semibold sm:text-body">
                  <span className="md:hidden">{format(tl.day_short, { day })}</span>
                  <span className="hidden md:inline">
                    {t.common.day_label} {day}
                  </span>
                </span>
                <span className="block font-data text-[0.625rem] text-ink-muted md:font-sans md:text-caption">
                  <span className="md:hidden">{format(tl.cultivation_short, { day: cult })}</span>
                  <span className="hidden md:inline">{format(tl.cultivation_mid, { day: cult })}</span>
                </span>
                <span className="mt-0.5 hidden truncate text-caption text-ink-muted lg:block">{stage}</span>
              </span>
              <span aria-hidden className="mt-1 flex flex-wrap justify-center gap-1 md:justify-start">
                {isToday ? (
                  <span className="bg-accent px-1 text-[0.625rem] font-semibold text-accent-ink">
                    {tl.today}
                  </span>
                ) : null}
                {hadCrisis ? (
                  <span className="border-2 border-caution px-1 text-[0.625rem] font-semibold text-caution">
                    {tl.crisis}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
