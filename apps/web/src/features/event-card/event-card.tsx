'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EventCardResponse } from '@/lib/contract/schemas';
import type { Locale, PendingEvent, PlantState } from '@/lib/contract/types';
import { useLocale } from '@/lib/i18n';
import { EventCardPanel, type EventCardStatus } from './event-card-panel';
import { buildEventCardRequest, fetchEventCard, outcomeOf, toEventCardView } from './view';

type Fetch = { status: 'loading' } | { status: 'error' } | { status: 'ready'; response: EventCardResponse };

interface EventCardProps {
  pending: PendingEvent;
  plant: PlantState;
  /** The player confirmed this action. Called once. */
  onRespond: (actionId: string) => void;
  /** The player read the result and wants time to move again. */
  onContinue: () => void;
}

/**
 * The event card for the pending event: asks POST /api/event, shows the card,
 * and reports the confirmed action. Applying the effect and moving time on are
 * the engine's work (ROLE-TASKS A1); this component only says what was chosen.
 * Folding is a screen setting and does not move time.
 */
export function EventCard(props: EventCardProps) {
  const { locale } = useLocale();
  // A new pending event (or language) is a new card: all card state starts over.
  const key = `${props.pending.event_id}:${props.pending.cultivation_day}:${locale}`;
  return <OneEventCard key={key} {...props} locale={locale} />;
}

function OneEventCard({ pending, plant, onRespond, onContinue, locale }: EventCardProps & { locale: Locale }) {
  const [fetchState, setFetchState] = useState<Fetch>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [folded, setFolded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchEventCard(buildEventCardRequest(pending, plant, locale), controller.signal)
      .then((response) => setFetchState({ status: 'ready', response }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('Event card request failed', error);
        setFetchState({ status: 'error' });
      });
    return () => controller.abort();
    // Asked once per card (and again on Retry); the plant does not change while time is stopped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const choose = useCallback(
    (index: number) => {
      if (fetchState.status !== 'ready' || chosen !== null) return;
      const option = fetchState.response.options[index];
      if (!option) return;
      setChosen(index);
      setFolded(false);
      onRespond(option.action_id);
    },
    [fetchState, chosen, onRespond],
  );

  return (
    <EventCardPanel
      card={cardStatus(fetchState, chosen, pending.cultivation_day)}
      folded={folded}
      handlers={{
        onChoose: choose,
        onRetry: () => {
          setFetchState({ status: 'loading' });
          setAttempt((n) => n + 1);
        },
        onFold: () => setFolded(true),
        onUnfold: () => setFolded(false),
        onContinue,
      }}
    />
  );
}

function cardStatus(fetchState: Fetch, chosen: number | null, day: number): EventCardStatus {
  if (fetchState.status !== 'ready') return { status: fetchState.status, cultivation_day: day };
  const outcome = chosen === null ? null : outcomeOf(fetchState.response, chosen);
  if (outcome) return { status: 'result', outcome };
  return { status: 'choosing', view: toEventCardView(fetchState.response) };
}
