'use client';

import { SourceCitation } from '@/components/source-citation';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Well } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { ValueTypeTag } from '@/components/value-type-tag';
import { VerdictBanner } from '@/components/verdict-banner';
import type { MissionActions } from '@/features/mission/use-mission';
import type { MissionState, PlantState } from '@/lib/contract/types';
import { format, useDictionary } from '@/lib/i18n';
import { GROUND_SUPPORT_HEALTH } from '@/lib/game/rules';
import { chosenOption, lastAttempt, signed, todayRecord } from './derive';
import { PanelHeading } from './panel-heading';

type ChangeKey = 'plant_health' | 'root_moisture' | 'humidity' | 'fan';
const CHANGE_KEYS: readonly ChangeKey[] = ['plant_health', 'root_moisture', 'humidity', 'fan'];

/** Verdict, the plant's reaction, why, evidence, what changed, sources and what happens next. */
export function CrisisResultPanel({ mission, actions }: { mission: MissionState; actions: MissionActions }) {
  const t = useDictionary();
  const r = t.mission.result;
  const day = todayRecord(mission);
  const attempt = lastAttempt(day);
  const option = chosenOption(mission, attempt);
  const response = mission.active_crisis?.response ?? null;
  const ended = day?.crisis?.outcome != null;
  const crisisName = day?.crisis?.name ?? response?.name;

  if (!attempt) {
    return (
      <div className="space-y-4">
        <PanelHeading>{r.title}</PanelHeading>
        <p role="alert" className="text-body text-ink-muted">
          {r.missing}
        </p>
        <Button variant="primary" onClick={actions.continueAfterResult}>
          {r.next_continue}
        </Button>
      </div>
    );
  }

  const fmt = (key: ChangeKey, s: PlantState): string =>
    key === 'fan' ? t.common.fan_level[s.fan] : String(s[key]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {crisisName ? (
          <p className="font-data text-data text-accent">{format(r.crisis_name, { name: crisisName })}</p>
        ) : null}
        <PanelHeading>{r.title}</PanelHeading>
        <p className="sr-only">{r.verdict_label}</p>
        <VerdictBanner verdict={attempt.verdict} />
        <p className="text-body">
          <span className="text-ink-muted">{r.you_chose} </span>
          <span className="font-medium">{attempt.label}</span>
        </p>
      </div>

      {option?.result_line ? (
        <Well>
          <figure>
            <figcaption className="font-data text-data-sm text-ink-muted">{r.plant_says}</figcaption>
            <blockquote className="mt-1 text-body">“{option.result_line}”</blockquote>
          </figure>
        </Well>
      ) : null}

      {attempt.ground_support ? (
        <Callout role="status" tone="caution">
          {format(r.ground_support, { change: signed(GROUND_SUPPORT_HEALTH) })}
        </Callout>
      ) : null}

      {option ? (
        <div className="space-y-4">
          <TextBlock title={r.why_title} body={option.why} />
          <TextBlock title={r.reason_title} body={option.reason} />
        </div>
      ) : null}

      <section aria-labelledby="result-changes" className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 id="result-changes" className="text-heading font-bold">
            {r.changes_title}
          </h3>
          <ValueTypeTag type={option?.value_type ?? 'game_value'} />
        </div>
        <dl className="divide-y-4 divide-surface bg-surface-2 text-body">
          {CHANGE_KEYS.map((key) => {
            const before = fmt(key, attempt.before);
            const after = fmt(key, attempt.after);
            return (
              <div key={key} className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-ink-muted">{t.common.metric[key]}</dt>
                <dd className={`font-data text-data tabular-nums ${before === after ? 'text-ink-muted' : ''}`}>
                  {format(r.change_row, { before, after })}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      {option ? (
        <Disclosure summary={r.source_title} trailing={<ValueTypeTag type="measured" />}>
          <SourceCitation source={option.source} />
        </Disclosure>
      ) : null}

      {response ? (
        <Disclosure summary={r.record_title} trailing={<ValueTypeTag type="measured" />}>
          {response.record_note ? <p className="text-body">{response.record_note}</p> : null}
          <SourceCitation source={response.crisis_source} />
        </Disclosure>
      ) : null}

      <div className="space-y-3 border-t-4 border-surface-2 pt-5">
        <h3 className="text-heading font-bold">{ended ? r.next_end_title : r.next_continue_title}</h3>
        {attempt.verdict === 'partial' ? <p className="text-body text-ink-muted">{r.partial_note}</p> : null}
        {ended ? <p className="text-body text-ink-muted">{r.next_end_body}</p> : null}
        <Button variant="primary" onClick={actions.continueAfterResult} className="w-full px-6 sm:w-auto">
          {ended ? r.next_end : r.next_continue}
        </Button>
      </div>
    </div>
  );
}

function TextBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-heading font-bold">{title}</h3>
      <p className="text-body text-ink">{body}</p>
    </div>
  );
}
