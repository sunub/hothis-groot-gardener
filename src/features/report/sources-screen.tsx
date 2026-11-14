'use client';

import type { ReactNode } from 'react';
import { SourceCitation } from '@/components/source-citation';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { ValueTypeTag } from '@/components/value-type-tag';
import { ZoneBadge } from '@/components/zone-badge';
import type { EvidenceAction, EvidenceCrisis, Metric, ValueType } from '@/lib/contract/types';
import { evidence } from '@/lib/evidence';
import { format, useDictionary } from '@/lib/i18n';
import {
  CRISIS_PROBABILITY,
  CULTIVATION_DAYS,
  FIRST_CRISIS_DAY,
  GAME_DAYS,
  GROUND_SUPPORT_AFTER,
  GROUND_SUPPORT_HEALTH,
  GROWTH_STAGES,
  HEALTH_MIN,
  INITIAL_PLANT_STATE,
  LAST_CRISIS_DAY,
  MAX_CARE_OPS_PER_DAY,
  METRICS,
  METRIC_MAX,
  METRIC_MIN,
  MICROBIAL,
  MOLD_STAGE,
  NIGHT_DRIFT,
  NIGHT_HEALTH,
  NORMAL_MID,
  VERDICT_HEALTH_DEFAULT,
  WATER_AMOUNT,
  ZONE_BOUNDS,
} from '@/lib/game/rules';
import { VerdictBadge } from './crisis-metrics';
import { PageHeader, Section, SubHeading, TableRegion, factorRuleText, td, th } from './parts';
import {
  FACTOR_KEYS,
  deltaParts,
  factorRule,
  fixed2,
  gradeBands,
  signed,
  triggerView,
  zoneRanges,
  type Bound,
  type DeltaPart,
} from './view-model';

type Dict = ReturnType<typeof useDictionary>;

const VALUE_TYPES: readonly ValueType[] = ['measured', 'game_value'];

