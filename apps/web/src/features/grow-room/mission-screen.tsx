'use client';

import { useMemo, useState } from 'react';
import { StateHistoryChart } from '@/components/state-history-chart';
import { Card, CardTitle } from '@/components/ui/card';
import { ValueTypeTag } from '@/components/value-type-tag';
import { PhaseGate } from '@/features/mission/phase-gate';
import { ROUTES } from '@/features/mission/routes';
import { useMission, type CrisisFetchStatus, type MissionActions } from '@/features/mission/use-mission';
import type { MissionState } from '@/lib/contract/types';
import { CultivationDiary } from '@/features/timeline/cultivation-diary';
import { diaryLines } from '@/features/timeline/diary';
import { DiaryDrawer } from '@/features/timeline/diary-drawer';
import { useDiaryTranslation } from '@/features/timeline/use-diary-translation';
import type { EventCardResponse } from '@/lib/contract/schemas';
import { eventList } from '@/lib/events';
import { localizeEventList } from '@/lib/events/localize';
import { format, useDictionary, useLocale } from '@/lib/i18n';
import { CarePanel } from './care-panel';
import { CrisisPanel, toCrisisView } from './crisis-panel';
import { CrisisPendingPanel } from './crisis-pending-panel';
import { CrisisResultPanel } from './crisis-result-panel';
import { CultivationTimeline } from './cultivation-timeline';
import { EventCardSection } from './event-card-section';
import { NightPanel } from './night-panel';
import { PhaseChangedContext } from './panel-heading';
import { PlantCharacter } from './plant-character';
import { PlantStatusPanel } from './plant-status-panel';

