'use client';

import { useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardDescription, CardHeader, CardTitle, Well } from '@/components/ui/card';
import { ChoiceButton } from '@/components/ui/choice-button';
import { Disclosure } from '@/components/ui/disclosure';
import { Meter } from '@/components/ui/meter';
import { PIXEL_ICONS, PixelIcon } from '@/components/ui/pixel-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { SpeechBubble } from '@/components/ui/speech-bubble';
import { Stepper } from '@/components/ui/stepper';
import { ValueTypeTag } from '@/components/value-type-tag';
import { VerdictBanner } from '@/components/verdict-banner';
import { ZoneBadge } from '@/components/zone-badge';
import { HealthBar, ZoneGauge } from '@/features/grow-room/zone-gauge';
import { TimelinePreview } from './timeline-preview';

/**
 * Living catalog of the pixel design system (SG-DS v2). Developer page: the copy here is
 * sample text, not screen copy, so it is not in the i18n dictionaries.
 */

const COLOR_GROUPS: { title: string; tokens: string[] }[] = [
  { title: 'Surfaces and lines', tokens: ['bg', 'surface', 'surface-2', 'surface-3', 'line', 'line-hi'] },
  { title: 'Text', tokens: ['ink', 'ink-muted', 'ink-faint'] },
  { title: 'Accent', tokens: ['accent', 'accent-hi', 'accent-lo'] },
  { title: 'Zones and verdicts', tokens: ['normal', 'caution', 'danger', 'danger-fill'] },
  { title: 'Value type', tokens: ['measured', 'game'] },
  { title: 'State items', tokens: ['health', 'water', 'humidity', 'lamp', 'micro'] },
];

