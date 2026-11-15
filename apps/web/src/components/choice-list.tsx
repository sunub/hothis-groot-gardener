'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChoiceButton } from '@/components/ui/choice-button';

const LETTERS = 'ABCDEFGH';

export interface ChoiceListText {
  title: string;
  hint: string;
  selected: string;
  confirm: string;
  confirmHint: string;
}

/**
 * Options of a crisis or an event card. Picking an option only marks it; the
 * choice is sent when the player confirms. Options are passed as labels and
 * answered by position only, so no verdict or action data reaches the DOM.
 */
export function ChoiceList({
  id,
  labels,
  text,
  onChoose,
}: {
  /** id of the heading, unique on the page. */
  id: string;
  labels: readonly string[];
  text: ChoiceListText;
  onChoose: (index: number) => void;
}) {
  // Picked but not yet confirmed. Screen state only: it is not saved with the mission.
  const [picked, setPicked] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const confirm = () => {
    if (picked === null || confirmed) return;
    setConfirmed(true);
    onChoose(picked);
  };

  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={id} className="text-heading font-bold">
          {text.title}
        </h3>
        <p className="text-caption text-ink-muted">{text.hint}</p>
      </div>
      <ul className="grid gap-2">
        {labels.map((label, i) => (
          <li key={i}>
            <ChoiceButton
              keyLabel={LETTERS[i] ?? String(i + 1)}
              selected={picked === i}
              dimmed={confirmed && picked !== i}
              trailing={picked === i ? text.selected : null}
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
          {text.confirm}
        </Button>
      ) : null}
      <p className="text-caption text-ink-muted">{text.confirmHint}</p>
    </section>
  );
}
