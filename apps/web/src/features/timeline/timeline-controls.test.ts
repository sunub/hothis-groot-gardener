import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LocaleProvider } from '@/lib/i18n';
import { en } from '@/lib/i18n/en';
import { initialPlayback, playbackReducer, type PlaybackState } from './playback';
import { TimelineControls } from './timeline-controls';

const controls = (state: PlaybackState) =>
  renderToStaticMarkup(createElement(LocaleProvider, null, createElement(TimelineControls, { state, dispatch: () => {} })));
const p = en.mission.playback;

const base = initialPlayback({
  day: 4,
  lastDay: 33,
  stops: [
    { cultivation_day: 6, kind: 'milestone' },
    { cultivation_day: 9, kind: 'event' },
  ],
});

describe('TimelineControls feedback', () => {
  it('turns each speed into real time per day', () => {
    expect(controls(base)).toContain('1× · 1 day ≈ 2 s');
    expect(controls({ ...base, speed: 4 })).toContain('4× · 1 day ≈ 0.5 s');
    expect(controls({ ...base, speed: 8 })).toContain('8× · 1 day ≈ 0.25 s');
  });

  it('marks the chosen speed for assistive tech', () => {
    expect(controls({ ...base, speed: 2 })).toMatch(/aria-pressed="true"[^>]*>2×/);
  });

  it('says what time is doing, in words', () => {
    expect(controls(base)).toContain(p.status_paused);
    expect(controls(playbackReducer(base, { type: 'play' }))).toContain('Time is passing · 1×');
    expect(controls(playbackReducer(base, { type: 'skip_to_next' }))).toContain('Moving to day 6');
    expect(controls({ ...base, stopped: { cultivation_day: 9, kind: 'event' } })).toContain(p.status_event);
    expect(controls({ ...base, day: 6, stopped: { cultivation_day: 6, kind: 'milestone' } })).toContain(
      'Stopped · Game day 2',
    );
  });

  it('shows the day counter', () => {
    expect(controls(base)).toContain('Cultivation day 4 / 33');
  });
});
