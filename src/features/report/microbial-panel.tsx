'use client';

import type { ReactNode } from 'react';
import { SourceCitation } from '@/components/source-citation';
import { ValueTypeTag } from '@/components/value-type-tag';
import type { HarvestEvidence, MicrobialResult } from '@/lib/contract/types';
import { format, useDictionary } from '@/lib/i18n';
import { MICROBIAL, MOLD_STAGE } from '@/lib/game/rules';
import { SubHeading, TableRegion, factorRuleText, td, th } from './parts';
import { factorTable, fixed2, microbialScale, sameSource, signed } from './view-model';

/** Calculated value, the scale against the observed range, the result and the mandatory caveat. */
export function MicrobialValue({ result, harvest }: { result: MicrobialResult; harvest: HarvestEvidence }) {
  const t = useDictionary();
  const m = t.report.report.microbial;
  const range = harvest.microbial_range;
  const unit = range.unit;
  const scale = microbialScale(result.value, range);
  const value = fixed2(result.value);
  const shared = sameSource(range.source, harvest.standards_note.source);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-ink-muted">{m.value_label}</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-4xl font-semibold tracking-tight text-game tabular-nums sm:text-5xl">
              {value}
            </span>
            <span className="text-sm text-ink-muted">{unit}</span>
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <span className="text-xs text-ink-muted">{m.result_label}</span>
          <span className="rounded-lg border border-ink-muted/50 bg-surface-2 px-3 py-1.5 text-base font-semibold">
            {t.report.classification[result.classification]}
          </span>
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-2 rounded-lg border border-game/40 bg-game/5 px-3 py-2 text-sm">
        <ValueTypeTag type="game_value" />
        <span>{m.calculated_note}</span>
      </p>

      <figure className="space-y-3">
        <div
          role="img"
          aria-label={format(m.scale_label, {
            min: fixed2(scale.min),
            max: fixed2(scale.max),
            unit,
            range_min: fixed2(range.min),
            range_max: fixed2(range.max),
            value,
          })}
          className="relative pt-9 pb-6"
        >
          {/* Marker label above the track, anchored so it stays inside at the ends. */}
          <div
            aria-hidden
            className="absolute top-0 font-mono text-xs font-semibold whitespace-nowrap text-game"
            style={{
              left: `${scale.markerPct}%`,
              transform:
                scale.markerAlign === 'start'
                  ? 'translateX(0)'
                  : scale.markerAlign === 'end'
                    ? 'translateX(-100%)'
                    : 'translateX(-50%)',
            }}
          >
            {value}
          </div>
          <div aria-hidden className="relative h-3 rounded-full border border-line bg-surface-2">
            <div
              className="absolute inset-y-0 border-x-2 border-measured bg-measured/25"
              style={{ left: `${scale.bandStartPct}%`, width: `${scale.bandEndPct - scale.bandStartPct}%` }}
            />
            <div
              className="absolute -top-3 -bottom-3 w-0.5 -translate-x-1/2 bg-game"
              style={{ left: `${scale.markerPct}%` }}
            >
              <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-game" />
            </div>
          </div>
          <div aria-hidden className="absolute inset-x-0 bottom-0 flex justify-between font-mono text-xs text-ink-muted">
            <span>{fixed2(scale.min)}</span>
            <span>{fixed2(scale.max)}</span>
          </div>
        </div>
        <figcaption>
          <ul className="grid gap-2 text-sm">
            <li className="flex flex-wrap items-center gap-2">
              <span aria-hidden className="h-3 w-6 shrink-0 rounded-sm border-x-2 border-measured bg-measured/25" />
              <span>{format(m.legend_range, { min: fixed2(range.min), max: fixed2(range.max), unit })}</span>
              <ValueTypeTag type={range.value_type} />
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <span aria-hidden className="flex h-3 w-6 shrink-0 justify-center">
                <span className="h-full w-0.5 bg-game" />
              </span>
              <span>{format(m.legend_value, { value, unit })}</span>
              <ValueTypeTag type="game_value" />
            </li>
            <li className="flex flex-wrap items-center gap-2 text-ink-muted">
              <span aria-hidden className="h-3 w-6 shrink-0 rounded-sm border border-line bg-surface-2" />
              <span>{format(m.legend_scale, { min: fixed2(scale.min), max: fixed2(scale.max) })}</span>
              <ValueTypeTag type="game_value" />
            </li>
          </ul>
        </figcaption>
      </figure>

      <div className="space-y-2 rounded-lg border border-caution/50 bg-caution/5 p-4">
        <p className="font-semibold">{m.not_safe}</p>
        <p className="text-sm text-ink">{harvest.standards_note.text}</p>
      </div>

      <div className="space-y-2">
        <SubHeading>{m.range_about}</SubHeading>
        <p className="text-sm leading-relaxed text-ink-muted">{range.description}</p>
      </div>

      <div className="space-y-3">
        <SubHeading>{m.sources_title}</SubHeading>
        {shared ? (
          <SourceBlock label={m.source_shared}>
            <SourceCitation source={range.source} />
          </SourceBlock>
        ) : (
          <>
            <SourceBlock label={m.source_range}>
              <SourceCitation source={range.source} />
            </SourceBlock>
            <SourceBlock label={m.source_standards}>
              <SourceCitation source={harvest.standards_note.source} />
            </SourceBlock>
          </>
        )}
      </div>
    </div>
  );
}

function SourceBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-ink">{label}</p>
      {children}
    </div>
  );
}

/** Recorded pathogen screening of the real analysis. Never calculated by the game. */
export function PathogenScreen({ harvest }: { harvest: HarvestEvidence }) {
  const t = useDictionary();
  const p = t.report.report.pathogen;
  const screen = harvest.pathogen_screen;
  return (
    <div className="space-y-4">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{p.organisms}</dt>
          <dd className="mt-2">
            <ul className="flex flex-wrap gap-2">
              {screen.organisms.map((o) => (
                <li key={o} className="rounded-md border border-line bg-surface-2 px-2 py-1 text-sm italic">
                  {o}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{p.result}</dt>
          <dd className="mt-2 flex flex-wrap items-center gap-2 text-base font-semibold">
            {screen.result}
            <ValueTypeTag type={screen.value_type} />
          </dd>
        </div>
      </dl>
      <p className="text-sm text-ink-muted">{p.note}</p>
      <SourceCitation source={screen.source} />
    </div>
  );
}

/** Every rule of the calculation with how often it applied and what it added. */
export function FactorTableView({ result, unit }: { result: MicrobialResult; unit: string }) {
  const t = useDictionary();
  const f = t.report.report.factors;
  const table = factorTable(result);
  const caption = format(f.caption, { unit });

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">{f.intro}</p>
      <TableRegion label={caption}>
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className={th}>
                {f.col_condition}
              </th>
              <th scope="col" className={th}>
                {f.col_rule}
              </th>
              <th scope="col" className={`${th} text-right`}>
                {f.col_count}
              </th>
              <th scope="col" className={`${th} text-right`}>
                {f.col_change}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {table.rows.map((row) => (
              <tr key={row.key} className={row.muted ? 'text-ink-muted' : ''}>
                <th scope="row" className={`${td} text-left font-normal ${row.muted ? '' : 'text-ink'}`}>
                  {format(t.report.factor[row.key], { stage: MOLD_STAGE })}
                  {row.muted ? <span className="sr-only"> ({f.no_effect})</span> : null}
                </th>
                <td className={`${td} whitespace-nowrap`}>{factorRuleText(row.rule, t)}</td>
                <td className={`${td} text-right font-mono tabular-nums`}>{row.count}</td>
                <td className={`${td} text-right font-mono tabular-nums ${row.muted ? '' : 'font-semibold'}`}>
                  {row.key === 'baseline' ? fixed2(row.change) : signed(row.change, 2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line">
            <tr>
              <th scope="row" colSpan={3} className={`${td} text-left`}>
                {f.sum}
              </th>
              <td className={`${td} text-right font-mono tabular-nums`}>{fixed2(table.sum)}</td>
            </tr>
            <tr>
              <th scope="row" colSpan={3} className={`${td} text-left`}>
                {f.value}
              </th>
              <td className={`${td} text-right font-mono font-semibold text-game tabular-nums`}>
                {fixed2(table.value)}
              </td>
            </tr>
          </tfoot>
        </table>
      </TableRegion>
      {table.limited ? (
        <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          {format(f.limited, {
            sum: fixed2(table.sum),
            min: fixed2(MICROBIAL.min),
            max: fixed2(MICROBIAL.max),
          })}
        </p>
      ) : null}
    </div>
  );
}
