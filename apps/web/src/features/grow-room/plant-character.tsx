'use client';

import { Badge } from '@/components/ui/badge';
import { PlantSpeech } from '@/components/ui/plant-speech';
import type { MissionState } from '@/lib/contract/types';
import { format, useDictionary, type Dictionary } from '@/lib/i18n';
import { HEALTH_MAX, METRICS, growthStageOf, isCaution, isDanger, zoneOf } from '@/lib/game/rules';
import { chosenOption, lastAttempt, todayRecord } from './derive';
import { LettuceScene, type SceneBackdrop } from './lettuce-scene';
import { spriteFor } from './lettuce-sprite';

/**
 * What the plant says. In care and night phases it describes only how it
 * feels in the current zones; in crisis phases it uses the crisis text.
 */
function plantLine(mission: MissionState, t: Dictionary): string {
  const c = t.mission.character;
  const response = mission.active_crisis?.response ?? null;
  switch (mission.phase) {
    case 'crisis':
      return response?.plant_line ?? c.pending;
    case 'crisis_result': {
      const option = chosenOption(mission, lastAttempt(todayRecord(mission)));
      return option?.result_line ?? response?.plant_line ?? c.pending;
    }
    case 'crisis_pending':
      return c.pending;
    default: {
      const lines = METRICS.flatMap((metric) => {
        const zone = zoneOf(metric, mission.plant[metric]);
        return zone === 'normal' ? [] : [c.feeling[metric][zone]];
      });
      return lines.length > 0 ? lines.join(' ') : c.feeling.all_normal;
    }
  }
}

/** The room's overall state: the worst zone among the two chamber values. */
function overallOf(mission: MissionState): 'normal' | 'caution' | 'danger' {
  const zones = METRICS.map((metric) => zoneOf(metric, mission.plant[metric]));
  if (zones.some(isDanger)) return 'danger';
  if (zones.some(isCaution)) return 'caution';
  return 'normal';
}

/** Crisis phases use the event backdrop, the result of a choice the result one, the rest the normal one. */
function backdropFor(mission: MissionState): SceneBackdrop {
  switch (mission.phase) {
    case 'crisis':
    case 'crisis_pending':
      return 'event';
    case 'crisis_result':
      return 'result';
    default:
      return 'normal';
  }
}

const OVERALL_SYMBOL = { normal: '✓', caution: '△', danger: '✕' } as const;

/**
 * The lettuce in the grow bay. From the sm breakpoint the speech bubble hangs
 * just above the plant's top leaf and the overall state sits bottom left; on
 * narrow screens both drop below the picture so the text never covers the plant.
 */
export function PlantCharacter({ mission }: { mission: MissionState }) {
  const t = useDictionary();
  const c = t.mission.character;
  const stage = growthStageOf(mission.game_day);
  const line = plantLine(mission, t);
  const overall = overallOf(mission);

  return (
    <section aria-label={c.label}>
      <LettuceScene
        sprite={spriteFor(mission)}
        backdrop={backdropFor(mission)}
        dimLabel={mission.phase === 'night' ? c.night_label : undefined}
        label={format(c.svg_label, {
          stage: t.common.growth_stage[stage],
          health: mission.plant.plant_health,
          max: HEALTH_MAX,
        })}
      >
        {/* The tail tip rests just above the top leaf, so the bubble rises as the lettuce grows. */}
        <div className="plant-speech-anchor hidden sm:block">
          <PlantSpeech text={line} aria-live="polite" />
        </div>
        <Badge
          tone={overall}
          appearance="solid"
          className="absolute bottom-[4%] left-[3%] m-1 hidden px-3 py-1 text-data sm:inline-flex"
        >
          <span aria-hidden>{OVERALL_SYMBOL[overall]}</span>
          {c.overall[overall]}
        </Badge>
      </LettuceScene>
      <div className="mt-3 sm:hidden">
        <PlantSpeech text={line} tail="up" className="text-body" />
        <Badge tone={overall} appearance="solid" className="mt-3 px-3 py-1 text-data">
          <span aria-hidden>{OVERALL_SYMBOL[overall]}</span>
          {c.overall[overall]}
        </Badge>
      </div>
    </section>
  );
}
