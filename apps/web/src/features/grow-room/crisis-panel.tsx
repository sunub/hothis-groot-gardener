'use client';

import type { AiClue, CrisisResponse } from '@/lib/contract/types';
import { ChoiceList } from '@/components/choice-list';
import { Badge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/callout';
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
  /** "generated": written by the language model, so the screen says so. */
  origin: CrisisResponse['origin'];
}

/** Strip a crisis response down to what may be shown before the player chooses. */
export function toCrisisView(response: CrisisResponse): CrisisView {
  return {
    attempt: response.attempt,
    scene: response.scene,
    clues: response.clues,
    record_note: response.record_note,
    labels: response.options.map((o) => o.label),
    origin: response.origin,
  };
}

/**
 * Crisis scene, clues, record note and the options (ChoiceList: labels only,
 * answered by position, so no verdict or action data reaches the DOM).
 */
export function CrisisPanel({ view, onChoose }: { view: CrisisView; onChoose: (index: number) => void }) {
  const c = useDictionary().mission.crisis;

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
        {view.origin === 'generated' ? (
          <p className="text-caption text-ink-muted">{c.ai_written}</p>
        ) : null}
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

      <ChoiceList
        id="crisis-options"
        labels={view.labels}
        onChoose={onChoose}
        text={{
          title: c.options_title,
          hint: c.options_hint,
          selected: c.selected,
          confirm: c.confirm,
          confirmHint: c.confirm_hint,
        }}
      />
    </div>
  );
}