const TYPE_SCALE: { token: string; className: string; sample: string }[] = [
  { token: 'text-display', className: 'font-title text-display font-bold', sample: 'Harvest in 2 days' },
  { token: 'text-heading', className: 'font-title text-heading font-bold', sample: 'Choose an action' },
  { token: 'text-control', className: 'font-title text-control', sample: 'Confirm action' },
  { token: 'text-body', className: 'font-title text-body', sample: 'The wall is damp and the air feels heavier than usual.' },
  { token: 'text-caption', className: 'font-title text-caption text-ink-muted', sample: 'Up to two care actions a day.' },
  { token: 'text-data-xl', className: 'font-data text-data-xl', sample: 'DAY 05/07' },
  { token: 'text-data-lg', className: 'font-data text-data-lg', sample: 'Root moisture 55' },
  { token: 'text-data', className: 'font-data text-data', sample: 'CULTIVATION DAY 22' },
  { token: 'text-data-sm', className: 'font-data text-data-sm', sample: 'log10 CFU/g 3.00' },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="border-b-4 border-surface-2 pb-2 font-data text-data-lg text-accent">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DesignSystemCatalog() {
  const [picked, setPicked] = useState<number | null>(1);
  const [speed, setSpeed] = useState(1);
  const options = ['Raise the fan to high', 'Add more water', 'Wipe the surface of the plant'];

  return (
    <div className="space-y-12">
      <header className="space-y-2">
        <p className="font-data text-data text-accent">SG-DS v2 · PIXEL UI</p>
        <h1 className="text-display font-bold">Design system</h1>
        <p className="max-w-3xl font-sans text-body text-ink-muted">
          토큰은 src/styles/tokens.css, 픽셀 유틸리티는 src/styles/utilities.css, 컴포넌트는 src/components/ui에
          있습니다. 규칙은 docs/DESIGN.md를 따릅니다.
        </p>
      </header>

      <Section id="ds-color" title="01 · COLOR">
        {COLOR_GROUPS.map((group) => (
          <div key={group.title} className="space-y-2">
            <h3 className="text-body text-ink-muted">{group.title}</h3>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-6">
              {group.tokens.map((token) => (
                <li key={token} className="space-y-2">
                  <div
                    className="m-1 h-16 pixel-frame-flat pixel-tone-line"
                    style={{ background: `var(--color-${token})` }}
                  />
                  <p className="font-data text-data-sm">{token}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section id="ds-type" title="02 · TYPE">
        <ul className="space-y-3">
          {TYPE_SCALE.map((row) => (
            <li key={row.token} className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <span className="w-32 shrink-0 font-data text-data-sm text-ink-muted">{row.token}</span>
              <span className={row.className}>{row.sample}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="ds-buttons" title="03 · BUTTONS · BADGES">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary">Continue</Button>
          <Button>Show source</Button>
          <Button variant="danger">Replace it</Button>
          <Button variant="primary" disabled>
            Locked
          </Button>
          <Button variant="ghost">Skip</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Speed">
          {[1, 2, 4].map((v) => (
            <Button
              key={v}
              variant="toggle"
              size="sm"
              aria-pressed={speed === v}
              onClick={() => setSpeed(v)}
              className="font-data text-data"
            >
              {v}×
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ValueTypeTag type="measured" />
          <ValueTypeTag type="game_value" />
          <ZoneBadge zone="normal" />
          <ZoneBadge zone="caution_high" />
          <ZoneBadge zone="danger_low" />
          <Badge tone="caution" appearance="solid">
            △ Crisis
          </Badge>
          <Badge tone="accent">Harvest</Badge>
        </div>
      </Section>

      <Section id="ds-panels" title="04 · PANELS · CALLOUTS">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Cabin status</CardTitle>
              <ValueTypeTag type="game_value" />
            </CardHeader>
            <CardDescription>Default panel with header, title and a value-type badge.</CardDescription>
            <Well className="mt-4 font-data text-data">Plant health 72</Well>
          </Card>
          <Card tone="caution">
            <CardTitle>Something is wrong</CardTitle>
            <CardDescription className="mt-2">Caution panel for a crisis day.</CardDescription>
          </Card>
        </div>
        <div className="flex flex-col gap-3">
          <Callout icon={<PixelIcon name="info" size="sm" />}>
            Within the range does not mean the crop is safe to eat.
          </Callout>
          <Callout tone="measured">In VEG-03J, tweezers were used to open the wicks on this day.</Callout>
          <Callout tone="danger" icon={<PixelIcon name="fail" size="sm" />}>
            The evidence list did not pass its check.
          </Callout>
        </div>
      </Section>

      <Section id="ds-gauges" title="05 · GAUGES">
        <Card className="grid gap-6 md:grid-cols-2">
          <ZoneGauge metric="root_moisture" value={55} />
          <ZoneGauge metric="humidity" value={78} />
          <HealthBar value={72} />
          <div className="space-y-1">
            <span className="text-body font-semibold">Meter tones</span>
            <Meter aria-label="Water" value={40} tone="water" size="sm" />
            <Meter aria-label="Humidity" value={65} tone="humidity" size="sm" />
            <Meter aria-label="Microbial" value={30} tone="micro" size="sm" />
          </div>
        </Card>
      </Section>

      <Section id="ds-crisis" title="06 · CRISIS · VERDICT">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <SpeechBubble>My leaf tips keep getting wet drops on them.</SpeechBubble>
            <ul className="space-y-2">
              {options.map((label, i) => (
                <li key={label}>
                  <ChoiceButton
                    keyLabel={'ABC'[i]}
                    selected={picked === i}
                    trailing={picked === i ? '✓ Selected' : null}
                    onClick={() => setPicked(i)}
                  >
                    {label}
                  </ChoiceButton>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <VerdictBanner verdict="appropriate" detail="Crisis ends · related value moves to 55" />
            <VerdictBanner verdict="partial" detail="Crisis ends · half recovery" />
            <VerdictBanner verdict="inappropriate" detail="Worsens · new symptom, asked again" />
            <Disclosure summary="Source · NASA NTRS" trailing={<ValueTypeTag type="measured" />}>
              <p className="border-l-4 border-line pl-3 text-ink-muted">“Quoted sentence from the evidence list.”</p>
            </Disclosure>
          </div>
        </div>
      </Section>

      <Section id="ds-flow" title="07 · STEPS · LOADING">
        <Stepper
          aria-label="Closing steps"
          className="flex-wrap"
          stateLabels={{ done: 'Done', current: 'Now', upcoming: 'Next' }}
          steps={[
            { id: 'h', index: '6', label: 'Harvest', state: 'done', icon: <PixelIcon name="pruner" size="sm" /> },
            { id: 'f', index: '7', label: 'Freeze & return', state: 'current', icon: <PixelIcon name="earth" size="sm" /> },
            { id: 'g', index: '8', label: 'Ground report', state: 'upcoming', icon: <PixelIcon name="scope" size="sm" /> },
          ]}
        />
        <Card className="space-y-3">
          <Skeleton className="w-full" />
          <Skeleton className="w-4/5" />
          <Skeleton className="w-3/5" />
        </Card>
      </Section>

      <Section id="ds-icons" title="08 · ICONS">
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {PIXEL_ICONS.map((name) => (
            <li key={name} className="m-1 flex flex-col items-center gap-2 pixel-frame bg-surface p-4">
              <PixelIcon name={name} size="xl" />
              <span className="font-data text-data-sm">{name}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="ds-timeline" title="10 · TIMELINE">
        <TimelinePreview />
      </Section>
    </div>
  );
}
