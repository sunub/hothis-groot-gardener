'use client';

import { Badge, type Tone } from '@/components/ui/badge';
import type { Zone } from '@/lib/contract/types';
import { useDictionary } from '@/lib/i18n';

const zoneTone: Record<Zone, Tone> = {
  danger_low: 'danger',
  caution_low: 'caution',
  normal: 'normal',
  caution_high: 'caution',
  danger_high: 'danger',
};

/** Symbol shown with every zone so the zone is not told by color alone. */
export const ZONE_SYMBOL: Record<Zone, string> = {
  danger_low: '✕',
  caution_low: '△',
  normal: '✓',
  caution_high: '△',
  danger_high: '✕',
};

export function zoneToneOf(zone: Zone): Tone {
  return zoneTone[zone];
}

/** Zone as a labelled badge: symbol, then words. Color only supports them. */
export function ZoneBadge({ zone }: { zone: Zone }) {
  const t = useDictionary();
  return (
    <Badge tone={zoneTone[zone]}>
      <span aria-hidden>{ZONE_SYMBOL[zone]}</span>
      {t.common.zone[zone]}
    </Badge>
  );
}
