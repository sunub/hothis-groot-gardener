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

export function zoneToneOf(zone: Zone): Tone {
  return zoneTone[zone];
}

/** Zone as a labelled badge. The label carries the meaning; color only supports it. */
export function ZoneBadge({ zone }: { zone: Zone }) {
  const t = useDictionary();
  return <Badge tone={zoneTone[zone]}>{t.common.zone[zone]}</Badge>;
}
