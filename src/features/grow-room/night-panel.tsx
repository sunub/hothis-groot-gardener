'use client';

import { Button } from '@/components/ui/button';
import { ValueTypeTag } from '@/components/value-type-tag';
import { ZoneBadge } from '@/components/zone-badge';
import type { MissionActions } from '@/features/mission/use-mission';
import type { MissionState } from '@/lib/contract/types';
import { format, useDictionary } from '@/lib/i18n';
import { GAME_DAYS, METRICS } from '@/lib/game/rules';
import { nightHealthReasons, signed, todayRecord } from './derive';
import { PanelHeading } from './panel-heading';

/** Overnight summary from today's night record, then the button to the next day. */
export function NightPanel({ mission, actions }: { mission: MissionState; actions: MissionActions }) {
  const t = useDictionary();
  const n = t.mission.night;
  const night = todayRecord(mission)?.night ?? null;
  const nextDay = mission.game_day + 1;
  const toHarvest = nextDay >= GAME_DAYS;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <PanelHeading>{format(n.title, { day: mission.game_day })}</PanelHeading>
        <p className="text-sm text-ink-muted">{n.intro}</p>
      </div>

      {night ? (
        <section aria-labelledby="night-changes" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 id="night-changes" className="text-sm font-semibold">
              {n.changes_title}
            </h3>
            <ValueTypeTag type="game_value" />
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {METRICS.map((metric) => (
              <div key={metric} className="rounded-lg border border-line bg-surface-2 p-3">
                <dt className="text-sm text-ink-muted">{t.common.metric[metric]}</dt>
                <dd className="mt-1 space-y-2">
                  <span className="block font-mono text-2xl font-semibold tabular-nums">
                    {format(n.metric_row, { change: signed(night.drift[metric]) })}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono tabular-nums">{format(n.now, { value: night.end[metric] })}</span>
                    <ZoneBadge zone={night.zones[metric]} />
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm text-ink-muted">{n.health_title}</h3>
              <span className="font-mono text-2xl font-semibold tabular-nums">{signed(night.health_change)}</span>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {nightHealthReasons(night.zones).map((reason) => (
                <li key={reason.kind === 'all_normal' ? reason.kind : reason.metric}>
                  {reason.kind === 'all_normal'
                    ? format(n.health_reason.all_normal, { change: signed(reason.change) })
                    : format(n.health_reason[reason.kind], {
                        metric: t.common.metric[reason.metric],
                        change: signed(reason.change),
                      })}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-muted">
              {format(n.health_now, { value: night.end.plant_health })}
            </p>
          </div>
        </section>
      ) : null}

      <div className="border-t border-line pt-5">
        <Button variant="primary" onClick={actions.nextDay} className="w-full px-6 sm:w-auto">
          {toHarvest ? n.to_harvest : format(n.next_day, { day: nextDay })}
        </Button>
      </div>
    </div>
  );
}
