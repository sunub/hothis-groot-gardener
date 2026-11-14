'use client';

import { ValueTypeTag } from '@/components/value-type-tag';
import { ZoneBadge } from '@/components/zone-badge';
import type { Metric, PlantState, Zone } from '@/lib/contract/types';
import { format, useDictionary } from '@/lib/i18n';
import { clampHealth } from '@/lib/game/rules';
import { forecastNight, nightHealthReasons, signed } from './derive';

/** Tomorrow morning's root moisture and humidity if the day ended now, with tonight's health change. */
export function NightForecast({ plant }: { plant: PlantState }) {
  const t = useDictionary();
  const f = t.mission.forecast;
  const rows = forecastNight(plant);
  const zones = Object.fromEntries(rows.map((r) => [r.metric, r.zone])) as Record<Metric, Zone>;
  const rawChange = nightHealthReasons(zones).reduce((sum, r) => sum + r.change, 0);
  const healthChange = clampHealth(plant.plant_health + rawChange) - plant.plant_health;

  return (
    <section aria-labelledby="forecast-title" className="bg-surface-2 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 id="forecast-title" className="text-body font-semibold">
          {f.title}
        </h3>
        <ValueTypeTag type="game_value" />
      </div>
      <p className="mb-3 text-caption text-ink-muted">
        {format(f.intro, { fan: t.common.fan_level[plant.fan] })}
      </p>
      <dl className="space-y-2 text-body">
        {rows.map((row) => (
          <div key={row.metric} className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-ink-muted">{t.common.metric[row.metric]}</dt>
            <dd className="flex items-center gap-2">
              <span className="font-data text-data tabular-nums">{format(f.change, { from: row.from, to: row.to })}</span>
              <ZoneBadge zone={row.zone} />
            </dd>
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t-4 border-surface-2 pt-2">
          <dt className="text-ink-muted">{f.health}</dt>
          <dd className="font-data text-data tabular-nums">{signed(healthChange)}</dd>
        </div>
      </dl>
    </section>
  );
}
