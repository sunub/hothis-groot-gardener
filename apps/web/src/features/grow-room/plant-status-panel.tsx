'use client';

import { Card, CardTitle } from '@/components/ui/card';
import { ValueTypeTag } from '@/components/value-type-tag';
import type { MissionState } from '@/lib/contract/types';
import { format, useDictionary } from '@/lib/i18n';
import { MAX_CARE_OPS_PER_DAY } from '@/lib/game/rules';
import { HealthBar, ZoneGauge } from './zone-gauge';

/** Current plant and chamber state: always visible beside the phase panel. */
export function PlantStatusPanel({ mission }: { mission: MissionState }) {
  const t = useDictionary();
  const s = t.mission.status;
  const { plant } = mission;
  const opsLeft = Math.max(0, MAX_CARE_OPS_PER_DAY - mission.care_ops_used);

  return (
    <Card aria-labelledby="plant-status-title">
      <div className="mb-4 flex items-center justify-between gap-2">
        <CardTitle id="plant-status-title">{s.title}</CardTitle>
        <ValueTypeTag type="game_value" />
      </div>
      <div className="space-y-5">
        <HealthBar value={plant.plant_health} />
        <ZoneGauge metric="root_moisture" value={plant.root_moisture} />
        <ZoneGauge metric="humidity" value={plant.humidity} />
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t-4 border-surface-2 pt-4 text-body">
        <div>
          <dt className="text-ink-muted">{s.fan}</dt>
          <dd className="font-medium">{t.common.fan_level[plant.fan]}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{s.light}</dt>
          <dd className="font-medium">
            {format(s.light_value, {
              red: t.common.light_level[plant.light.red],
              blue: t.common.light_level[plant.light.blue],
            })}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-ink-muted">{s.ops_left}</dt>
          <dd className="font-medium">
            {mission.phase === 'care'
              ? format(s.ops_value, { left: opsLeft, max: MAX_CARE_OPS_PER_DAY })
              : s.ops_none_today}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
