'use client';

import { Badge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SourceCitation } from '@/components/source-citation';
import { ValueTypeTag } from '@/components/value-type-tag';
import type { MissionActions } from '@/features/mission/use-mission';
import type { MissionState, PlantState, Verdict } from '@/lib/contract/types';
import { format, useDictionary } from '@/lib/i18n';
import { GROUND_SUPPORT_HEALTH } from '@/lib/game/rules';
import { chosenOption, lastAttempt, signed, todayRecord } from './derive';
import { PanelHeading } from './panel-heading';

const verdictTone: Record<Verdict, Tone> = {
  appropriate: 'normal',
  partial: 'caution',
  inappropriate: 'danger',
};

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
        <p role="alert" className="text-sm text-ink-muted">
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
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            {format(r.crisis_name, { name: crisisName })}
          </p>
        ) : null}
        <PanelHeading>{r.title}</PanelHeading>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-muted">{r.verdict_label}</span>
          <Badge tone={verdictTone[attempt.verdict]} className="px-3 py-1 text-sm">
            {t.common.verdict[attempt.verdict]}
          </Badge>
        </div>
        <p className="text-sm">
          <span className="text-ink-muted">{r.you_chose} </span>
          <span className="font-medium">{attempt.label}</span>
        </p>
      </div>

      {option?.result_line ? (
        <figure className="rounded-xl border border-line bg-surface-2 px-4 py-3">
          <figcaption className="text-xs text-ink-muted">{r.plant_says}</figcaption>
          <blockquote className="mt-1 text-base leading-relaxed">{option.result_line}</blockquote>
        </figure>
      ) : null}

      {attempt.ground_support ? (
        <p role="status" className="rounded-lg border border-caution/50 bg-caution/10 px-3 py-2 text-sm">
          {format(r.ground_support, { change: signed(GROUND_SUPPORT_HEALTH) })}
        </p>
      ) : null}

      {option ? (
        <div className="space-y-4">
          <TextBlock title={r.why_title} body={option.why} />
          <TextBlock title={r.reason_title} body={option.reason} />
        </div>
      ) : null}

      <section aria-labelledby="result-changes" className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 id="result-changes" className="text-sm font-semibold">
            {r.changes_title}
          </h3>
          <ValueTypeTag type={option?.value_type ?? 'game_value'} />
        </div>
        <dl className="divide-y divide-line rounded-lg border border-line bg-surface-2 text-sm">
          {CHANGE_KEYS.map((key) => {
            const before = fmt(key, attempt.before);
            const after = fmt(key, attempt.after);
            return (
              <div key={key} className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-ink-muted">{t.common.metric[key]}</dt>
                <dd className={`font-mono tabular-nums ${before === after ? 'text-ink-muted' : ''}`}>
                  {format(r.change_row, { before, after })}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      {option ? (
        <section aria-labelledby="result-source" className="space-y-2">
          <h3 id="result-source" className="text-sm font-semibold">
            {r.source_title}
          </h3>
          <SourceCitation source={option.source} />
        </section>
      ) : null}

      {response ? (
        <section aria-labelledby="result-record" className="space-y-2">
          <h3 id="result-record" className="text-sm font-semibold">
            {r.record_title}
          </h3>
          {response.record_note ? <p className="text-sm">{response.record_note}</p> : null}
          <SourceCitation source={response.crisis_source} />
        </section>
      ) : null}

      <div className="space-y-3 border-t border-line pt-5">
        <h3 className="text-sm font-semibold">{ended ? r.next_end_title : r.next_continue_title}</h3>
        {attempt.verdict === 'partial' ? <p className="text-sm text-ink-muted">{r.partial_note}</p> : null}
        {ended ? <p className="text-sm text-ink-muted">{r.next_end_body}</p> : null}
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
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-ink">{body}</p>
    </div>
  );
}
