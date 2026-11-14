'use client';

import { ZoneBadge } from '@/components/zone-badge';
import type { Metric, Zone } from '@/lib/contract/types';
import { format, useDictionary } from '@/lib/i18n';
import { HEALTH_MAX, HEALTH_MIN, METRIC_MAX, METRIC_MIN, ZONE_BOUNDS, zoneOf } from '@/lib/game/rules';

const segmentClass: Record<Zone, string> = {
  danger_low: 'bg-danger/35',
  caution_low: 'bg-caution/35',
  normal: 'bg-normal/35',
  caution_high: 'bg-caution/35',
  danger_high: 'bg-danger/35',
};

function percent(value: number): number {
  return ((value - METRIC_MIN) / (METRIC_MAX - METRIC_MIN)) * 100;
}

/** The five zones of one metric as a horizontal band, with a marker at the current value. */
export function ZoneGauge({ metric, value }: { metric: Metric; value: number }) {
  const t = useDictionary();
  const b = ZONE_BOUNDS[metric];
  const zone = zoneOf(metric, value);
  const edges = [METRIC_MIN, b.danger_low_below, b.caution_low_below, b.normal_max, b.caution_high_max, METRIC_MAX];
  const zones: Zone[] = ['danger_low', 'caution_low', 'normal', 'caution_high', 'danger_high'];
  const label = t.common.metric[metric];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-ink-muted">{label}</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-lg font-semibold tabular-nums">{value}</span>
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
        className="relative pt-2"
      >
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {zones.map((z, i) => (
            <div
              key={z}
              className={`${segmentClass[z]} ${z === zone ? 'brightness-150' : ''}`}
              style={{ width: `${percent(edges[i + 1]) - percent(edges[i])}%` }}
            />
          ))}
        </div>
        <div
          aria-hidden
          className="absolute top-0 h-[1.125rem] w-1 -translate-x-1/2 rounded-full bg-ink shadow-[0_0_0_2px_var(--color-surface)] transition-[left] duration-500 motion-reduce:transition-none"
          style={{ left: `${Math.min(100, Math.max(0, percent(value)))}%` }}
        />
        <div aria-hidden className="relative mt-1 h-4 font-mono text-[0.625rem] text-ink-muted">
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

/** Plant health as a 0-100 bar. */
export function HealthBar({ value }: { value: number }) {
  const t = useDictionary();
  const label = t.common.metric.plant_health;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-ink-muted">{label}</span>
        <span className="font-mono text-lg font-semibold tabular-nums">
          {format(t.mission.status.health_scale, { value, max: HEALTH_MAX })}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={HEALTH_MIN}
        aria-valuemax={HEALTH_MAX}
        aria-valuenow={value}
        className="h-2.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-game transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${((value - HEALTH_MIN) / (HEALTH_MAX - HEALTH_MIN)) * 100}%` }}
        />
      </div>
    </div>
  );
}
