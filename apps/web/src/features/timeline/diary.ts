import type { EventList, LogTone, TimelineLogEntry, Verdict } from '@/lib/contract/types';
import { findTimelineEvent, trackEntriesOn } from '@/lib/events/judge';
import { frameOn, zoneChanges, type TimelineFrame, type ZoneChange } from './frames';

/**
 * One line of the cultivation diary (재배 일지), ready for the screen.
 * Text that lives in the event list is passed through; the rest is built from
 * dictionary templates by the component.
 */
export type DiaryLine =
  | {
      kind: 'event';
      key: string;
      day: number;
      tone: LogTone;
      /** null while the event waits: its name can give the answer away. */
      name: string | null;
      verdict: Verdict | null;
    }
  | {
      kind: 'experiment';
      key: string;
      day: number;
      tone: LogTone;
      experiment: string;
      text: string;
      /** Only entries compared with the original document are shown as recorded. */
      checked: boolean;
      /** The text was translated by the language model for a Korean screen. */
      ai_translated?: boolean;
    }
  | {
      kind: 'observation';
      key: string;
      day: number;
      tone: LogTone;
      text: string;
      /** Written because of the plant's state: a game value, not a record. */
      from_state: boolean;
      /** The text was translated by the language model for a Korean screen. */
      ai_translated?: boolean;
    }
  | { kind: 'game_day'; key: string; day: number; tone: LogTone; game_day: number }
  | ({ kind: 'zone'; key: string; day: number; tone: LogTone } & ZoneChange);

function toneOfZoneChange(change: ZoneChange): LogTone {
  if (change.to === 'normal') return 'positive';
  return 'negative';
}

/** Lines for the log entries up to `day`, plus zone changes read from the frames. Newest first. */
export function diaryLines(
  log: readonly TimelineLogEntry[],
  frames: readonly TimelineFrame[],
  day: number,
  list: EventList,
): DiaryLine[] {
  const lines: DiaryLine[] = [];

  log.forEach((entry, i) => {
    if (entry.cultivation_day > day) return;
    const key = `${entry.type}-${entry.cultivation_day}-${i}`;
    switch (entry.type) {
      case 'event': {
        const event = findTimelineEvent(list, entry.event_id);
        const answered = entry.response !== null;
        lines.push({
          kind: 'event',
          key,
          day: entry.cultivation_day,
          tone: entry.tone,
          name: answered && event && 'name' in event ? (event.name ?? null) : null,
          verdict: entry.response?.verdict ?? null,
        });
        break;
      }
      case 'track': {
        const found = trackEntriesOn(list, entry.cultivation_day).find((t) => t.entry_key === entry.entry_key);
        lines.push({
          kind: 'experiment',
          key,
          day: entry.cultivation_day,
          tone: entry.tone,
          experiment: entry.experiment,
          text: found?.entry.text ?? '',
          checked: found?.entry.source_check === 'checked',
        });
        break;
      }
      case 'record': {
        const event = findTimelineEvent(list, entry.event_id);
        const record = event?.kind === 'record' ? event : null;
        lines.push({
          kind: 'observation',
          key,
          day: entry.cultivation_day,
          tone: entry.tone,
          text: record?.text ?? '',
          from_state: record?.condition !== undefined,
        });
        break;
      }
      case 'milestone':
        lines.push({ kind: 'game_day', key, day: entry.cultivation_day, tone: entry.tone, game_day: entry.game_day });
        break;
    }
  });

  for (const frame of frames) {
    if (frame.cultivation_day > day) continue;
    const before = frameOn(frames, frame.cultivation_day - 1);
    if (!before || before.cultivation_day === frame.cultivation_day) continue;
    for (const change of zoneChanges(before.plant, frame.plant)) {
      lines.push({
        kind: 'zone',
        key: `zone-${frame.cultivation_day}-${change.metric}`,
        day: frame.cultivation_day,
        tone: toneOfZoneChange(change),
        ...change,
      });
    }
  }

  // Newest first, also within a day (zone changes were added last, so they come first on their day).
  return lines
    .map((line, order) => ({ line, order }))
    .sort((a, b) => b.line.day - a.line.day || b.order - a.order)
    .map(({ line }) => line);
}

export const TONE_SIGN: Record<LogTone, string> = { positive: '+', negative: '−', mixed: '±', neutral: '' };
