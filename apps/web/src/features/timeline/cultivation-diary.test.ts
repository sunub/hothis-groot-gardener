import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FIXTURE_CONDITIONAL_EVENT, FIXTURE_MILESTONE } from '@/lib/contract/fixtures';
import { eventList } from '@/lib/events';
import { LocaleProvider } from '@/lib/i18n';
import { en } from '@/lib/i18n/en';
import { CultivationDiary } from './cultivation-diary';
import { diaryLines } from './diary';

const html = (el: ReactElement) => renderToStaticMarkup(createElement(LocaleProvider, null, el));

describe('CultivationDiary', () => {
  it('labels unchecked experiment lines and state-driven observations, and keeps a pending event nameless', () => {
    const lines = diaryLines(FIXTURE_CONDITIONAL_EVENT.timeline.log, [], 9, eventList);
    const out = html(createElement(CultivationDiary, { lines }));
    expect(out).toContain(en.mission.diary.unchecked);
    expect(out).toContain(en.mission.diary.event_pending);
    expect(out).not.toContain('The fan reads low but is off');
    expect(out).toContain(en.common.value_type.game_value);
  });

  it('shows the event name and verdict once answered', () => {
    const lines = diaryLines(FIXTURE_MILESTONE.timeline.log, [], 12, eventList);
    const out = html(createElement(CultivationDiary, { lines }));
    expect(out).toContain('Event: The fan reads low but is off');
    expect(out).toContain(en.common.verdict.inappropriate);
  });

  it('says so when nothing is written yet', () => {
    expect(html(createElement(CultivationDiary, { lines: [] }))).toContain(en.mission.diary.empty);
  });
});
