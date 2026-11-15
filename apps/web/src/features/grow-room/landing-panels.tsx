'use client';

import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import { ROUTES, routeForPhase } from '@/features/mission/routes';
import type { MissionMode, MissionState } from '@/lib/contract/types';
import { GAME_DAYS, cultivationDayOf } from '@/lib/game/rules';
import { format, useDictionary } from '@/lib/i18n';
import { cn } from '@/lib/utils/cn';

/**
 * Landing content for narrow windows. On wide windows the same text sits inside
 * the scene monitors (scene tokens, lp-* classes); below the scene it is page UI,
 * so it is built from the design-system parts in components/ui.
 */

export type LandingTab = 'mission' | 'how' | 'before';

const FINISHED = new Set<MissionState['phase']>(['report', 'failed']);
const ID = 'landing';

export function LandingBriefingPanel({
  tab,
  onTab,
  steps,
}: {
  tab: LandingTab;
  onTab: (tab: LandingTab) => void;
  steps: { title: string; body: string }[];
}) {
  const s = useDictionary().mission.start;
  return (
    <Card aria-label={s.briefing_label} padding="sm">
      <Tabs
        label={s.briefing_label}
        idPrefix={ID}
        value={tab}
        onChange={onTab}
        className="-mx-1 -mt-1 mb-3"
        items={[
          { value: 'mission', label: s.tab_mission },
          { value: 'how', label: s.tab_how },
          { value: 'before', label: s.notices_title },
        ]}
      />

      <TabPanel idPrefix={ID} value="mission" selected={tab === 'mission'} className="space-y-3">
        <p className="text-caption font-semibold tracking-[0.2em] text-accent uppercase">{s.eyebrow}</p>
        <h1 className="text-display font-semibold text-balance">{s.title}</h1>
        <div className="space-y-2 text-body leading-relaxed text-ink-muted">
          <p>{format(s.intro, { days: GAME_DAYS })}</p>
          <p>{s.intro_second}</p>
        </div>
      </TabPanel>

      <TabPanel idPrefix={ID} value="how" selected={tab === 'how'}>
        <ol className="flex flex-col gap-2">
          {steps.map((step, i) => (
            <li key={step.title} className="m-1 flex gap-3 pixel-frame-flat pixel-tone-line bg-surface-2 p-3">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center bg-surface-3 font-data text-data-lg text-accent"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-body leading-relaxed text-ink-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </TabPanel>

      <TabPanel idPrefix={ID} value="before" selected={tab === 'before'} className="space-y-3">
        <ul className="list-disc space-y-1 pl-5 text-body text-ink-muted">
          {s.notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
        <p className="text-caption text-ink-faint">{s.demo_note}</p>
        <p className="border-t-2 border-line pt-3 text-body text-ink-muted">
          <Link
            href={ROUTES.sources}
            className="inline-flex min-h-11 items-center font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-accent"
          >
            {s.sources_link}
          </Link>
          <span className="block">{s.sources_note}</span>
        </p>
      </TabPanel>
    </Card>
  );
}

export function LandingSavedPanel({
  ready,
  mission,
  onRequest,
}: {
  ready: boolean;
  mission: MissionState | null;
  onRequest: (mode: MissionMode) => void;
}) {
  const s = useDictionary().mission.start;
  const finished = mission ? FINISHED.has(mission.phase) : false;
  return (
    <Card aria-labelledby={`${ID}-saved`} tone={mission ? 'accent' : 'default'} padding="sm">
      <CardTitle id={`${ID}-saved`}>{s.saved_title}</CardTitle>
      {!ready ? (
        <p role="status" className="mt-1 text-body text-ink-muted">
          {s.loading}
        </p>
      ) : (
        <>
          <p className={cn('mt-1 text-body', !mission && 'text-ink-muted')}>
            {!mission
              ? s.saved_none
              : finished
                ? format(s.saved_finished, { mode: s.mode[mission.mode] })
                : format(s.saved_summary, {
                    day: mission.game_day,
                    days: GAME_DAYS,
                    cultivation_day: cultivationDayOf(mission.game_day),
                    mode: s.mode[mission.mode],
                  })}
          </p>
          <div className="-mx-1 mt-3 flex flex-wrap">
            {mission ? (
              <>
                <Link href={routeForPhase(mission.phase)} className={buttonVariants({ variant: 'primary' })}>
                  {finished ? s.open_finished : s.continue}
                </Link>
                <Button onClick={() => onRequest('standard')}>{s.new_mission}</Button>
                <Button onClick={() => onRequest('demo')}>{s.demo_short}</Button>
              </>
            ) : (
              <>
                <Button variant="primary" onClick={() => onRequest('standard')}>
                  {s.start_standard}
                </Button>
                <Button onClick={() => onRequest('demo')}>{s.start_demo}</Button>
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
