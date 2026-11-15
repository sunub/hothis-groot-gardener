'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { LettuceScene } from '@/features/grow-room/lettuce-scene';
import { HealthBar, ZoneGauge } from '@/features/grow-room/zone-gauge';
import type { EventList, GrowthStage, TimelineLogEntry } from '@/lib/contract/types';
import { useDictionary } from '@/lib/i18n';
import { METRICS } from '@/lib/game/rules';
import { CultivationDiary } from './cultivation-diary';
import { diaryLines } from './diary';
import { frameOn, growthStageOnDay, zoneChanges, type TimelineFrame } from './frames';
import type { PlaybackAction, PlaybackState, Stop } from './playback';
import { PlaybackMap } from './playback-map';
import { TimelineControls } from './timeline-controls';

/** Healthy plant of each growth stage (public/sprites). Symptoms belong to crises, not to passing days. */
const STAGE_SPRITE: Record<GrowthStage, string> = {
  germination: 'S0_sprout',
  growth: 'G0_growing',
  pre_harvest: 'P0_preharvest',
  harvest: 'H0_harvest_ready',
};

/**
 * Cultivation days passing: the day map, the time controls, the plant and its
 * gauges for the shown day, and the cultivation diary. While time passes,
 * each day moves the map cell, the gauge arrows and the diary together, so a
 * higher speed is felt as everything moving faster. A metric that moves into
 * another zone flashes on its day and leaves a diary line; time does not stop
 * for it (only events and game days stop time).
 */
export function TimelineView({
  state,
  dispatch,
  frames,
  log,
  list,
  renderStop,
}: {
  state: PlaybackState;
  dispatch: (action: PlaybackAction) => void;
  frames: readonly TimelineFrame[];
  log: readonly TimelineLogEntry[];
  list: EventList;
  /** What to show while time waits on a stop (the event card, or the game day flow). */
  renderStop?: (stop: Stop) => ReactNode;
}) {
  const t = useDictionary();
  const frame = frameOn(frames, state.day);
  const before = frameOn(frames, state.day - 1);
  const changed = new Set(
    frame && before && before.cultivation_day !== frame.cultivation_day
      ? zoneChanges(before.plant, frame.plant).map((c) => c.metric)
      : [],
  );
  const stage = growthStageOnDay(state.day);

  return (
    <div className="space-y-4">
      <PlaybackMap state={state} />
      <TimelineControls state={state} dispatch={dispatch} />

      {state.stopped && renderStop ? <Card>{renderStop(state.stopped)}</Card> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="space-y-4">
          <LettuceScene
            sprite={STAGE_SPRITE[stage]}
            label={t.common.growth_stage[stage]}
            artNote={t.mission.character.art_note}
          />
          {frame ? (
            <div className="space-y-4">
              <HealthBar value={frame.plant.plant_health} />
              {METRICS.map((metric) => (
                <div
                  // Re-mounting on the day of a change restarts the flash.
                  key={changed.has(metric) ? `${metric}-${state.day}` : metric}
                  className={changed.has(metric) ? 'animate-zone-flash' : undefined}
                >
                  <ZoneGauge metric={metric} value={frame.plant[metric]} />
                </div>
              ))}
            </div>
          ) : null}
        </Card>
        <Card>
          <CultivationDiary lines={diaryLines(log, frames, state.day, list)} />
        </Card>
      </div>
    </div>
  );
}
