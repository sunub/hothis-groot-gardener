'use client';

import { useState } from 'react';
import { StateHistoryChart } from '@/components/state-history-chart';
import { Card, CardTitle } from '@/components/ui/card';
import { ValueTypeTag } from '@/components/value-type-tag';
import { PhaseGate } from '@/features/mission/phase-gate';
import { ROUTES } from '@/features/mission/routes';
import { useMission, type CrisisFetchStatus, type MissionActions } from '@/features/mission/use-mission';
import type { MissionState } from '@/lib/contract/types';
import { useDictionary } from '@/lib/i18n';
import { CarePanel } from './care-panel';
import { CrisisPanel, toCrisisView } from './crisis-panel';
import { CrisisPendingPanel } from './crisis-pending-panel';
import { CrisisResultPanel } from './crisis-result-panel';
import { CultivationTimeline } from './cultivation-timeline';
import { NightPanel } from './night-panel';
import { PhaseChangedContext } from './panel-heading';
import { PlantCharacter } from './plant-character';
import { PlantStatusPanel } from './plant-status-panel';

/** The /mission screen: gate to the mission phases that belong here, then the grow room. */
export function MissionScreen() {
  const { crisisStatus, actions } = useMission();
  return (
    <PhaseGate route={ROUTES.mission} fallback={<GrowRoomLoading />}>
      {(mission) => <GrowRoom mission={mission} crisisStatus={crisisStatus} actions={actions} />}
    </PhaseGate>
  );
}

function GrowRoomLoading() {
  const t = useDictionary();
  return (
    <div role="status" className="flex min-h-64 items-center justify-center text-sm text-ink-muted">
      {t.mission.screen.loading}
    </div>
  );
}

function GrowRoom({
  mission,
  crisisStatus,
  actions,
}: {
  mission: MissionState;
  crisisStatus: CrisisFetchStatus;
  actions: MissionActions;
}) {
  const t = useDictionary();
  // Remember whether the phase has changed since the page opened, so the new panel can take focus.
  const [lastPhase, setLastPhase] = useState(mission.phase);
  const [phaseChanged, setPhaseChanged] = useState(false);
  if (mission.phase !== lastPhase) {
    setLastPhase(mission.phase);
    setPhaseChanged(true);
  }

  // Crisis phases get a caution frame, so the panel that needs a decision stands out.
  const tone = mission.phase === 'crisis' || mission.phase === 'crisis_pending' ? 'caution' : 'default';

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="sr-only">{t.mission.screen.title}</h1>
      <CultivationTimeline mission={mission} />
      {/* The room is the main view; status and the phase panel sit beside it (stacked below on narrow screens). */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-[auto_1fr] lg:items-start">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <PlantCharacter mission={mission} />
        </div>
        <aside
          aria-label={t.mission.screen.side_label}
          className="min-w-0 space-y-4 sm:space-y-6 lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          <PlantStatusPanel mission={mission} />
          <Card
            tone={tone}
            padding="sm"
            aria-live="polite"
            aria-label={t.mission.screen.title}
            className="@container sm:p-5"
          >
            <PhaseChangedContext value={phaseChanged}>
              <PhasePanel mission={mission} crisisStatus={crisisStatus} actions={actions} />
            </PhaseChangedContext>
          </Card>
        </aside>
        <Card aria-labelledby="history-title" className="lg:col-start-1 lg:row-start-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <CardTitle id="history-title">{t.mission.chart.title}</CardTitle>
            <ValueTypeTag type="game_value" />
          </div>
          <StateHistoryChart days={mission.days} current={mission.plant} />
        </Card>
      </div>
    </div>
  );
}

function PhasePanel({
  mission,
  crisisStatus,
  actions,
}: {
  mission: MissionState;
  crisisStatus: CrisisFetchStatus;
  actions: MissionActions;
}) {
  const response = mission.active_crisis?.response ?? null;
  switch (mission.phase) {
    case 'care':
      // A new key per day resets the lighting selection to the day's setting.
      return <CarePanel key={mission.game_day} mission={mission} actions={actions} />;
    case 'crisis':
      if (!response) return <CrisisPendingPanel status={crisisStatus} actions={actions} />;
      return (
        <CrisisPanel
          key={`${response.crisis_id}-${response.attempt}`}
          view={toCrisisView(response)}
          // The action id is looked up here, outside the rendered options.
          onChoose={(index) => {
            const option = response.options[index];
            if (option) actions.chooseOption(option.action_id);
          }}
        />
      );
    case 'crisis_pending':
      return <CrisisPendingPanel status={crisisStatus} actions={actions} />;
    case 'crisis_result':
      return <CrisisResultPanel mission={mission} actions={actions} />;
    case 'night':
      return <NightPanel mission={mission} actions={actions} />;
    default:
      // harvest, freeze, report and failed belong to other screens; PhaseGate redirects.
      return null;
  }
}
