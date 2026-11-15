'use client';

import { Button } from '@/components/ui/button';
import { usePlayback } from '@/features/timeline/use-playback';
import { TimelineView } from '@/features/timeline/timeline-view';
import type { Stop } from '@/features/timeline/playback';
import type { TimelineFrame } from '@/features/timeline/frames';
import { FIXTURE_MILESTONE } from '@/lib/contract/fixtures';
import type { PlantState, TimelineLogEntry } from '@/lib/contract/types';
import { eventList } from '@/lib/events';
import { gameDayOn } from '@/lib/events/judge';
import { CULTIVATION_DAYS } from '@/lib/game/rules';

/**
 * Developer preview of the timeline screen until the engine produces real
 * days (ROLE-TASKS A1, A2). The day-by-day numbers are made up here by straight
 * lines between the plant states of the example fixtures; they are not results
 * of the game rules. Copy on this page is sample text, not screen copy.
 */

const ANCHORS: [day: number, health: number, root: number, humidity: number][] = [
  [0, 70, 55, 55],
  [1, 70, 55, 55],
  [3, 73, 45, 60],
  [7, 73, 45, 65],
  [9, 73, 45, 65],
  [10, 68, 45, 65],
  [12, 62, 35, 75],
];

function plantAt(day: number): PlantState {
  const last = ANCHORS[ANCHORS.length - 1];
  const nextIndex = ANCHORS.findIndex(([d]) => d >= day);
  const [d1, h1, r1, u1] = nextIndex <= 0 ? (nextIndex === 0 ? ANCHORS[0] : last) : ANCHORS[nextIndex - 1];
  const [d2, h2, r2, u2] = nextIndex === -1 ? last : ANCHORS[nextIndex];
  const f = d2 === d1 ? 1 : (day - d1) / (d2 - d1);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * f);
  return {
    plant_health: lerp(h1, h2),
    root_moisture: lerp(r1, r2),
    humidity: lerp(u1, u2),
    fan: 'low',
    light: { red: 'medium', blue: 'medium' },
  };
}

const LAST_DAY = CULTIVATION_DAYS[CULTIVATION_DAYS.length - 1];
const FRAMES: TimelineFrame[] = Array.from({ length: LAST_DAY + 1 }, (_, day) => ({
  cultivation_day: day,
  plant: plantAt(day),
}));

const LOG = FIXTURE_MILESTONE.timeline.log;
const STOPS: Stop[] = [
  ...LOG.filter((e) => e.type === 'event').map((e) => ({ cultivation_day: e.cultivation_day, kind: 'event' as const })),
  ...CULTIVATION_DAYS.map((day) => ({ cultivation_day: day, kind: 'milestone' as const })),
].sort((a, b) => a.cultivation_day - b.cultivation_day);

/** While time waits on an event, its log entry has no response yet. */
function logWhileStopped(stop: Stop | null): TimelineLogEntry[] {
  return LOG.map((entry) =>
    stop?.kind === 'event' && entry.type === 'event' && entry.cultivation_day === stop.cultivation_day
      ? { ...entry, response: null, tone: 'neutral' }
      : entry,
  );
}

export function TimelinePreview() {
  const [state, dispatch] = usePlayback({ day: 1, lastDay: LAST_DAY, stops: STOPS });

  return (
    <div className="space-y-3">
      <p className="font-sans text-caption text-ink-muted">
        예시 상태(fixtures)의 수치를 직선으로 이어 만든 미리보기입니다. 게임 규칙으로 계산한 값이 아닙니다. 사건(◆)과 게임 날(D1–D7)에서
        시간이 멈추고, 아래 단추로 대응한 것으로 치면 다시 흐릅니다. 12일째 이후에는 수치와 일지가 더 바뀌지 않습니다.
      </p>
      <TimelineView
        state={state}
        dispatch={dispatch}
        frames={FRAMES}
        log={logWhileStopped(state.stopped)}
        list={eventList}
        renderStop={(stop) => (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-sans text-body">
              {stop.kind === 'event'
                ? `${stop.cultivation_day}일째 사건 카드 자리 (PR #4의 EventCard가 들어감)`
                : `게임 날 ${gameDayOn(stop.cultivation_day)}: 기존 하루 흐름(돌보기, 위기)이 들어감`}
            </p>
            <Button variant="primary" onClick={() => dispatch({ type: 'resolve_stop' })}>
              {stop.kind === 'event' ? 'Answer (preview)' : 'Finish the day (preview)'}
            </Button>
          </div>
        )}
      />
    </div>
  );
}
