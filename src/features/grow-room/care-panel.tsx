'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ValueTypeTag } from '@/components/value-type-tag';
import type { CareOp, FanLevel, LightLevel, MissionState } from '@/lib/contract/types';
import type { MissionActions } from '@/features/mission/use-mission';
import { format, useDictionary } from '@/lib/i18n';
import { MAX_CARE_OPS_PER_DAY, WATER_AMOUNT } from '@/lib/game/rules';
import { isNoOpCare, todayRecord } from './derive';
import { NightForecast } from './night-forecast';
import { PanelHeading } from './panel-heading';

const FAN_LEVELS: readonly FanLevel[] = ['low', 'high'];
const LIGHT_LEVELS: readonly LightLevel[] = ['low', 'medium', 'high'];
const WATER_LEVELS = ['normal', 'heavy'] as const;

/** Daily care: water, fan and lighting, with the overnight forecast and End day. */
export function CarePanel({ mission, actions }: { mission: MissionState; actions: MissionActions }) {
  const t = useDictionary();
  const c = t.mission.care;
  const { plant } = mission;
  const opsLeft = Math.max(0, MAX_CARE_OPS_PER_DAY - mission.care_ops_used);
  const noOps = opsLeft === 0;
  const [red, setRed] = useState<LightLevel>(plant.light.red);
  const [blue, setBlue] = useState<LightLevel>(plant.light.blue);
  const lightOp: CareOp = { kind: 'light', red, blue };
  const done = todayRecord(mission)?.care ?? [];

  const apply = (op: CareOp) => {
    if (noOps || isNoOpCare(plant, op)) return;
    actions.applyCare(op);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <PanelHeading>{c.title}</PanelHeading>
        <p className="text-body text-ink-muted">{format(c.intro, { ops: MAX_CARE_OPS_PER_DAY })}</p>
        {mission.game_day === 1 ? (
          <p className="bg-surface-2 px-3 py-2 text-body">{c.sowing_day}</p>
        ) : null}
      </div>

      <OpsMeter left={opsLeft} />

      <section aria-labelledby="care-water" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 id="care-water" className="text-body font-semibold">
            {c.water_title}
          </h3>
          <ValueTypeTag type="game_value" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {WATER_LEVELS.map((level) => (
            <Button
              key={level}
              onClick={() => apply({ kind: 'water', level })}
              disabled={noOps || isNoOpCare(plant, { kind: 'water', level })}
              className="min-h-14 flex-col !items-start !gap-0 py-2 text-left"
            >
              <span className="text-control">{c[`water_${level}`]}</span>
              <span className="text-caption text-ink-muted">
                {format(c.water_amount, { amount: WATER_AMOUNT[level] })}
              </span>
            </Button>
          ))}
        </div>
        {isNoOpCare(plant, { kind: 'water', level: 'normal' }) ? (
          <p className="text-caption text-ink-muted">{c.water_full}</p>
        ) : null}
      </section>

      <section aria-labelledby="care-fan" className="space-y-3">
        <h3 id="care-fan" className="text-body font-semibold">
          {c.fan_title}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {FAN_LEVELS.map((level) => {
            const current = plant.fan === level;
            return (
              <Button
                key={level}
                aria-pressed={current}
                onClick={() => apply({ kind: 'fan', level })}
                disabled={noOps || current}
                variant="toggle"
                className="min-h-14 flex-col !items-start !gap-0 py-2 text-left disabled:aria-pressed:text-accent-ink"
              >
                <span className="text-control">{t.common.fan_level[level]}</span>
                <span className={current ? 'text-caption' : 'text-caption text-ink-muted'}>
                  {current ? c.fan_current : format(c.fan_set, { level: t.common.fan_level[level] })}
                </span>
              </Button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="care-light" className="space-y-3">
        <h3 id="care-light" className="text-body font-semibold">
          {c.light_title}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <LightPicker legend={c.light_red} value={red} onChange={setRed} disabled={noOps} />
          <LightPicker legend={c.light_blue} value={blue} onChange={setBlue} disabled={noOps} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => apply(lightOp)} disabled={noOps || isNoOpCare(plant, lightOp)}>
            {c.light_apply}
          </Button>
          <span className="text-caption text-ink-muted">{c.light_one_op}</span>
        </div>
        <p className="text-caption text-ink-muted">{c.light_note}</p>
      </section>

      <section aria-labelledby="care-done" className="space-y-2">
        <h3 id="care-done" className="text-body font-semibold">
          {c.done_title}
        </h3>
        {done.length === 0 ? (
          <p className="text-body text-ink-muted">{c.done_none}</p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-body">
            {done.map((op, i) => (
              <li key={i}>{describeOp(op, t)}</li>
            ))}
          </ol>
        )}
      </section>

      <NightForecast plant={plant} />

      <div className="flex flex-col gap-2 border-t-4 border-surface-2 pt-5 sm:flex-row sm:items-center sm:justify-between">
        {noOps ? <p className="text-body text-ink-muted">{c.ops_none}</p> : <span />}
        <Button variant="primary" onClick={actions.endDay} className="w-full px-6 sm:w-auto">
          {c.end_day}
        </Button>
      </div>
    </div>
  );
}

function describeOp(op: CareOp, t: ReturnType<typeof useDictionary>): string {
  const c = t.mission.care;
  switch (op.kind) {
    case 'water':
      return format(c.done_water, { level: c[`water_${op.level}`], amount: WATER_AMOUNT[op.level] });
    case 'fan':
      return format(c.done_fan, { level: t.common.fan_level[op.level] });
    case 'light':
      return format(c.done_light, {
        red: t.common.light_level[op.red],
        blue: t.common.light_level[op.blue],
      });
  }
}

/** Remaining care operations as filled and empty pips plus text. */
function OpsMeter({ left }: { left: number }) {
  const t = useDictionary();
  return (
    <div className="flex items-center gap-3 bg-surface-2 px-3 py-2">
      <span aria-hidden className="flex gap-1">
        {Array.from({ length: MAX_CARE_OPS_PER_DAY }, (_, i) => (
          <span
            key={i}
            className={`size-4 ${i < left ? 'bg-accent' : 'bg-transparent shadow-[inset_0_0_0_2px_var(--color-accent)]'}`}
          />
        ))}
      </span>
      <span className="text-body">
        {format(t.mission.care.ops_left, { left, max: MAX_CARE_OPS_PER_DAY })}
      </span>
    </div>
  );
}

/** One lighting color as a radio group of Low/Medium/High. */
function LightPicker({
  legend,
  value,
  onChange,
  disabled,
}: {
  legend: string;
  value: LightLevel;
  onChange: (level: LightLevel) => void;
  disabled: boolean;
}) {
  const t = useDictionary();
  const name = useId();
  return (
    <fieldset disabled={disabled} className="min-w-0 disabled:opacity-40">
      <legend className="mb-1.5 text-caption text-ink-muted">{legend}</legend>
      <div className="grid grid-cols-3 gap-1 bg-surface-2 p-1">
        {LIGHT_LEVELS.map((level) => (
          <label
            key={level}
            className="flex min-h-11 cursor-pointer items-center justify-center text-body text-ink-muted transition has-[:checked]:bg-accent has-[:checked]:font-bold has-[:checked]:text-accent-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
          >
            <input
              type="radio"
              name={name}
              value={level}
              checked={value === level}
              onChange={() => onChange(level)}
              className="sr-only"
            />
            {t.common.light_level[level]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