/** The /mission screen: gate to the mission phases that belong here, then the grow room. */
export function MissionScreen() {
  const { crisisStatus, eventCard, eventStatus, actions } = useMission();
  return (
    <PhaseGate route={ROUTES.mission} fallback={<GrowRoomLoading />}>
      {(mission) => (
        <GrowRoom
          mission={mission}
          crisisStatus={crisisStatus}
          eventCard={eventCard}
          eventStatus={eventStatus}
          actions={actions}
        />
      )}
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
  eventCard,
  eventStatus,
  actions,
}: {
  mission: MissionState;
  crisisStatus: CrisisFetchStatus;
  eventCard: EventCardResponse | null;
  eventStatus: CrisisFetchStatus;
  actions: MissionActions;
}) {
  const t = useDictionary();
  const { locale } = useLocale();
  // Remember whether the phase has changed since the page opened, so the new panel can take focus.
  const [lastPhase, setLastPhase] = useState(mission.phase);
  const [phaseChanged, setPhaseChanged] = useState(false);
  if (mission.phase !== lastPhase) {
    setLastPhase(mission.phase);
    setPhaseChanged(true);
  }

  // Crisis phases get a caution frame, so the panel that needs a decision stands out.
  const tone =
    mission.phase === 'crisis' || mission.phase === 'crisis_pending' || mission.timeline?.pending_event
      ? 'caution'
      : 'default';
  // Missions with a timeline: an event card stops time and takes the place of the day's panel.
  const sourceDiary = useMemo(
    () =>
      mission.timeline
        ? diaryLines(mission.timeline.log, [], mission.timeline.cultivation_day, localizeEventList(eventList, locale))
        : null,
    [mission.timeline, locale],
  );
  // Korean screen: the English experiment and observation lines are translated by the language model.
  const translatedDiary = useDiaryTranslation(sourceDiary ?? [], locale);
  const diary = sourceDiary ? translatedDiary : null;

  const s = t.mission.screen;
  const alerting = tone === 'caution';
  const cultivationDay = mission.timeline?.cultivation_day ?? mission.days.find((d) => d.game_day === mission.game_day)?.cultivation_day ?? mission.game_day;

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="sr-only">{s.title}</h1>
      {alerting ? <AlertBanner cultivationDay={cultivationDay} /> : null}
      <CultivationTimeline mission={mission} />
      {/* The cultivation diary: a tab on the right edge opens it as a drawer. */}
      {diary ? (
        <DiaryDrawer>
          <CultivationDiary inDrawer lines={diary} />
        </DiaryDrawer>
      ) : null}
      {/* Three columns: observe the room, read the gauges, act. They stack on narrow screens. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,4fr)] lg:items-stretch lg:gap-6">
        <section aria-label={s.col_observe} className="flex min-w-0 flex-col gap-4">
          <ColumnHeading n="01" label={s.col_observe} />
          <PlantCharacter mission={mission} />
          <Card aria-labelledby="history-title" className="flex-1">
            <div className="mb-3 flex items-center justify-between gap-2">
              <CardTitle id="history-title">{t.mission.chart.title}</CardTitle>
              <ValueTypeTag type="game_value" />
            </div>
            <StateHistoryChart days={mission.days} current={mission.plant} />
          </Card>
        </section>
        <section aria-label={s.col_status} className="flex min-w-0 flex-col gap-4">
          <ColumnHeading n="02" label={s.col_status} />
          <PlantStatusPanel mission={mission} className="flex-1" />
        </section>
        <section
          id="act"
          aria-label={alerting ? s.col_decide : s.col_act}
          className="flex min-w-0 scroll-mt-4 flex-col gap-4"
        >
          <ColumnHeading n="03" label={alerting ? s.col_decide : s.col_act} caution={alerting} />
          <Card
            tone={tone}
            padding="sm"
            aria-live="polite"
            aria-label={s.title}
            className="@container flex-1 sm:p-4"
          >
            <PhaseChangedContext value={phaseChanged}>
              <EventCardSection mission={mission} eventCard={eventCard} eventStatus={eventStatus} actions={actions}>
                <PhasePanel mission={mission} crisisStatus={crisisStatus} actions={actions} />
              </EventCardSection>
            </PhaseChangedContext>
          </Card>
        </section>
      </div>
    </div>
  );
}

/** Numbered column title with a rule: 01, 02, 03 give the order to read the screen in. */
function ColumnHeading({ n, label, caution = false }: { n: string; label: string; caution?: boolean }) {
  return (
    <div className="mb-1 flex items-center gap-3 pt-2">
      <span
        aria-hidden
        className={`px-2 py-1 font-data text-data leading-none ${caution ? 'bg-caution text-bg' : 'bg-accent text-accent-ink'}`}
      >
        {n}
      </span>
      <h2 className="font-title text-heading font-bold leading-tight">{label}</h2>
      <span aria-hidden className={`h-0.5 flex-1 ${caution ? 'bg-caution' : 'bg-line'}`} />
    </div>
  );
}

/** Crisis alert across the top: what happened, and a link that jumps to the decision column. */
function AlertBanner({ cultivationDay }: { cultivationDay: number }) {
  const s = useDictionary().mission.screen;
  return (
    <div role="alert" className="m-1 border-2 border-caution bg-caution/10">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center bg-caution font-data text-data-lg leading-none text-bg animate-pulse motion-reduce:animate-none"
        >
          △
        </span>
        <div className="min-w-0 flex-1 basis-72">
          <h2 className="font-title text-heading font-bold leading-snug text-white">{s.alert_title}</h2>
          <p className="text-body">
            <span className="font-bold text-caution">{format(s.alert_lead, { cultivation_day: cultivationDay })}</span>
            {' · '}
            {s.alert_hint}
          </p>
        </div>
        <a
          href="#act"
          className="inline-flex min-h-9 items-center gap-2 bg-caution px-4 font-bold text-bg hover:brightness-110"
        >
          {s.alert_go}
          <span aria-hidden>↓</span>
        </a>
      </div>
      <div
        aria-hidden
        className="h-1.5 bg-[repeating-linear-gradient(135deg,var(--color-caution)_0_14px,#1a1405_14px_28px)]"
      />
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
          overnightChange={mission.days[mission.days.length - 1]?.overnight_change}
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
