'use client';

import { Badge, type Tone } from '@/components/ui/badge';
import type { CrisisOutcome, MissionState, ReportMetrics, Verdict } from '@/lib/contract/types';
import { format, useDictionary } from '@/lib/i18n';
import { METRICS, cultivationDayOf } from '@/lib/game/rules';
import { SubHeading, TableRegion, td, th } from './parts';
import { missionSummary, verdictShares } from './view-model';

export const VERDICT_TONE: Record<Verdict, Tone> = {
  appropriate: 'normal',
  partial: 'caution',
  inappropriate: 'danger',
};

const VERDICT_BAR: Record<Verdict, string> = {
  appropriate: 'bg-normal',
  partial: 'bg-caution',
  inappropriate: 'bg-danger',
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const t = useDictionary();
  return <Badge tone={VERDICT_TONE[verdict]}>{t.common.verdict[verdict]}</Badge>;
}

export function outcomeText(outcome: CrisisOutcome | null, t: ReturnType<typeof useDictionary>): string {
  return outcome ? t.report.outcome[outcome] : t.report.outcome.in_progress;
}

/** Verdict shares, choices per crisis, and nights in a danger zone. */
export function CrisisMetrics({ mission, metrics }: { mission: MissionState; metrics: ReportMetrics }) {
  const t = useDictionary();
  const m = t.report.metrics;
  const shares = verdictShares(metrics);
  const nights = missionSummary(mission).nights;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <SubHeading>{m.verdicts_title}</SubHeading>
        {metrics.total_choices === 0 ? (
          <p className="text-body text-ink-muted">{m.none}</p>
        ) : (
          <>
            {/* The bar is a picture of the list below; the list carries the numbers. */}
            <div aria-hidden className="flex h-3 overflow-hidden border border-line bg-surface-2">
              {shares
                .filter((s) => s.count > 0)
                .map((s) => (
                  <div
                    key={s.verdict}
                    className={`${VERDICT_BAR[s.verdict]} border-r-2 border-surface last:border-r-0`}
                    style={{ width: `${(s.count / metrics.total_choices) * 100}%` }}
                  />
                ))}
            </div>
            <ul aria-label={m.bar_label} className="grid gap-2 text-body">
              {shares.map((s) => (
                <li key={s.verdict} className="flex flex-wrap items-center justify-between gap-2">
                  <VerdictBadge verdict={s.verdict} />
                  <span className="font-data text-data tabular-nums">
                    {format(m.verdict_row, { count: s.count, total: metrics.total_choices, percent: s.percent })}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="space-y-3">
        <SubHeading>{m.danger_title}</SubHeading>
        <p className="text-body">
          <span className="font-data text-data-lg font-semibold tabular-nums">{metrics.danger_nights}</span>{' '}
          <span className="text-ink-muted">
            {format(m.danger_total, { nights })}
          </span>
        </p>
        <dl className="grid gap-1.5 text-body">
          {METRICS.map((metric) => (
            <div key={metric} className="flex items-center justify-between gap-2 border-b-4 border-surface-2 pb-1.5">
              <dt className="text-ink-muted">{t.common.metric[metric]}</dt>
              <dd className="font-data text-data tabular-nums">
                {format(m.danger_metric, { count: metrics.danger_nights_by_metric[metric], nights })}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {metrics.attempts_per_crisis.length > 0 ? (
        <div className="space-y-3 lg:col-span-2">
          <SubHeading>{m.attempts_title}</SubHeading>
          <TableRegion label={m.attempts_caption}>
            <table className="w-full min-w-[32rem] text-body">
              <caption className="sr-only">{m.attempts_caption}</caption>
              <thead className="border-b-4 border-surface-2">
                <tr>
                  <th scope="col" className={th}>
                    {m.col_crisis}
                  </th>
                  <th scope="col" className={th}>
                    {m.col_day}
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    {m.col_attempts}
                  </th>
                  <th scope="col" className={th}>
                    {m.col_outcome}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y-4 divide-surface">
                {metrics.attempts_per_crisis.map((c) => (
                  <tr key={`${c.crisis_id}-${c.game_day}`}>
                    <th scope="row" className={`${td} text-left font-medium`}>
                      {c.name}
                    </th>
                    <td className={`${td} whitespace-nowrap text-ink-muted`}>
                      {format(m.day_value, { day: c.game_day, cultivation_day: cultivationDayOf(c.game_day) })}
                    </td>
                    <td className={`${td} text-right font-data text-data tabular-nums`}>{c.attempts}</td>
                    <td className={td}>{outcomeText(c.outcome, t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRegion>
        </div>
      ) : null}
    </div>
  );
}
