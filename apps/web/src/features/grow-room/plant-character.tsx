'use client';

import { Badge } from '@/components/ui/badge';
import { SpeechBubble } from '@/components/ui/speech-bubble';
import type { MissionState } from '@/lib/contract/types';
import { format, useDictionary, type Dictionary } from '@/lib/i18n';
import { HEALTH_MAX, METRICS, growthStageOf, isCaution, isDanger, zoneOf } from '@/lib/game/rules';
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

/** The room's overall state: the worst zone among the two chamber values. */
function overallOf(mission: MissionState): 'normal' | 'caution' | 'danger' {
  const zones = METRICS.map((metric) => zoneOf(metric, mission.plant[metric]));
  if (zones.some(isDanger)) return 'danger';
  if (zones.some(isCaution)) return 'caution';
  return 'normal';
}

const OVERALL_SYMBOL = { normal: '✓', caution: '△', danger: '✕' } as const;

/**
 * The lettuce in the grow bay. From the sm breakpoint the speech bubble and the
 * overall state sit on the empty right half of the bay; on narrow screens the
 * bubble drops below the picture so its text never covers the plant.
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
        artNote={c.art_note}
        dimLabel={mission.phase === 'night' ? c.night_label : undefined}
        label={format(c.svg_label, {
          stage: t.common.growth_stage[stage],
          health: mission.plant.plant_health,
          max: HEALTH_MAX,
        })}
      >
        <div className="absolute top-[10%] left-[55%] hidden w-[40%] sm:block">
          <SpeechBubble tail="left" className="text-caption leading-snug lg:text-body">
            <blockquote>{line}</blockquote>
          </SpeechBubble>
        </div>
        <div className="absolute top-[48%] left-[55%] hidden sm:block">
          <Badge tone={overall} appearance="solid" className="m-1 px-3 py-1 text-data">
            <span aria-hidden>{OVERALL_SYMBOL[overall]}</span>
            {c.overall[overall]}
          </Badge>
        </div>
      </LettuceScene>
      <div className="mt-3 sm:hidden">
        <SpeechBubble tail="top">
          <blockquote>{line}</blockquote>
        </SpeechBubble>
        <Badge tone={overall} appearance="solid" className="mt-3 px-3 py-1 text-data">
          <span aria-hidden>{OVERALL_SYMBOL[overall]}</span>
          {c.overall[overall]}
        </Badge>
      </div>
    </section>
  );
}
