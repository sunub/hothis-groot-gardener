'use client';

import { Card, CardTitle } from '@/components/ui/card';
import { ValueTypeTag } from '@/components/value-type-tag';
import type { Metric, MissionState, PlantState } from '@/lib/contract/types';
import { format, useDictionary } from '@/lib/i18n';
import { MAX_CARE_OPS_PER_DAY, METRICS, isCaution, isDanger, zoneOf } from '@/lib/game/rules';
import { HealthBar, ZoneGauge } from './zone-gauge';

/** Current plant and chamber state: always visible beside the phase panel. */
export function PlantStatusPanel({ mission, className }: { mission: MissionState; className?: string }) {
  const t = useDictionary();
  const s = t.mission.status;
  const { plant } = mission;
  const opsLeft = Math.max(0, MAX_CARE_OPS_PER_DAY - mission.care_ops_used);
  // The first morning is the baseline the player compares with once the room drifts.
  const baseline = mission.days[0]?.start ?? null;
  const showCompare = baseline !== null && mission.game_day > 1;

  return (
    <Card aria-labelledby="plant-status-title" className={className}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <CardTitle id="plant-status-title">{s.title}</CardTitle>
        <ValueTypeTag type="game_value" />
      </div>
      <div className="space-y-5">
        <HealthBar value={plant.plant_health} />
        {METRICS.map((metric) => {
          const zone = zoneOf(metric, plant[metric]);
          const flagged = isCaution(zone) || isDanger(zone);
          const trend =
            flagged && baseline
              ? format(s.trend, { from: 1, a: baseline[metric], b: plant[metric] })
              : null;
          return (
            <div
              key={metric}
              className={
                flagged
                  ? `m-1 space-y-2 border-2 p-3 ${isDanger(zone) ? 'border-danger bg-danger/10' : 'border-caution bg-caution/10'}`
                  : undefined
              }
            >
              <ZoneGauge metric={metric} value={plant[metric]} />
              {trend ? (
                <p className={`text-body font-bold ${isDanger(zone) ? 'text-danger' : 'text-caution'}`}>
                  <span aria-hidden>{baseline && plant[metric] < baseline[metric] ? '▼ ' : '▲ '}</span>
                  {trend}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {showCompare && baseline ? <Compare baseline={baseline} plant={plant} /> : null}

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-5 text-body">
        <div className="bg-surface-2 px-3 py-2">
          <dt className="text-caption text-ink-muted">{s.fan}</dt>
          <dd className="font-bold">{t.common.fan_level[plant.fan]}</dd>
        </div>
        <div className="bg-surface-2 px-3 py-2">
          <dt className="text-caption text-ink-muted">{s.light}</dt>
          <dd className="font-bold">
            {format(s.light_value, {
              red: t.common.light_level[plant.light.red],
              blue: t.common.light_level[plant.light.blue],
            })}
          </dd>
        </div>
        <div className="col-span-2 bg-surface-2 px-3 py-2">
          <dt className="text-caption text-ink-muted">{s.ops_left}</dt>
          <dd>
            {mission.phase === 'care'
              ? format(s.ops_value, { left: opsLeft, max: MAX_CARE_OPS_PER_DAY })
              : s.ops_none_today}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

/** Change of each value since the first morning, as three small tiles. A drop in a chamber value is flagged. */
function Compare({ baseline, plant }: { baseline: PlantState; plant: PlantState }) {
  const t = useDictionary();
  const items: { key: 'plant_health' | Metric; label: string }[] = [
    { key: 'plant_health', label: t.common.metric.plant_health },
    { key: 'root_moisture', label: t.common.metric.root_moisture },
    { key: 'humidity', label: t.common.metric.humidity },
  ];
  return (
    <div className="mt-5 space-y-2 border-t border-line pt-5">
      <h3 className="text-caption text-ink-muted">{t.mission.status.compare_title}</h3>
      <ul className="grid grid-cols-3 gap-2">
        {items.map(({ key, label }) => {
          const delta = plant[key] - baseline[key];
          const flagged = key !== 'plant_health' && isCaution(zoneOf(key, plant[key]));
          return (
            <li key={key} className="bg-surface-2 px-3 py-2">
              <div className="text-caption text-ink-muted">{label}</div>
              <div className={`font-data text-data-lg ${flagged ? 'text-caution' : ''}`}>
                <span aria-hidden>{delta === 0 ? '± ' : delta < 0 ? '▼ ' : '▲ '}</span>
                {Math.abs(delta)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
