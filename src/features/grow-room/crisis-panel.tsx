'use client';

import { useState } from 'react';
import type { AiClue, CrisisResponse } from '@/lib/contract/types';
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

const LETTERS = 'ABCDEFGH';

/**
 * Crisis scene, clues, record note and the options as large buttons. Options
 * are passed by position only, so no verdict or action data reaches the DOM.
 */
export function CrisisPanel({ view, onChoose }: { view: CrisisView; onChoose: (index: number) => void }) {
  const c = useDictionary().mission.crisis;
  const [chosen, setChosen] = useState<number | null>(null);

  const choose = (index: number) => {
    if (chosen !== null) return;
    setChosen(index);
    onChoose(index);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {view.attempt > 1 ? (
          <p className="inline-flex rounded-full border border-caution/50 bg-caution/10 px-3 py-1 text-xs font-semibold text-caution">
            {c.continues}
          </p>
        ) : null}
        <PanelHeading>{c.title}</PanelHeading>
        <p className="sr-only">{c.scene_label}</p>
        <p className="text-base leading-relaxed">{view.scene}</p>
        {view.origin === 'generated' ? (
          <p className="text-xs text-ink-muted">{c.ai_written}</p>
        ) : null}
      </div>

      {view.clues.length > 0 ? (
        <section aria-labelledby="crisis-clues" className="space-y-2">
          <h3 id="crisis-clues" className="text-sm font-semibold">
            {c.clues_title}
          </h3>
          <ul className="space-y-2">
            {view.clues.map((clue, i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-caution" />
                <span>{clue.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view.record_note ? (
        <aside aria-labelledby="crisis-record" className="rounded-lg border border-measured/40 bg-measured/10 px-3 py-2 text-sm">
          <h3 id="crisis-record" className="font-semibold text-measured">
            {c.record_title}
          </h3>
          <p className="mt-1">{view.record_note}</p>
        </aside>
      ) : null}

      <section aria-labelledby="crisis-options" className="space-y-3">
        <div>
          <h3 id="crisis-options" className="text-sm font-semibold">
            {c.options_title}
          </h3>
          <p className="text-xs text-ink-muted">{c.options_hint}</p>
        </div>
        <ul className="grid gap-2">
          {view.labels.map((label, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => choose(i)}
                disabled={chosen !== null}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-base font-medium transition hover:border-accent hover:bg-accent/5 disabled:cursor-wait ${
                  chosen === i ? 'border-accent bg-accent/10' : 'border-line bg-surface-2'
                } ${chosen !== null && chosen !== i ? 'opacity-50' : ''}`}
              >
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line font-mono text-xs text-ink-muted"
                >
                  {LETTERS[i] ?? i + 1}
                </span>
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
