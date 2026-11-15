'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StateHistoryChart } from '@/components/state-history-chart';
import { Button, buttonVariants } from '@/components/ui/button';
import { ValueTypeTag } from '@/components/value-type-tag';
import { PhaseGate } from '@/features/mission/phase-gate';
import { ROUTES } from '@/features/mission/routes';
import { useMission, type MissionActions } from '@/features/mission/use-mission';
import type { HarvestRecord, MissionState } from '@/lib/contract/types';
import { useEvidence } from '@/lib/evidence/use-evidence';
import { format, useDictionary } from '@/lib/i18n';
import { computeReportMetrics } from '@/lib/game/engine';
import { HEALTH_MIN } from '@/lib/game/rules';
import { CrisisMetrics, VerdictBadge, outcomeText } from './crisis-metrics';
import { CultivationRecord } from './cultivation-record';
import { Loading } from './harvest-screen';
import { FactorTableView, MicrobialValue, PathogenScreen } from './microbial-panel';
import { GradeBadge, PageHeader, Section } from './parts';
import { dayRows, failureSummary, missionSummary, signed, type FailureSummary } from './view-model';

/** The /report screen: the ground analysis report, or the cultivation record summary of a failed mission. */
export function ReportScreen() {
  const { actions } = useMission();
  return (
    <PhaseGate route={ROUTES.report} fallback={<Loading />}>
      {(mission) => <Report mission={mission} actions={actions} />}
    </PhaseGate>
  );
}

type SectionId = 'microbial' | 'pathogen' | 'factors' | 'crises' | 'history' | 'record';

