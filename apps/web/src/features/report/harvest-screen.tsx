'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { PixelIcon } from '@/components/ui/pixel-icon';
import { Stepper } from '@/components/ui/stepper';
import { ValueTypeTag } from '@/components/value-type-tag';
import { PhaseGate } from '@/features/mission/phase-gate';
import { ROUTES } from '@/features/mission/routes';
import { useMission, type MissionActions } from '@/features/mission/use-mission';
import type { MissionState } from '@/lib/contract/types';
import { evidence } from '@/lib/evidence';
import { format, useDictionary } from '@/lib/i18n';
import { GAME_DAYS, MICROBIAL, cultivationDayOf } from '@/lib/game/rules';
import { GradeBadge, PageHeader, PlantStateList, StepEvidence, useFocusOnMount } from './parts';
import { fixed2, gradeBands, gradeForHealth } from './view-model';

/** The /harvest screen: harvest on game day 7, then freeze the samples for return. */
export function HarvestScreen() {
  const { actions } = useMission();
  return (
    <PhaseGate route={ROUTES.harvest} fallback={<Loading />}>
      {(mission) => <HarvestSteps mission={mission} actions={actions} />}
    </PhaseGate>
  );
}

export function Loading() {
  const t = useDictionary();
  return (
    <div role="status" className="flex min-h-64 items-center justify-center text-body text-ink-muted">
      {t.report.loading}
    </div>
  );
}

function HarvestSteps({ mission, actions }: { mission: MissionState; actions: MissionActions }) {
  // Focus moves to the freeze heading only after the player harvested on this page.
  const [startPhase] = useState(mission.phase);
  return mission.phase === 'freeze' ? (
    <FreezeStep mission={mission} actions={actions} focus={startPhase !== 'freeze'} />
  ) : (
    <HarvestStep mission={mission} actions={actions} />
  );
}

function stepOf(id: 'harvest_sanitize' | 'freeze_return') {
  return evidence.harvest.steps.find((s) => s.step_id === id);
}

function HarvestStep({ mission, actions }: { mission: MissionState; actions: MissionActions }) {
  const t = useDictionary();
  const h = t.report.harvest;
  const health = mission.plant.plant_health;
  const grade = gradeForHealth(health);
  const unit = evidence.harvest.microbial_range.unit;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow={format(h.eyebrow, {
          day: GAME_DAYS,
          cultivation_day: cultivationDayOf(GAME_DAYS),
          stage: t.common.growth_stage.harvest,
        })}
        title={h.title}
      >
        <p>{h.intro}</p>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <Card aria-labelledby="harvest-state">
          <div className="mb-2 flex items-center justify-between gap-2">
            <CardTitle id="harvest-state">{h.state_title}</CardTitle>
            <ValueTypeTag type="game_value" />
          </div>
          <PlantStateList state={mission.plant} />
        </Card>

        <Card aria-labelledby="harvest-grade">
          <div className="mb-3 flex items-center justify-between gap-2">
            <CardTitle id="harvest-grade">{h.grade_title}</CardTitle>
            <ValueTypeTag type="game_value" />
          </div>
          <p className="flex flex-wrap items-center gap-2 text-body">
            <GradeBadge grade={grade} />
            <span>{format(h.grade_result, { health, grade: t.report.grade[grade] })}</span>
          </p>
          <GradeBands current={grade} label={h.grade_bands_label} />
          <p className="mt-3 text-body text-ink-muted">{h.grade_note}</p>
        </Card>
      </div>

      <Card aria-labelledby="harvest-step">
        <CardTitle id="harvest-step" className="mb-3">
          {h.step_title}
        </CardTitle>
        <StepEvidence step={stepOf('harvest_sanitize')} />
      </Card>

      <section
        aria-labelledby="harvest-choice"
        className="m-1 pixel-frame pixel-tone-accent bg-surface p-4 sm:p-6"
      >
        <h2 id="harvest-choice" className="text-heading font-semibold">
          {h.choice_title}
        </h2>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-body text-ink-muted">
          <ValueTypeTag type="game_value" />
          <span>
            {format(h.sanitize_note, { amount: fixed2(Math.abs(MICROBIAL.harvest_sanitize)), unit })}
          </span>
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button variant="primary" className="px-6" onClick={() => actions.harvestCrop(true)}>
            {h.sanitize_button}
          </Button>
          <Button className="px-6" onClick={() => actions.harvestCrop(false)}>
            {h.plain_button}
          </Button>
        </div>
      </section>
    </div>
  );
}

