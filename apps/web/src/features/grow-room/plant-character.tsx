'use client';

import { Card } from '@/components/ui/card';
import { SpeechBubble } from '@/components/ui/speech-bubble';
import type { MissionState } from '@/lib/contract/types';
import { format, useDictionary, type Dictionary } from '@/lib/i18n';
import { HEALTH_MAX, METRICS, growthStageOf, zoneOf } from '@/lib/game/rules';
import { chosenOption, lastAttempt, todayRecord } from './derive';
import { LettuceScene } from './lettuce-scene';
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

/** The lettuce in the grow bay and its speech bubble. */
export function PlantCharacter({ mission }: { mission: MissionState }) {
  const t = useDictionary();
  const stage = growthStageOf(mission.game_day);
  const line = plantLine(mission, t);

  return (
    <Card aria-label={t.mission.character.label} className="space-y-3">
      <LettuceScene
        sprite={spriteFor(mission)}
        artNote={t.mission.character.art_note}
        label={format(t.mission.character.svg_label, {
          stage: t.common.growth_stage[stage],
          health: mission.plant.plant_health,
          max: HEALTH_MAX,
        })}
      />
      <figure className="pt-2">
        <figcaption className="sr-only">{t.mission.character.label}</figcaption>
        <SpeechBubble tail="top">
          <blockquote>{line}</blockquote>
        </SpeechBubble>
      </figure>
    </Card>
  );
}
