'use client';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { PixelIcon } from '@/components/ui/pixel-icon';
import { Skeleton } from '@/components/ui/skeleton';
import type { CrisisFetchStatus, MissionActions } from '@/features/mission/use-mission';
import { useDictionary } from '@/lib/i18n';
import { PanelHeading } from './panel-heading';

/** Waiting for the crisis API: a calm loading state, or an error with Retry. */
export function CrisisPendingPanel({
  status,
  actions,
}: {
  status: CrisisFetchStatus;
  actions: MissionActions;
}) {
  const p = useDictionary().mission.pending;

  if (status === 'error') {
    return (
      <div className="space-y-4">
        <PanelHeading>{p.error_title}</PanelHeading>
        <Callout role="alert" tone="danger" icon={<PixelIcon name="fail" />}>
          {p.error_body}
        </Callout>
        <Button variant="primary" onClick={actions.retryCrisis} className="px-6">
          {p.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-busy="true">
      <PanelHeading>{p.title}</PanelHeading>
      <p className="text-body text-ink-muted">{p.body}</p>
      <div aria-hidden className="space-y-3 pt-2">
        <Skeleton className="w-full" />
        <Skeleton className="w-4/5" />
        <Skeleton className="w-3/5" />
        <div className="grid gap-2 pt-2 @md:grid-cols-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </div>
    </div>
  );
}