function Report({ mission, actions }: { mission: MissionState; actions: MissionActions }) {
  const t = useDictionary();
  const evidence = useEvidence();
  const metrics = useMemo(() => computeReportMetrics(mission), [mission]);
  const rows = useMemo(() => dayRows(mission), [mission]);
  const failed = mission.phase === 'failed';
  const harvest = failed ? null : mission.harvest;

  const titles: Record<SectionId, string> = {
    microbial: t.report.report.microbial.title,
    pathogen: t.report.report.pathogen.title,
    factors: t.report.report.factors.title,
    crises: t.report.metrics.title,
    history: t.report.history.title,
    record: t.report.record.title,
  };
  const order: SectionId[] = harvest
    ? ['microbial', 'pathogen', 'factors', 'crises', 'history', 'record']
    : ['crises', 'history', 'record'];
  const unit = evidence.harvest.microbial_range.unit;

  return (
    <div className="mx-auto max-w-5xl space-y-6 print:bg-bg print:[print-color-adjust:exact]">
      {harvest ? (
        <PageHeader
          eyebrow={format(t.report.report.eyebrow, { crop: t.common.crop_name })}
          title={t.report.report.title}
        >
          <p>{t.report.report.intro}</p>
        </PageHeader>
      ) : (
        <PageHeader
          eyebrow={format(t.report.failed.eyebrow, { crop: t.common.crop_name })}
          title={t.report.failed.title}
        />
      )}

      {harvest ? <SummaryStrip mission={mission} harvest={harvest} /> : <FailureStatement mission={mission} />}

      <nav aria-label={t.report.report.contents_label} className="print:hidden">
        <ol className="flex flex-wrap gap-2 text-body">
          {order.map((id, i) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                <span aria-hidden className="font-data text-data-sm">
                  {i + 1}
                </span>
                {titles[id]}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {harvest ? (
        <>
          <Section id="microbial" title={titles.microbial} tags={['game_value', 'measured']}>
            <MicrobialValue result={harvest.microbial} harvest={evidence.harvest} />
          </Section>
          <Section id="pathogen" title={titles.pathogen} tags={['measured']}>
            <PathogenScreen harvest={evidence.harvest} />
          </Section>
          <Section id="factors" title={titles.factors} tags={['game_value']}>
            <FactorTableView result={harvest.microbial} unit={unit} />
          </Section>
        </>
      ) : null}

      <Section id="crises" title={titles.crises} tags={['game_value']}>
        <CrisisMetrics mission={mission} metrics={metrics} />
      </Section>

      <Section id="history" title={titles.history} tags={['game_value']}>
        {/* A failed mission ends between mornings; the extra point shows the drop to 0. */}
        <StateHistoryChart days={mission.days} current={failed ? mission.plant : undefined} />
      </Section>

      <Section id="record" title={titles.record} tags={['game_value']}>
        <CultivationRecord rows={rows} />
      </Section>

      <FooterActions actions={actions} />
    </div>
  );
}

function SummaryStrip({ mission, harvest }: { mission: MissionState; harvest: HarvestRecord }) {
  const t = useDictionary();
  const s = t.report.report.summary;
  const summary = missionSummary(mission);
  const cell = 'min-w-0 space-y-1.5 p-4';
  const label = 'text-caption font-semibold tracking-wide text-ink-muted uppercase';

  return (
    <section aria-labelledby="summary-title" className="m-1 pixel-frame pixel-tone-line bg-surface">
      <div className="flex items-center justify-between gap-2 border-b-4 border-surface-2 px-4 py-3">
        <h2 id="summary-title" className="text-body font-semibold">
          {s.title}
        </h2>
        <ValueTypeTag type="game_value" />
      </div>
      <dl className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
        <div className={`${cell} col-span-2 sm:col-span-1`}>
          <dt className={label}>{s.grade}</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <span className="text-heading font-semibold">{t.report.grade[harvest.grade]}</span>
            <GradeBadge grade={harvest.grade} />
          </dd>
          <dd className="text-body text-ink-muted">{format(s.health, { health: harvest.final_health })}</dd>
        </div>
        <div className={cell}>
          <dt className={label}>{s.mode}</dt>
          <dd className="text-body">
            {format(s.mode_value, { mode: t.report.mode[mission.mode], seed: mission.seed })}
          </dd>
        </div>
        <div className={cell}>
          <dt className={label}>{s.crises}</dt>
          <dd className="font-data text-data-lg font-semibold tabular-nums">{summary.crises}</dd>
        </div>
        <div className={cell}>
          <dt className={label}>{s.choices}</dt>
          <dd className="font-data text-data-lg font-semibold tabular-nums">{summary.choices}</dd>
        </div>
      </dl>
    </section>
  );
}

function FailureStatement({ mission }: { mission: MissionState }) {
  const t = useDictionary();
  const f = t.report.failed;
  const summary = failureSummary(mission);
  const s = t.report.report.summary;
  return (
    <section aria-labelledby="failure-title" className="space-y-4 m-1 pixel-frame pixel-tone-danger bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="failure-title" className="text-heading font-semibold">
          {summary
            ? format(f.statement, { day: summary.gameDay, cultivation_day: summary.cultivationDay, min: HEALTH_MIN })
            : f.cause_unknown}
        </h2>
        <ValueTypeTag type="game_value" />
      </div>
      <p className="text-body text-ink-muted">{f.no_harvest}</p>
      {summary ? <FailureCauseView summary={summary} /> : null}
      <p className="text-body text-ink-muted">
        {format(s.mode_value, { mode: t.report.mode[mission.mode], seed: mission.seed })}
      </p>
      <p className="text-body text-ink-muted">{f.review}</p>
    </section>
  );
}

function FailureCauseView({ summary }: { summary: FailureSummary }) {
  const t = useDictionary();
  const f = t.report.failed;
  const cause = summary.cause;
  return (
    <div className="space-y-2">
      <h3 className="text-body font-semibold tracking-wide text-ink-muted uppercase">{f.cause_title}</h3>
      {cause.kind === 'crisis' ? (
        <>
          <p className="flex flex-wrap items-center gap-2">
            <VerdictBadge verdict={cause.verdict} />
            <span>
              {format(f.cause_crisis, {
                name: cause.crisisName,
                label: cause.label,
                verdict: t.common.verdict[cause.verdict],
                before: cause.healthBefore,
                after: cause.healthAfter,
              })}
            </span>
          </p>
          {cause.groundSupport ? <p className="text-body">{f.cause_ground_support}</p> : null}
        </>
      ) : cause.kind === 'night' ? (
        <>
          <p>
            {format(f.cause_night, {
              root_zone: t.common.zone[cause.zones.root_moisture],
              humidity_zone: t.common.zone[cause.zones.humidity],
              change: signed(cause.healthChange),
              before: cause.healthBefore,
              min: HEALTH_MIN,
            })}
          </p>
          {cause.earlierCrisis ? (
            <p className="text-body text-ink-muted">
              {format(f.cause_night_crisis, {
                name: cause.earlierCrisis.name,
                outcome: outcomeText(cause.earlierCrisis.outcome, t),
              })}
            </p>
          ) : null}
        </>
      ) : (
        <p>{f.cause_unknown}</p>
      )}
    </div>
  );
}

function FooterActions({ actions }: { actions: MissionActions }) {
  const t = useDictionary();
  const a = t.report.actions;
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  useEffect(() => {
    if (confirming) headingRef.current?.focus();
    else if (wasConfirming.current) newButtonRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  const restart = () => {
    actions.reset();
    router.push(ROUTES.home);
  };

  return (
    <section aria-labelledby="report-actions" className="space-y-4 m-1 pixel-frame pixel-tone-line bg-surface p-4 sm:p-6 print:hidden">
      <h2 id="report-actions" className="text-heading font-semibold">
        {a.title}
      </h2>
      {confirming ? (
        <div
          role="group"
          aria-labelledby="confirm-reset"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setConfirming(false);
          }}
          className="m-1 pixel-frame pixel-tone-caution bg-surface p-4"
        >
          <h3 id="confirm-reset" ref={headingRef} tabIndex={-1} className="font-semibold focus:outline-none">
            {a.confirm_title}
          </h3>
          <p className="mt-2 text-body text-ink-muted">{a.confirm_body}</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button variant="primary" onClick={restart}>
              {a.confirm_yes}
            </Button>
            <Button onClick={() => setConfirming(false)}>{a.confirm_no}</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button ref={newButtonRef} variant="primary" className="px-6" onClick={() => setConfirming(true)}>
            {a.new_mission}
          </Button>
          <Link
            href={ROUTES.sources}
            className={buttonVariants({ variant: 'secondary' })}
          >
            {a.sources}
          </Link>
        </div>
      )}
    </section>
  );
}
