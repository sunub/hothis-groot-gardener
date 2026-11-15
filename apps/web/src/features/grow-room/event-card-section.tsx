'use client';

import { useState, type ReactNode } from 'react';
import { EventCardPanel, type EventCardStatus } from '@/features/event-card/event-card-panel';
import { outcomeOf, toEventCardView, type EventCardOutcome } from '@/features/event-card/view';
import type { CrisisFetchStatus, MissionActions } from '@/features/mission/use-mission';
import type { EventCardResponse } from '@/lib/contract/schemas';
import type { MissionState } from '@/lib/contract/types';
import { scrollToPageTop } from './scroll-to-top';

/**
 * The event card of a mission with a timeline. Time is stopped while a card
 * waits (mission.timeline.pending_event). The engine applies the answer at once,
 * so the result is kept here until the player continues.
 * When there is no card to show, `children` (the day's own panel) are shown instead.
 */
export function EventCardSection({
  mission,
  eventCard,
  eventStatus,
  actions,
  children,
}: {
  mission: MissionState;
  eventCard: EventCardResponse | null;
  eventStatus: CrisisFetchStatus;
  actions: MissionActions;
  children: ReactNode;
}) {
  const [folded, setFolded] = useState(false);
  const [outcome, setOutcome] = useState<EventCardOutcome | null>(null);
  const pending = mission.timeline?.pending_event ?? null;

  let card: EventCardStatus | null = null;
  if (outcome) {
    card = { status: 'result', outcome };
  } else if (pending) {
    if (eventCard) card = { status: 'choosing', view: toEventCardView(eventCard) };
    else if (eventStatus === 'error') card = { status: 'error', cultivation_day: pending.cultivation_day };
    else card = { status: 'loading', cultivation_day: pending.cultivation_day };
  }
  if (!card) return <>{children}</>;

  return (
    <EventCardPanel
      card={card}
      folded={folded}
      handlers={{
        onChoose: (index) => {
          if (!eventCard) return;
          const result = outcomeOf(eventCard, index);
          if (!result) return;
          setOutcome(result);
          setFolded(false);
          actions.respondToEvent(result.action_id);
        },
        onRetry: actions.retryEvent,
        onFold: () => setFolded(true),
        onUnfold: () => setFolded(false),
        onContinue: () => {
          setOutcome(null);
          scrollToPageTop();
        },
      }}
    />
  );
}
