'use client';

import { Meter } from '@/components/ui/meter';
import { ZoneBadge } from '@/components/zone-badge';
import type { Metric, Zone } from '@/lib/contract/types';
import { format, useDictionary } from '@/lib/i18n';
import { HEALTH_MAX, HEALTH_MIN, METRIC_MAX, METRIC_MIN, ZONE_BOUNDS, zoneOf } from '@/lib/game/rules';

/** Fill of each zone block. Danger zones are darker and hatched, so the zones differ in lightness, not only hue. */
const zoneFill: Record<Zone, string> = {
  danger_low: 'bg-danger-fill',
  caution_low: 'bg-caution',
  normal: 'bg-normal',
  caution_high: 'bg-caution',
  danger_high: 'bg-danger-fill',
};

const ZONES: readonly Zone[] = ['danger_low', 'caution_low', 'normal', 'caution_high', 'danger_high'];

function percent(value: number): number {
  return ((value - METRIC_MIN) / (METRIC_MAX - METRIC_MIN)) * 100;
}

/** The five zones of one metric as a segmented band, with an arrow at the current value. */
export function ZoneGauge({ metric, value }: { metric: Metric; value: number }) {
  const t = useDictionary();
  const b = ZONE_BOUNDS[metric];
  const zone = zoneOf(metric, value);
  const edges = [METRIC_MIN, b.danger_low_below, b.caution_low_below, b.normal_max, b.caution_high_max, METRIC_MAX];
  const label = t.common.metric[metric];
  const left = `${Math.min(100, Math.max(0, percent(value)))}%`;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-body font-semibold">{label}</span>
        <span className="flex items-center gap-2">
          <span className="font-data text-data-lg tabular-nums">{value}</span>
          <ZoneBadge zone={zone} />
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={METRIC_MIN}
        aria-valuemax={METRIC_MAX}
        aria-valuenow={value}
        aria-valuetext={format(t.mission.status.gauge_value, { value, zone: t.common.zone[zone] })}
        className="relative pt-4"
      >
        <span
          aria-hidden
          className="absolute top-0 size-0 -translate-x-1/2 border-x-[7px] border-t-[11px] border-x-transparent border-t-ink transition-[left] duration-500 motion-reduce:transition-none"
          style={{ left }}
        />
        <div className="m-1 flex h-5 pixel-frame-flat pixel-tone-line">
          {ZONES.map((z, i) => (
            <div
              key={z}
              className={zoneFill[z]}
              style={{ width: `${percent(edges[i + 1]) - percent(edges[i])}%` }}
            >
              <div className={`h-full ${z.startsWith('danger') ? 'pixel-hatch' : 'pixel-segments'}`} />
            </div>
          ))}
        </div>
        <div aria-hidden className="relative mt-1 h-5 font-data text-data-sm text-ink-muted">
          {edges.slice(1, -1).map((edge) => (
            <span key={edge} className="absolute -translate-x-1/2" style={{ left: `${percent(edge)}%` }}>
              {edge}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Plant health as a segmented 0-100 bar. */
export function HealthBar({ value }: { value: number }) {
  const t = useDictionary();
  const label = t.common.metric.plant_health;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-body font-semibold">{label}</span>
        <span className="font-data text-data-lg tabular-nums">
          {format(t.mission.status.health_scale, { value, max: HEALTH_MAX })}
        </span>
      </div>
      <Meter aria-label={label} value={value} min={HEALTH_MIN} max={HEALTH_MAX} tone="health" />
    </div>
  );
}
