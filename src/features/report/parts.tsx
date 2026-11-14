'use client';

import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import { SourceCitation } from '@/components/source-citation';
import { Badge, type Tone } from '@/components/ui/badge';
import { ValueTypeTag } from '@/components/value-type-tag';
import { ZoneBadge } from '@/components/zone-badge';
import type { CareOp, HarvestGrade, HarvestStepEvidence, PlantState, ValueType } from '@/lib/contract/types';
import { format, useDictionary } from '@/lib/i18n';
import { WATER_AMOUNT, zoneOf } from '@/lib/game/rules';
import { fixed2, signed, type FactorRule } from './view-model';

/** Grade tone. The grade word is always shown with it; the color only supports it. */
const GRADE_TONE: Record<HarvestGrade, Tone> = {
  excellent: 'normal',
  success: 'caution',
  fail: 'danger',
};

export function GradeBadge({ grade }: { grade: HarvestGrade }) {
  const t = useDictionary();
  return <Badge tone={GRADE_TONE[grade]}>{t.report.grade[grade]}</Badge>;
}

/** Page title block shared by the harvest, report and sources screens. */
export function PageHeader({
  eyebrow,
  title,
  children,
  headingRef,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <header className="space-y-3">
      {eyebrow ? (
        <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{eyebrow}</p>
      ) : null}
      <h1
        ref={headingRef}
        tabIndex={headingRef ? -1 : undefined}
        className="text-2xl font-semibold tracking-tight text-balance focus:outline-none sm:text-3xl"
      >
        {title}
      </h1>
      {children ? <div className="max-w-3xl space-y-2 text-base leading-relaxed text-ink-muted">{children}</div> : null}
    </header>
  );
}

/** Heading that takes focus when it mounts after a step change, because the pressed button is gone. */
export function useFocusOnMount<T extends HTMLElement>(enabled: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (enabled) ref.current?.focus();
  }, [enabled]);
  return ref;
}

/**
 * One report section: a numbered h2 with its value-type tags, then the body.
 * The id lets the table of contents link to it.
 */
export function Section({
  id,
  title,
  tags = [],
  children,
  className = '',
}: {
  id: string;
  title: string;
  tags?: readonly ValueType[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-6 rounded-xl border border-line bg-surface p-4 break-inside-avoid-page sm:p-6 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight sm:text-xl">
          {title}
        </h2>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <ValueTypeTag key={tag} type={tag} />
            ))}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Small uppercase heading. `level` keeps the outline right when it sits under an h3. */
export function SubHeading({ children, id, level = 3 }: { children: ReactNode; id?: string; level?: 3 | 4 }) {
  const Tag = level === 4 ? 'h4' : 'h3';
  return (
    <Tag id={id} className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
      {children}
    </Tag>
  );
}

/** A table that scrolls on its own on narrow screens, reachable by keyboard. */
export function TableRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="-mx-1 overflow-x-auto rounded-lg px-1 focus-visible:outline-2"
    >
      {children}
    </div>
  );
}

export const th = 'px-3 py-2 text-left text-xs font-semibold tracking-wide text-ink-muted uppercase';
export const td = 'px-3 py-2 align-top';

/** Plant health, the two zoned metrics and the fan, as a definition list. */
export function PlantStateList({ state, compact = false }: { state: PlantState; compact?: boolean }) {
  const t = useDictionary();
  const m = t.common.metric;
  const item = compact ? 'flex flex-wrap items-center gap-x-2 gap-y-1' : 'flex flex-wrap items-center justify-between gap-2 py-2';
  return (
    <dl className={compact ? 'grid gap-1.5 text-sm' : 'divide-y divide-line text-sm'}>
      <div className={item}>
        <dt className="text-ink-muted">{m.plant_health}</dt>
        <dd className="font-mono font-semibold tabular-nums">{state.plant_health}</dd>
      </div>
      {(['root_moisture', 'humidity'] as const).map((metric) => (
        <div key={metric} className={item}>
          <dt className="text-ink-muted">{m[metric]}</dt>
          <dd className="flex items-center gap-2">
            <span className="font-mono tabular-nums">{state[metric]}</span>
            <ZoneBadge zone={zoneOf(metric, state[metric])} />
          </dd>
        </div>
      ))}
      <div className={item}>
        <dt className="text-ink-muted">{m.fan}</dt>
        <dd>{t.common.fan_level[state.fan]}</dd>
      </div>
      {compact ? null : (
        <div className={item}>
          <dt className="text-ink-muted">{m.light}</dt>
          <dd>
            {format(t.report.harvest.light_value, {
              red: t.common.light_level[state.light.red],
              blue: t.common.light_level[state.light.blue],
            })}
          </dd>
        </div>
      )}
    </dl>
  );
}

export function careText(op: CareOp, t: ReturnType<typeof useDictionary>): string {
  const c = t.report.care;
  switch (op.kind) {
    case 'water':
      return format(c.water, { level: c.water_level[op.level], amount: signed(WATER_AMOUNT[op.level]) });
    case 'fan':
      return format(c.fan, { level: t.common.fan_level[op.level] });
    case 'light':
      return format(c.light, { red: t.common.light_level[op.red], blue: t.common.light_level[op.blue] });
  }
}

/** One harvest step from the evidence list: name, description, value type and source. */
export function StepEvidence({ step }: { step: HarvestStepEvidence | undefined }) {
  const t = useDictionary();
  if (!step) return <p className="text-sm text-ink-muted">{t.report.harvest.step_missing}</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{step.name}</h3>
        <ValueTypeTag type={step.value_type} />
      </div>
      <p className="text-sm leading-relaxed text-ink-muted">{step.description}</p>
      <SourceCitation source={step.source} />
    </div>
  );
}

export function factorRuleText(rule: FactorRule, t: ReturnType<typeof useDictionary>): string {
  const r = t.report.factor_rule;
  switch (rule.kind) {
    case 'start':
      return format(r.start, { amount: fixed2(rule.amount) });
    case 'each':
      return format(r.each, { amount: signed(rule.amount, 2) });
    case 'each_capped':
      return format(r.each_capped, { amount: signed(rule.amount, 2), floor: signed(rule.floor, 2) });
    case 'once':
      return format(r.once, { amount: signed(rule.amount, 2) });
  }
}
