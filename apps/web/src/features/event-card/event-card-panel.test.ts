import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { eventCardResponseSchema } from '@/lib/contract/schemas';
import { LocaleProvider } from '@/lib/i18n';
import { en } from '@/lib/i18n/en';
import { EventCardPanel, type EventCardHandlers, type EventCardStatus } from './event-card-panel';
import { outcomeOf, toEventCardView } from './view';

const response = eventCardResponseSchema.parse({
  event_id: 'fan_off_after_restart',
  kind: 'conditional',
  name: 'The fan reads low but is off',
  cultivation_day: 9,
  scene: 'The panel shows the fan on Low. The leaves are still.',
  plant_line: 'The air around me feels heavy and still.',
  options: [
    {
      action_id: 'check_fan_running',
      op: 'check_fan_running',
      label: 'Check whether the fan is actually turning',
      result_line: 'I can feel the air moving again.',
      why: 'The record says the fan read low while it was really off.',
      verdict: 'appropriate',
      effect: { clear_flags: ['fan_actually_off'] },
      value_type: 'game_value',
    },
    {
      action_id: 'keep_observing',
      op: 'keep_observing',
      label: 'Keep watching for now',
      result_line: 'It is still so still in here.',
      why: 'Nothing changes while the fan stays off; this is a game value.',
      verdict: 'inappropriate',
      effect: { humidity: 5 },
      value_type: 'game_value',
    },
  ],
  summary: 'After a restart the fan read low but was off.',
  source_chunks: ['veggie-03a-fan-restart'],
  draft: true,
  origin: 'generated',
});

const noop = () => {};
const handlers: EventCardHandlers = { onChoose: noop, onRetry: noop, onFold: noop, onUnfold: noop, onContinue: noop };

function render(card: EventCardStatus, folded = false): string {
  return renderToStaticMarkup(
    createElement(LocaleProvider, null, createElement(EventCardPanel, { card, folded, handlers })),
  );
}

const e = en.mission.event_card;

describe('EventCardPanel before the choice', () => {
  const html = render({ status: 'choosing', view: toEventCardView(response) });

  it('shows the scene, the plant line, the labels and that time is stopped', () => {
    expect(html).toContain('The panel shows the fan on Low.');
    expect(html).toContain('The air around me feels heavy and still.');
    expect(html).toContain('Check whether the fan is actually turning');
    expect(html).toContain(e.time_stopped);
    expect(html).toContain('Day 9');
  });

  it('keeps the event name, verdicts, reasons, effects and the record out of the DOM', () => {
    for (const hidden of [
      response.name,
      'Appropriate',
      'Inappropriate',
      response.options[0].why,
      response.options[0].result_line,
      response.summary,
      e.resolved,
      'check_fan_running',
    ]) {
      expect(html).not.toContain(hidden);
    }
  });

  it('says when an AI model wrote the text', () => {
    expect(html).toContain(e.ai_written);
  });
});

describe('EventCardPanel after the choice', () => {
  const html = render({ status: 'result', outcome: outcomeOf(response, 0)! });

  it('reveals the name, verdict, reason, effect, draft note and record', () => {
    expect(html).toContain('Event: The fan reads low but is off');
    expect(html).toContain('Appropriate');
    expect(html).toContain(response.options[0].why);
    expect(html).toContain(e.resolved);
    expect(html).toContain(e.draft_note);
    expect(html).toContain(response.summary);
  });
});

describe('EventCardPanel while waiting', () => {
  it('shows the waiting text with time stopped, and a retry after an error', () => {
    const waiting = render({ status: 'loading', cultivation_day: 9 });
    expect(waiting).toContain(e.loading_body);
    expect(waiting).toContain(e.time_stopped);
    expect(waiting).toContain('aria-busy="true"');

    const failed = render({ status: 'error', cultivation_day: 9 });
    expect(failed).toContain(e.error_title);
    expect(failed).toContain(e.retry);
  });
});

describe('EventCardPanel folded', () => {
  it('leaves only the waiting band, whatever the card was doing', () => {
    for (const card of [
      { status: 'loading', cultivation_day: 9 },
      { status: 'choosing', view: toEventCardView(response) },
    ] as EventCardStatus[]) {
      const html = render(card, true);
      expect(html).toContain(e.band);
      expect(html).toContain(e.unfold);
      expect(html).not.toContain(response.scene);
    }
  });
});
