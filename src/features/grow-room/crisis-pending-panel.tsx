'use client';

import { Button } from '@/components/ui/button';
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
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
          {p.error_body}
        </p>
        <Button variant="primary" onClick={actions.retryCrisis} className="px-6">
          {p.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-busy="true">
      <PanelHeading>{p.title}</PanelHeading>
      <p className="text-sm text-ink-muted">{p.body}</p>
      <div aria-hidden className="space-y-3 pt-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
        <div className="grid gap-2 pt-2 sm:grid-cols-2">
          <div className="h-14 animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" />
          <div className="h-14 animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