/** The /sources screen: every piece of evidence and every game rule in one place. Needs no mission. */
export function SourcesScreen() {
  const t = useDictionary();
  const s = t.report.sources;
  const contents: { id: string; title: string }[] = [
    { id: 'how', title: s.how_title },
    { id: 'crises', title: s.crises_title },
    { id: 'harvest', title: s.harvest_title },
    { id: 'background', title: s.background_title },
    { id: 'rules', title: s.rules_title },
    { id: 'meta', title: s.meta_title },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={s.title}>
        <p>{s.intro}</p>
      </PageHeader>

      <nav aria-label={s.contents_label} className="print:hidden">
        <ol className="flex flex-wrap gap-2 text-body">
          {contents.map((c, i) => (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                <span aria-hidden className="font-data text-data-sm">
                  {i + 1}
                </span>
                {c.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="how" title={s.how_title}>
        <p className="mb-4 text-body text-ink-muted">{s.how_intro}</p>
        <dl className="grid gap-3 sm:grid-cols-2">
          {VALUE_TYPES.map((type) => (
            <div key={type} className="bg-surface-2 p-4">
              <dt>
                <ValueTypeTag type={type} />
              </dt>
              <dd className="mt-2 text-body">{t.common.value_type_help[type]}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <section id="crises" aria-labelledby="crises-title" className="scroll-mt-6 space-y-4">
        <h2 id="crises-title" className="text-heading font-semibold tracking-tight">
          {s.crises_title}
        </h2>
        {evidence.crises.map((crisis) => (
          <CrisisEvidence key={crisis.crisis_id} crisis={crisis} />
        ))}
      </section>

      <HarvestEvidenceSection />

      <Section id="background" title={s.background_title} tags={evidence.background.length > 0 ? ['measured'] : []}>
        {evidence.background.length === 0 ? (
          <p className="text-body text-ink-muted">{s.background_empty}</p>
        ) : (
          <ul className="space-y-4">
            {evidence.background.map((claim) => (
              <li key={claim.claim_id} className="space-y-2">
                <p className="text-body font-medium">{claim.claim}</p>
                <SourceCitation source={claim.source} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <GameRules />

      <Section id="meta" title={s.meta_title}>
        <div className="space-y-4 text-body">
          <p className="leading-relaxed">{evidence.meta.description}</p>
          <p className="text-ink-muted">
            {format(s.meta_updated, { updated: evidence.meta.updated, version: evidence.meta.schema_version })}
          </p>
          <div className="space-y-1">
            <SubHeading>{s.ai_title}</SubHeading>
            <p className="leading-relaxed">{evidence.meta.ai_disclosure}</p>
          </div>
        </div>
      </Section>
    </div>
  );
}

// Short accessor so the long nested dictionary paths stay readable.
function sourcesOf(t: Dict) {
  return t.report.sources;
}

function deltaText(part: DeltaPart, t: Dict): string {
  const d = sourcesOf(t).delta;
  switch (part.kind) {
    case 'add':
      return format(d.add, { metric: t.common.metric[part.metric], amount: signed(part.amount) });
    case 'to_mid':
      return format(d.to_mid, { metric: t.common.metric[part.metric], mid: NORMAL_MID });
    case 'half_to_mid':
      return format(d.half_to_mid, { metric: t.common.metric[part.metric], mid: NORMAL_MID });
    case 'health':
      return format(d.health, { amount: signed(part.amount) });
    case 'fan':
      return format(d.fan, { level: t.common.fan_level[part.level] });
  }
}

function triggerText(crisis: EvidenceCrisis, t: Dict): string {
  const s = sourcesOf(t);
  const view = triggerView(crisis.trigger);
  const conditions = view.conditions
    .map((c) => format(s.trigger_condition, { metric: t.common.metric[c.metric], side: s.trigger_side[c.side] }))
    .join(s.trigger_join);
  return view.fan ? `${conditions} ${format(s.trigger_fan, { level: t.common.fan_level[view.fan] })}` : conditions;
}

function CrisisEvidence({ crisis }: { crisis: EvidenceCrisis }) {
  const t = useDictionary();
  const s = sourcesOf(t);
  const headingId = `crisis-${crisis.crisis_id}`;
  const stages = [...new Set(crisis.symptoms.map((x) => x.stage))].sort((a, b) => a - b);
  const caption = format(s.actions_caption, { name: crisis.name });

  return (
    <article aria-labelledby={headingId} className="space-y-6 m-1 pixel-frame pixel-tone-line bg-surface p-4 sm:p-6">
      <header className="space-y-2">
        <h3 id={headingId} className="text-heading font-semibold">
          {crisis.name}
        </h3>
        <p className="text-body leading-relaxed">{crisis.summary}</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <SubHeading level={4}>{s.record_title}</SubHeading>
          <dl className="grid gap-1 text-body">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-ink-muted">{s.crop}</dt>
              <dd>{crisis.record.crop}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-ink-muted">{s.experiment}</dt>
              <dd>{crisis.record.experiment}</dd>
            </div>
          </dl>
          {crisis.record.note ? (
            <p className="bg-surface-2 pixel-bar pixel-tone-caution px-3 py-2 text-body">{crisis.record.note}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <SubHeading level={4}>{s.trigger_title}</SubHeading>
            <ValueTypeTag type="game_value" />
          </div>
          <p className="text-body">{triggerText(crisis, t)}</p>
          <p className="text-caption text-ink-muted">{s.trigger_note}</p>
        </div>
      </div>

      <div className="space-y-2">
        <SubHeading level={4}>{s.crisis_source}</SubHeading>
        <SourceCitation source={crisis.source} />
      </div>

      <div className="space-y-3">
        <SubHeading level={4}>{s.symptoms_title}</SubHeading>
        <ol className="space-y-3">
          {stages.map((stage) => (
            <li key={stage} className="grid gap-2 sm:grid-cols-[6rem_minmax(0,1fr)]">
              <p className="text-body font-semibold">{format(s.symptom_stage, { stage })}</p>
              <ul className="space-y-3">
                {crisis.symptoms
                  .filter((x) => x.stage === stage)
                  .map((symptom) => (
                    <li key={symptom.symptom_id} className="space-y-1.5 border-l-4 border-line pl-3">
                      <p className="flex flex-wrap items-center gap-2 text-body">
                        {symptom.name}
                        <ValueTypeTag type={symptom.value_type} />
                      </p>
                      <SourceCitation source={symptom.source} />
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-3">
        <SubHeading level={4}>{s.actions_title}</SubHeading>
        <TableRegion label={caption}>
          <table className="w-full min-w-[56rem] text-body">
            <caption className="sr-only">{caption}</caption>
            <thead className="border-b-4 border-surface-2">
              <tr>
                <th scope="col" className={th}>{s.col_action}</th>
                <th scope="col" className={th}>{s.col_verdict}</th>
                <th scope="col" className={th}>{s.col_reason}</th>
                <th scope="col" className={th}>{s.col_change}</th>
                <th scope="col" className={th}>{s.col_type}</th>
                <th scope="col" className={`${th} w-72`}>{s.col_source}</th>
              </tr>
            </thead>
            <tbody className="divide-y-4 divide-surface">
              {crisis.actions.map((action) => (
                <ActionRow key={action.action_id} action={action} />
              ))}
            </tbody>
          </table>
        </TableRegion>
      </div>
    </article>
  );
}

function ActionRow({ action }: { action: EvidenceAction }) {
  const t = useDictionary();
  const parts = deltaParts(action.delta);
  return (
    <tr>
      <th scope="row" className={`${td} text-left font-medium`}>
        {action.name}
      </th>
      <td className={td}>
        <VerdictBadge verdict={action.verdict} />
      </td>
      <td className={`${td} text-ink-muted`}>{action.reason}</td>
      <td className={td}>
        {parts.length === 0 ? (
          sourcesOf(t).delta.none
        ) : (
          <ul className="space-y-0.5">
            {parts.map((p, i) => (
              <li key={i}>{deltaText(p, t)}</li>
            ))}
          </ul>
        )}
      </td>
      <td className={td}>
        <ValueTypeTag type={action.value_type} />
      </td>
      <td className={td}>
        <SourceCitation source={action.source} />
      </td>
    </tr>
  );
}

function HarvestEvidenceSection() {
  const t = useDictionary();
  const s = sourcesOf(t);
  const h = evidence.harvest;
  return (
    <Section id="harvest" title={s.harvest_title} tags={['measured', 'game_value']}>
      <div className="space-y-8">
        <div className="space-y-3">
          <SubHeading>{s.steps_title}</SubHeading>
          <ol className="space-y-4">
            {h.steps.map((step, i) => (
              <li key={step.step_id} className="grid gap-3 sm:grid-cols-[2rem_minmax(0,1fr)]">
                <span
                  aria-hidden
                  className="flex size-8 items-center justify-center bg-surface-2 font-data text-data text-ink-muted"
                >
                  {i + 1}
                </span>
                <div className="space-y-1.5">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {step.name}
                    <ValueTypeTag type={step.value_type} />
                  </p>
                  <p className="text-body text-ink-muted">{step.description}</p>
                  <SourceCitation source={step.source} />
                </div>
              </li>
            ))}
          </ol>
        </div>

        <EvidenceItem title={s.range_title} type={h.microbial_range.value_type}>
          <p className="font-data text-data-sm font-semibold tabular-nums">
            {format(s.range_value, {
              min: fixed2(h.microbial_range.min),
              max: fixed2(h.microbial_range.max),
              unit: h.microbial_range.unit,
            })}
          </p>
          <p className="text-body text-ink-muted">{h.microbial_range.description}</p>
          <SourceCitation source={h.microbial_range.source} />
        </EvidenceItem>

        <EvidenceItem title={s.pathogen_title} type={h.pathogen_screen.value_type}>
          <ul className="flex flex-wrap gap-2">
            {h.pathogen_screen.organisms.map((o) => (
              <li key={o} className="bg-surface-2 px-2 py-1 text-body italic">
                {o}
              </li>
            ))}
          </ul>
          <p className="text-body font-semibold">{h.pathogen_screen.result}</p>
          <SourceCitation source={h.pathogen_screen.source} />
        </EvidenceItem>

        <EvidenceItem title={s.standards_title}>
          <p className="text-body">{h.standards_note.text}</p>
          <SourceCitation source={h.standards_note.source} />
        </EvidenceItem>
      </div>
    </Section>
  );
}

function EvidenceItem({ title, type, children }: { title: string; type?: ValueType; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <SubHeading>{title}</SubHeading>
        {type ? <ValueTypeTag type={type} /> : null}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Game rules, generated from rules.ts
// ---------------------------------------------------------------------------

function boundText(lower: Bound, upper: Bound, t: Dict): string {
  const r = sourcesOf(t).rules;
  const lo = lower ? format(lower.inclusive ? r.bound_from : r.bound_above, { value: lower.value }) : null;
  const hi = upper ? format(upper.inclusive ? r.bound_upto : r.bound_below, { value: upper.value }) : null;
  if (lo && hi && lower?.inclusive) {
    // "40 to 70", "25 to below 40": an inclusive upper end needs no extra word after "to".
    return format(r.bound_range, { lower: lo, upper: upper?.inclusive ? upper.value : hi });
  }
  if (lo && hi) return format(r.bound_between, { lower: lo, upper: hi });
  return lo ?? hi ?? '';
}

function RuleBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-3 bg-surface-2 p-4">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function RuleList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-body">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function GameRules() {
  const t = useDictionary();
  const s = sourcesOf(t);
  const r = s.rules;
  const unit = evidence.harvest.microbial_range.unit;
  const pct = (p: number) => Math.round(p * 100);
  const metricHeads = METRICS.map((m: Metric) => (
    <th key={m} scope="col" className={th}>
      {t.common.metric[m]}
    </th>
  ));
  const zoneRows = METRICS.map((m) => zoneRanges(ZONE_BOUNDS[m]));

  return (
    <Section id="rules" title={s.rules_title} tags={['game_value']}>
      <p className="mb-4 text-body text-ink-muted">{s.rules_intro}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <RuleBlock title={r.length_title}>
          <TableRegion label={r.length_caption}>
            <table className="w-full min-w-[22rem] text-body">
              <caption className="sr-only">{r.length_caption}</caption>
              <thead className="border-b-4 border-surface-2">
                <tr>
                  <th scope="col" className={th}>{r.col_game_day}</th>
                  <th scope="col" className={th}>{r.col_cultivation_day}</th>
                  <th scope="col" className={th}>{r.col_stage}</th>
                  <th scope="col" className={th}>{r.col_crisis}</th>
                </tr>
              </thead>
              <tbody className="divide-y-4 divide-surface">
                {CULTIVATION_DAYS.slice(0, GAME_DAYS).map((cd, i) => {
                  const day = i + 1;
                  return (
                    <tr key={day}>
                      <th scope="row" className={`${td} text-left font-data text-data font-normal`}>{day}</th>
                      <td className={`${td} font-data text-data`}>{cd}</td>
                      <td className={td}>{t.common.growth_stage[GROWTH_STAGES[i]]}</td>
                      <td className={td}>{day >= FIRST_CRISIS_DAY && day <= LAST_CRISIS_DAY ? r.yes : r.no}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableRegion>
        </RuleBlock>

        <RuleBlock title={r.start_title}>
          <table className="w-full text-body">
            <caption className="sr-only">{r.start_caption}</caption>
            <thead className="border-b-4 border-surface-2">
              <tr>
                <th scope="col" className={th}>{r.col_item}</th>
                <th scope="col" className={th}>{r.col_value}</th>
              </tr>
            </thead>
            <tbody className="divide-y-4 divide-surface">
              {(['plant_health', 'root_moisture', 'humidity'] as const).map((k) => (
                <tr key={k}>
                  <th scope="row" className={`${td} text-left font-normal`}>{t.common.metric[k]}</th>
                  <td className={`${td} font-data text-data`}>{INITIAL_PLANT_STATE[k]}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className={`${td} text-left font-normal`}>{t.common.metric.fan}</th>
                <td className={td}>{t.common.fan_level[INITIAL_PLANT_STATE.fan]}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-caption text-ink-muted">{format(r.scale_note, { min: METRIC_MIN, max: METRIC_MAX })}</p>
        </RuleBlock>

        <RuleBlock title={r.zones_title}>
          <TableRegion label={r.zones_caption}>
            <table className="w-full min-w-[22rem] text-body">
              <caption className="sr-only">{r.zones_caption}</caption>
              <thead className="border-b-4 border-surface-2">
                <tr>
                  <th scope="col" className={th}>{r.col_zone}</th>
                  {metricHeads}
                </tr>
              </thead>
              <tbody className="divide-y-4 divide-surface">
                {zoneRows[0].map((row, i) => (
                  <tr key={row.zone}>
                    <th scope="row" className={`${td} text-left font-normal`}>
                      <ZoneBadge zone={row.zone} />
                    </th>
                    {zoneRows.map((rows, j) => (
                      <td key={j} className={`${td} font-data text-data whitespace-nowrap`}>
                        {boundText(rows[i].lower, rows[i].upper, t)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRegion>
          <p className="text-caption text-ink-muted">{format(r.mid_note, { mid: NORMAL_MID })}</p>
        </RuleBlock>

        <RuleBlock title={r.night_title}>
          <table className="w-full text-body">
            <caption className="sr-only">{r.night_caption}</caption>
            <thead className="border-b-4 border-surface-2">
              <tr>
                <th scope="col" className={th}>{r.col_fan}</th>
                {metricHeads}
              </tr>
            </thead>
            <tbody className="divide-y-4 divide-surface">
              {(['low', 'high'] as const).map((fan) => (
                <tr key={fan}>
                  <th scope="row" className={`${td} text-left font-normal`}>{t.common.fan_level[fan]}</th>
                  {METRICS.map((m) => (
                    <td key={m} className={`${td} font-data text-data`}>{signed(NIGHT_DRIFT[fan][m])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </RuleBlock>

        <RuleBlock title={r.care_title}>
          <RuleList
            items={[
              format(r.care_ops, { ops: MAX_CARE_OPS_PER_DAY }),
              ...(['normal', 'heavy'] as const).map((level) =>
                format(r.care_water, { level: t.report.care.water_level[level], amount: signed(WATER_AMOUNT[level]) }),
              ),
              r.care_light,
            ]}
          />
        </RuleBlock>

        <RuleBlock title={r.crisis_title}>
          <RuleList
            items={[
              format(r.crisis_days, { first: FIRST_CRISIS_DAY, last: LAST_CRISIS_DAY }),
              format(r.crisis_danger, { percent: pct(CRISIS_PROBABILITY.danger) }),
              format(r.crisis_caution, { percent: pct(CRISIS_PROBABILITY.caution) }),
              format(r.crisis_recurrence, { points: pct(CRISIS_PROBABILITY.recurrence_bonus) }),
            ]}
          />
        </RuleBlock>

        <RuleBlock title={r.verdict_title}>
          <table className="w-full text-body">
            <caption className="sr-only">{r.verdict_caption}</caption>
            <thead className="border-b-4 border-surface-2">
              <tr>
                <th scope="col" className={th}>{s.col_verdict}</th>
                <th scope="col" className={th}>{t.common.metric.plant_health}</th>
              </tr>
            </thead>
            <tbody className="divide-y-4 divide-surface">
              {(['appropriate', 'partial', 'inappropriate'] as const).map((v) => (
                <tr key={v}>
                  <th scope="row" className={`${td} text-left font-normal`}>
                    <VerdictBadge verdict={v} />
                  </th>
                  <td className={`${td} font-data text-data`}>{signed(VERDICT_HEALTH_DEFAULT[v])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <RuleList
            items={[
              r.verdict_note,
              format(r.ground_support, {
                count: GROUND_SUPPORT_AFTER,
                health: signed(GROUND_SUPPORT_HEALTH),
                mid: NORMAL_MID,
              }),
            ]}
          />
        </RuleBlock>

        <RuleBlock title={r.health_title}>
          <RuleList
            items={[
              format(r.health_danger, { amount: signed(NIGHT_HEALTH.per_danger_metric) }),
              format(r.health_caution, { amount: signed(NIGHT_HEALTH.per_caution_metric) }),
              format(r.health_normal, { amount: signed(NIGHT_HEALTH.all_normal) }),
              format(r.health_zero, { min: HEALTH_MIN }),
            ]}
          />
        </RuleBlock>

        <RuleBlock title={r.grade_title}>
          <table className="w-full text-body">
            <caption className="sr-only">{format(r.grade_caption, { day: GAME_DAYS })}</caption>
            <thead className="border-b-4 border-surface-2">
              <tr>
                <th scope="col" className={th}>{r.col_grade}</th>
                <th scope="col" className={th}>{r.col_health}</th>
              </tr>
            </thead>
            <tbody className="divide-y-4 divide-surface">
              {gradeBands().map((band) => (
                <tr key={band.grade}>
                  <th scope="row" className={`${td} text-left font-normal`}>
                    <Badge>{t.report.grade[band.grade]}</Badge>
                  </th>
                  <td className={`${td} font-data text-data`}>
                    {band.min !== null && band.max !== null
                      ? format(t.report.grade_band.range, { min: band.min, max: band.max })
                      : band.min !== null
                        ? format(t.report.grade_band.min_only, { min: band.min })
                        : format(t.report.grade_band.max_only, { max: band.max ?? 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-caption text-ink-muted">{r.grade_note}</p>
        </RuleBlock>

        <RuleBlock title={r.microbial_title}>
          <TableRegion label={format(r.microbial_caption, { unit })}>
            <table className="w-full min-w-[22rem] text-body">
              <caption className="sr-only">{format(r.microbial_caption, { unit })}</caption>
              <thead className="border-b-4 border-surface-2">
                <tr>
                  <th scope="col" className={th}>{t.report.report.factors.col_condition}</th>
                  <th scope="col" className={th}>{t.report.report.factors.col_rule}</th>
                </tr>
              </thead>
              <tbody className="divide-y-4 divide-surface">
                {FACTOR_KEYS.map((key) => (
                  <tr key={key}>
                    <th scope="row" className={`${td} text-left font-normal`}>
                      {format(t.report.factor[key], { stage: MOLD_STAGE })}
                    </th>
                    <td className={`${td} font-data text-data whitespace-nowrap`}>{factorRuleText(factorRule(key), t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRegion>
          <RuleList
            items={[
              format(r.microbial_bounds, { min: fixed2(MICROBIAL.min), max: fixed2(MICROBIAL.max) }),
              r.microbial_compare,
            ]}
          />
        </RuleBlock>
      </div>
    </Section>
  );
}
