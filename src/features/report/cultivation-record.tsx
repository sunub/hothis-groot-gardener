'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { ZoneBadge } from '@/components/zone-badge';
import { format, useDictionary } from '@/lib/i18n';
import { METRICS } from '@/lib/game/rules';
import { VerdictBadge, outcomeText } from './crisis-metrics';
import { PlantStateList, careText } from './parts';
import { signed, type DayRow } from './view-model';

/** One entry per game day: morning state, care, crisis choices, the night and the day's health change. */
export function CultivationRecord({ rows }: { rows: readonly DayRow[] }) {
  const t = useDictionary();
  const r = t.report.record;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">{r.intro}</p>
      <ol className="space-y-3">
        {rows.map((row) => (
          <li key={row.gameDay}>
            <DayEntry row={row} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-2">
      <h4 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</h4>
      {children}
    </div>
  );
}

function DayEntry({ row }: { row: DayRow }) {
  const t = useDictionary();
  const r = t.report.record;
  const isHarvestDay = row.stage === 'harvest';

  return (
    <article
      aria-labelledby={`day-${row.gameDay}`}
      className={`rounded-lg border bg-surface-2/40 p-4 break-inside-avoid ${
        row.failedHere ? 'border-danger/60' : 'border-line'
      }`}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id={`day-${row.gameDay}`} className="font-semibold">
          {format(r.day_title, { day: row.gameDay, cultivation_day: row.cultivationDay })}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <Badge>{t.common.growth_stage[row.stage]}</Badge>
          {row.failedHere ? <Badge tone="danger">{r.failed_here}</Badge> : null}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Block title={r.morning}>
          <PlantStateList state={row.morning} compact />
        </Block>

        {row.crisis ? (
          <Block title={r.crisis}>
            <p className="text-sm font-medium">
              {format(r.crisis_name, { name: row.crisis.name, stage: row.crisis.maxStage })}
            </p>
            <ol className="space-y-2 text-sm">
              {row.crisis.choices.map((c) => (
                <li key={c.attempt} className="space-y-1 border-l-2 border-line pl-3">
                  <p>{format(r.choice, { attempt: c.attempt, stage: c.stage, label: c.label })}</p>
                  <p className="flex flex-wrap items-center gap-2 text-ink-muted">
                    <VerdictBadge verdict={c.verdict} />
                    <span className="font-mono tabular-nums">
                      {format(r.choice_health, { before: c.healthBefore, after: c.healthAfter })}
                    </span>
                    {c.groundSupport ? <Badge>{r.choice_ground_support}</Badge> : null}
                  </p>
                </li>
              ))}
            </ol>
            <p className="text-sm">
              {format(r.outcome, { outcome: outcomeText(row.crisis.outcome, t) })}
            </p>
          </Block>
        ) : (
          <Block title={r.care}>
            {row.care.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {row.care.map((op, i) => (
                  <li key={i}>{careText(op, t)}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">{t.report.care.none}</p>
            )}
          </Block>
        )}

        <Block title={r.night}>
          {row.night ? (
            <dl className="grid gap-1.5 text-sm">
              {METRICS.map((metric) => (
                <div key={metric} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <dt className="text-ink-muted">{t.common.metric[metric]}</dt>
                  <dd className="flex items-center gap-2">
                    <span className="font-mono tabular-nums">
                      {format(r.night_drift, { change: signed(row.night?.drift[metric] ?? 0) })}
                    </span>
                    {row.night ? <ZoneBadge zone={row.night.zones[metric]} /> : null}
                  </dd>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-x-2">
                <dt className="sr-only">{t.common.metric.plant_health}</dt>
                <dd className="font-mono tabular-nums">
                  {format(r.night_health, { change: signed(row.night.health_change) })}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-ink-muted">
              {isHarvestDay ? r.no_night_harvest : r.no_night_failed}
            </p>
          )}
        </Block>
      </div>

      {/* A day of a crisis keeps its care list empty; show it only when there is something to show. */}
      {row.crisis && row.care.length > 0 ? (
        <div className="mt-3">
          <Block title={r.care}>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {row.care.map((op, i) => (
                <li key={i}>{careText(op, t)}</li>
              ))}
            </ul>
          </Block>
        </div>
      ) : null}

      <p className="mt-3 border-t border-line pt-3 font-mono text-sm tabular-nums">
        {format(r.day_health, {
          before: row.morning.plant_health,
          after: row.end.plant_health,
          change: signed(row.healthChange),
        })}
      </p>
    </article>
  );
}
