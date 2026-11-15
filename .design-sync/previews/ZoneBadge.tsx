import { ZoneBadge } from 'space-garden-ui';

export const AllZones = () => (
  <div className="flex flex-wrap items-center gap-3 bg-bg p-6 text-ink">
    <ZoneBadge zone="danger_low" />
    <ZoneBadge zone="caution_low" />
    <ZoneBadge zone="normal" />
    <ZoneBadge zone="caution_high" />
    <ZoneBadge zone="danger_high" />
  </div>
);
