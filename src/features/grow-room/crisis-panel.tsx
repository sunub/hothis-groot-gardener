'use client';

import { useState } from 'react';
import type { AiClue, CrisisResponse } from '@/lib/contract/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { ChoiceButton } from '@/components/ui/choice-button';
import { PixelIcon } from '@/components/ui/pixel-icon';
import { useDictionary } from '@/lib/i18n';
import { PanelHeading } from './panel-heading';

/** What the crisis screen shows before the choice. Verdict, reason, delta and source are not part of it. */
export interface CrisisView {
  attempt: number;
  scene: string;
  clues: readonly AiClue[];
  record_note: string;
  labels: readonly string[];
}

/** Strip a crisis response down to what may be shown before the player chooses. */
export function toCrisisView(response: CrisisResponse): CrisisView {
  return {
    attempt: response.attempt,
    scene: response.scene,
    clues: response.clues,
    record_note: response.record_note,
    labels: response.options.map((o) => o.label),
  };
}

const LETTERS = 'ABCDEFGH';

/**
 * Crisis scene, clues, record note and the options. Picking an option only marks it;
 * the choice is sent when the player confirms. Options are passed by position only,
 * so no verdict or action data reaches the DOM.
 */
export function CrisisPanel({ view, onChoose }: { view: CrisisView; onChoose: (index: number) => void }) {
  const c = useDictionary().mission.crisis;
  // Picked but not yet confirmed. Screen state only: it is not saved with the mission.
  const [picked, setPicked] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const confirm = () => {
    if (picked === null || confirmed) return;
    setConfirmed(true);
    onChoose(picked);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {view.attempt > 1 ? (
          <Badge tone="caution" appearance="solid">
            {c.continues}
          </Badge>
        ) : null}
        <PanelHeading>{c.title}</PanelHeading>
        <p className="sr-only">{c.scene_label}</p>
        <p className="text-body">{view.scene}</p>
      </div>

      {view.clues.length > 0 ? (
        <section aria-labelledby="crisis-clues" className="space-y-2">
          <h3 id="crisis-clues" className="text-heading font-bold">
            {c.clues_title}
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {view.clues.map((clue, i) => (
              <li key={i} className="m-1 flex items-center gap-3 pixel-frame-flat pixel-tone-line bg-surface px-4 py-3">
                <PixelIcon name="scope" />
                <span className="flex flex-col">
                  <span className="font-data text-data-sm text-accent">CLUE {i + 1}</span>
                  <span className="text-body">{clue.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view.record_note ? (
        <Callout tone="measured" aria-labelledby="crisis-record">
          <h3 id="crisis-record" className="font-data text-data-sm text-measured">
            {c.record_title}
          </h3>
          <p className="mt-1">{view.record_note}</p>
        </Callout>
      ) : null}

      <section aria-labelledby="crisis-options" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="crisis-options" className="text-heading font-bold">
            {c.options_title}
          </h3>
          <p className="text-caption text-ink-muted">{c.options_hint}</p>
        </div>
        <ul className="grid gap-2">
          {view.labels.map((label, i) => (
            <li key={i}>
              <ChoiceButton
                keyLabel={LETTERS[i] ?? String(i + 1)}
                selected={picked === i}
                dimmed={confirmed && picked !== i}
                trailing={picked === i ? c.selected : null}
                disabled={confirmed}
                onClick={() => setPicked(i)}
              >
                {label}
              </ChoiceButton>
            </li>
          ))}
        </ul>
        {picked !== null ? (
          <Button variant="primary" block onClick={confirm} disabled={confirmed}>
            {c.confirm}
          </Button>
        ) : null}
        <p className="text-caption text-ink-muted">{c.confirm_hint}</p>
      </section>
    </div>
  );
}
