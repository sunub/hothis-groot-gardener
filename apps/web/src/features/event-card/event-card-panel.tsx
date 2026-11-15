'use client';

import { ChangeList } from '@/components/change-list';
import { ChoiceList } from '@/components/choice-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Well } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { PixelIcon } from '@/components/ui/pixel-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { SpeechBubble } from '@/components/ui/speech-bubble';
import { VerdictBanner } from '@/components/verdict-banner';
import { PanelHeading } from '@/features/grow-room/panel-heading';
import { format, useDictionary } from '@/lib/i18n';
import { effectRows, type EventCardOutcome, type EventCardView } from './view';

export type EventCardStatus =
  | { status: 'loading'; cultivation_day: number }
  | { status: 'error'; cultivation_day: number }
  | { status: 'choosing'; view: EventCardView }
  | { status: 'result'; outcome: EventCardOutcome };

export interface EventCardHandlers {
  /** Position of the confirmed option in the view's labels. */
  onChoose: (index: number) => void;
  onRetry: () => void;
  onFold: () => void;
  onUnfold: () => void;
  onContinue: () => void;
}

/**
 * An event card: time is stopped while it is shown, folded or not.
 * Before the choice only the scene, the plant's line and the option labels are
 * in the DOM; the event name, verdict, reason and effect appear after it.
 */
export function EventCardPanel({
  card,
  folded,
  handlers,
}: {
  card: EventCardStatus;
  folded: boolean;
  handlers: EventCardHandlers;
}) {
  if (folded && card.status !== 'result') return <FoldedBand onUnfold={handlers.onUnfold} />;
  switch (card.status) {
    case 'loading':
      return <Waiting day={card.cultivation_day} onFold={handlers.onFold} />;
    case 'error':
      return <LoadError day={card.cultivation_day} onRetry={handlers.onRetry} />;
    case 'choosing':
      return <Choosing view={card.view} onChoose={handlers.onChoose} onFold={handlers.onFold} />;
    case 'result':
      return <Outcome outcome={card.outcome} onContinue={handlers.onContinue} />;
  }
}

function StoppedBadge() {
  const e = useDictionary().mission.event_card;
  return (
    <Badge tone="caution" appearance="solid">
      ❚❚ {e.time_stopped}
    </Badge>
  );
}

function FoldedBand({ onUnfold }: { onUnfold: () => void }) {
  const e = useDictionary().mission.event_card;
  return (
    <div role="status" className="m-1 flex flex-wrap items-center justify-between gap-3 pixel-bar bg-surface-2 px-4 py-3">
      <span className="text-body">
        <span aria-hidden className="font-data text-data-sm text-caution">
          ❚❚{' '}
        </span>
        {e.band}
      </span>
      <Button variant="secondary" onClick={onUnfold}>
        {e.unfold}
      </Button>
    </div>
  );
}

/** Waiting for POST /api/event (up to about half a minute when the text is generated). */
function Waiting({ day, onFold }: { day: number; onFold: () => void }) {
  const e = useDictionary().mission.event_card;
  return (
    <div className="space-y-4" aria-busy="true">
      <StoppedBadge />
      <PanelHeading>{format(e.title, { day })}</PanelHeading>
      <p className="font-data text-data-sm text-accent">{e.loading_title}</p>
      <p className="text-body text-ink-muted">{e.loading_body}</p>
      <div aria-hidden className="space-y-3 pt-2">
        <Skeleton className="w-full" />
        <Skeleton className="w-4/5" />
        <div className="grid gap-2 pt-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </div>
      <Button variant="ghost" onClick={onFold}>
        {e.fold}
      </Button>
    </div>
  );
}

function LoadError({ day, onRetry }: { day: number; onRetry: () => void }) {
  const e = useDictionary().mission.event_card;
  return (
    <div className="space-y-4">
      <StoppedBadge />
      <PanelHeading>{format(e.title, { day })}</PanelHeading>
      <Callout role="alert" tone="danger" icon={<PixelIcon name="fail" />}>
        <span className="font-semibold">{e.error_title}</span> {e.error_body}
      </Callout>
      <Button variant="primary" onClick={onRetry} className="px-6">
        {e.retry}
      </Button>
    </div>
  );
}

function Choosing({
  view,
  onChoose,
  onFold,
}: {
  view: EventCardView;
  onChoose: (index: number) => void;
  onFold: () => void;
}) {
  const e = useDictionary().mission.event_card;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <StoppedBadge />
        <PanelHeading>{format(e.title, { day: view.cultivation_day })}</PanelHeading>
        <p className="sr-only">{e.scene_label}</p>
        <p className="text-body">{view.scene}</p>
        {view.origin === 'generated' ? <p className="text-caption text-ink-muted">{e.ai_written}</p> : null}
      </div>

      <figure>
        <figcaption className="font-data text-data-sm text-ink-muted">{e.plant_says}</figcaption>
        <SpeechBubble tail="top" className="mt-4">
          <blockquote>“{view.plant_line}”</blockquote>
        </SpeechBubble>
      </figure>

      <ChoiceList
        id="event-options"
        labels={view.labels}
        onChoose={onChoose}
        text={{
          title: e.options_title,
          hint: e.options_hint,
          selected: e.selected,
          confirm: e.confirm,
          confirmHint: e.confirm_hint,
        }}
      />

      <Button variant="ghost" onClick={onFold}>
        {e.fold}
      </Button>
    </div>
  );
}

function Outcome({ outcome, onContinue }: { outcome: EventCardOutcome; onContinue: () => void }) {
  const t = useDictionary();
  const e = t.mission.event_card;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="font-data text-data text-accent">{format(e.result_name, { name: outcome.name })}</p>
        <VerdictBanner verdict={outcome.verdict} />
        <p className="text-body">
          <span className="text-ink-muted">{e.you_chose} </span>
          <span className="font-medium">{outcome.label}</span>
        </p>
      </div>

      <Well>
        <figure>
          <figcaption className="font-data text-data-sm text-ink-muted">{e.plant_says}</figcaption>
          <blockquote className="mt-1 text-body">“{outcome.result_line}”</blockquote>
        </figure>
      </Well>

      <div className="space-y-1">
        <h3 className="text-heading font-bold">{e.why_title}</h3>
        <p className="text-body text-ink">{outcome.why}</p>
      </div>

      <div className="space-y-2">
        <ChangeList id="event-changes" title={e.changes_title} valueType="game_value" rows={effectRows(outcome.effect, t)} />
        <p className="text-caption text-ink-muted">{e.draft_note}</p>
      </div>

      <Disclosure summary={e.record_title}>
        <p className="text-body">{outcome.summary}</p>
      </Disclosure>

      {outcome.origin === 'generated' ? <p className="text-caption text-ink-muted">{e.ai_written}</p> : null}

      <div className="border-t-4 border-surface-2 pt-5">
        <Button variant="primary" onClick={onContinue} className="w-full px-6 sm:w-auto">
          {e.continue}
        </Button>
      </div>
    </div>
  );
}