function GradeBands({ current, label }: { current: ReturnType<typeof gradeForHealth>; label: string }) {
  const t = useDictionary();
  const b = t.report.grade_band;
  return (
    <ul aria-label={label} className="mt-4 grid gap-1.5 text-body">
      {gradeBands().map((band) => {
        const range =
          band.min !== null && band.max !== null
            ? format(b.range, { min: band.min, max: band.max })
            : band.min !== null
              ? format(b.min_only, { min: band.min })
              : format(b.max_only, { max: band.max ?? 0 });
        const active = band.grade === current;
        return (
          <li
            key={band.grade}
            aria-current={active ? 'true' : undefined}
            className={`m-1 flex items-center justify-between gap-2 pixel-frame-flat px-3 py-1.5 ${
              active ? 'bg-surface-2 text-ink pixel-tone-accent' : 'text-ink-muted pixel-tone-line'
            }`}
          >
            <span className={active ? 'font-semibold' : ''}>{t.report.grade[band.grade]}</span>
            <span className="font-data text-data-sm tabular-nums">{range}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Icons of the three closing steps (planning document ⑥ ⑦ ⑧). */
const FLOW_ICON = { harvest: 'pruner', freeze: 'earth', ground: 'scope' } as const;

function FreezeStep({ mission, actions, focus }: { mission: MissionState; actions: MissionActions; focus: boolean }) {
  const t = useDictionary();
  const f = t.report.freeze;
  const headingRef = useFocusOnMount<HTMLHeadingElement>(focus);
  const harvest = mission.harvest;
  const flow = [
    { key: 'harvest', state: 'done' },
    { key: 'freeze', state: 'current' },
    { key: 'ground', state: 'next' },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow={format(f.eyebrow, { day: GAME_DAYS, cultivation_day: cultivationDayOf(GAME_DAYS) })}
        title={f.title}
        headingRef={headingRef}
      >
        {harvest ? (
          <p className="flex flex-wrap items-center gap-2">
            <GradeBadge grade={harvest.grade} />
            <span>
              {format(f.harvested, { grade: t.report.grade[harvest.grade], health: harvest.final_health })}{' '}
              {harvest.sanitized ? f.harvested_sanitized : f.harvested_plain}
            </span>
            <ValueTypeTag type="game_value" />
          </p>
        ) : null}
      </PageHeader>

      <Stepper
        aria-label={f.flow_label}
        className="flex-wrap"
        stateLabels={{ done: f.flow_state.done, current: f.flow_state.current, upcoming: f.flow_state.next }}
        steps={flow.map((step, i) => ({
          id: step.key,
          index: String(i + 6),
          label: f.flow[step.key],
          state: step.state === 'next' ? 'upcoming' : step.state,
          icon: <PixelIcon name={FLOW_ICON[step.key]} size="sm" />,
        }))}
      />

      <Card aria-labelledby="freeze-step">
        <CardTitle id="freeze-step" className="mb-3">
          {f.step_title}
        </CardTitle>
        <StepEvidence step={stepOf('freeze_return')} />
      </Card>

      <div>
        <Button variant="primary" className="w-full px-6 sm:w-auto" onClick={() => actions.confirmFreeze()}>
          {f.confirm}
        </Button>
      </div>
    </div>
  );
}
