'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { ROUTES, routeForPhase } from '@/features/mission/routes';
import { useMission } from '@/features/mission/use-mission';
import type { MissionMode, MissionState } from '@/lib/contract/types';
import { format, useDictionary } from '@/lib/i18n';
import { cn } from '@/lib/utils/cn';
import { LettuceScene } from './lettuce-scene';
import { CULTIVATION_DAYS, GAME_DAYS, MAX_CARE_OPS_PER_DAY, cultivationDayOf } from '@/lib/game/rules';

const FINISHED = new Set<MissionState['phase']>(['report', 'failed']);

/** Start screen: what this is, how a mission works, standing notices, and start or continue. */
export function StartScreen() {
  const t = useDictionary();
  const s = t.mission.start;
  const router = useRouter();
  const { ready, mission, actions } = useMission();
  const [confirming, setConfirming] = useState<MissionMode | null>(null);

  const begin = (mode: MissionMode) => {
    actions.start(mode);
    router.push(ROUTES.mission);
  };

  const request = (mode: MissionMode) => {
    if (mission) setConfirming(mode);
    else begin(mode);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-10 py-4 sm:py-8">
      <header className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <p className="text-caption font-semibold tracking-[0.2em] text-accent uppercase">{s.eyebrow}</p>
          <h1 className="text-display font-semibold tracking-tight text-balance sm:text-display">{s.title}</h1>
          <div className="max-w-2xl space-y-2 text-body leading-relaxed text-ink-muted">
            <p>{format(s.intro, { days: GAME_DAYS })}</p>
            <p>{s.intro_second}</p>
          </div>
        </div>
        <LettuceScene sprite="S0_sprout" label="" />
      </header>

      <section aria-labelledby="start-steps" className="space-y-4">
        <h2 id="start-steps" className="text-heading font-semibold">
          {s.steps_title}
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {s.steps.map((step, i) => (
            <li key={step.title} className="m-1 pixel-frame pixel-tone-line bg-surface p-4">
              <span
                aria-hidden
                className="mb-3 flex size-10 items-center justify-center bg-surface-2 font-data text-data-lg text-accent"
              >
                {i + 1}
              </span>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="mt-1 text-body leading-relaxed text-ink-muted">
                {format(step.body, {
                  ops: MAX_CARE_OPS_PER_DAY,
                  harvest_day: CULTIVATION_DAYS[CULTIVATION_DAYS.length - 1],
                })}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="start-actions" className="space-y-4">
        <h2 id="start-actions" className="sr-only">
          {s.actions_title}
        </h2>
        {!ready ? (
          <p role="status" className="text-body text-ink-muted">
            {s.loading}
          </p>
        ) : confirming && mission ? (
          <ConfirmReplace
            mission={mission}
            mode={confirming}
            onConfirm={() => begin(confirming)}
            onCancel={() => setConfirming(null)}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {mission ? <SavedMission mission={mission} /> : null}
            <Card aria-labelledby="start-new" className={mission ? '' : 'md:col-span-2'}>
              <CardTitle id="start-new" className="sr-only">
                {s.actions_title}
              </CardTitle>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  variant={mission ? 'secondary' : 'primary'}
                  onClick={() => request('standard')}
                  className="px-6"
                >
                  {s.start_standard}
                </Button>
                <Button onClick={() => request('demo')} className="px-6">
                  {s.start_demo}
                </Button>
              </div>
              <p className="mt-3 text-body text-ink-muted">{s.demo_note}</p>
            </Card>
          </div>
        )}
      </section>

      <section aria-labelledby="start-notices" className="bg-surface-2 p-4 sm:p-5">
        <h2 id="start-notices" className="text-body font-semibold">
          {s.notices_title}
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-body text-ink-muted">
          {s.notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      </section>

      <p className="text-body text-ink-muted">
        <Link
          href={ROUTES.sources}
          className="inline-flex min-h-11 items-center font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-accent"
        >
          {s.sources_link}
        </Link>
        <span className="block sm:ml-2 sm:inline">{s.sources_note}</span>
      </p>
    </div>
  );
}

function SavedMission({ mission }: { mission: MissionState }) {
  const s = useDictionary().mission.start;
  const finished = FINISHED.has(mission.phase);
  const mode = s.mode[mission.mode];
  return (
    <Card aria-labelledby="saved-mission" tone="accent">
      <CardTitle id="saved-mission">{s.saved_title}</CardTitle>
      <p className="mt-2 text-body">
        {finished
          ? format(s.saved_finished, { mode })
          : format(s.saved_summary, {
              day: mission.game_day,
              days: GAME_DAYS,
              cultivation_day: cultivationDayOf(mission.game_day),
              mode,
            })}
      </p>
      <Link
        href={routeForPhase(mission.phase)}
        className={cn(buttonVariants({ variant: 'primary' }), 'mt-4')}
      >
        {finished ? s.open_finished : s.continue}
      </Link>
    </Card>
  );
}

/** In-page confirmation before a new mission replaces the saved one. */
function ConfirmReplace({
  mission,
  mode,
  onConfirm,
  onCancel,
}: {
  mission: MissionState;
  mode: MissionMode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const s = useDictionary().mission.start;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div
      role="group"
      aria-labelledby="confirm-replace"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      className="m-1 pixel-frame pixel-tone-caution bg-surface p-4 sm:p-5"
    >
      <h3 id="confirm-replace" ref={headingRef} tabIndex={-1} className="font-semibold focus:outline-none">
        {s.confirm_title}
      </h3>
      <p className="mt-2 text-body text-ink-muted">
        {format(s.confirm_body, { mode: s.confirm_mode[mode] })}
      </p>
      <p className="mt-1 text-body">
        {FINISHED.has(mission.phase)
          ? format(s.saved_finished, { mode: s.mode[mission.mode] })
          : format(s.saved_summary, {
              day: mission.game_day,
              days: GAME_DAYS,
              cultivation_day: cultivationDayOf(mission.game_day),
              mode: s.mode[mission.mode],
            })}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" onClick={onConfirm} className="px-6">
          {s.confirm_yes}
        </Button>
        <Button onClick={onCancel} className="px-6">
          {s.confirm_no}
        </Button>
      </div>
    </div>
  );
}
