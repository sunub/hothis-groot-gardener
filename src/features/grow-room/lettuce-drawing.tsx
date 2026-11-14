import type { GrowthStage } from '@/lib/contract/types';
import { HEALTH_MAX } from '@/lib/game/rules';

/** Leaf layout per growth stage: angle from upright (deg) and length relative to the full head. */
const LEAVES: Record<GrowthStage, readonly { angle: number; length: number }[]> = {
  germination: [
    { angle: -38, length: 0.32 },
    { angle: 38, length: 0.32 },
  ],
  growth: [
    { angle: -52, length: 0.55 },
    { angle: 52, length: 0.55 },
    { angle: -22, length: 0.68 },
    { angle: 22, length: 0.68 },
  ],
  pre_harvest: [
    { angle: -62, length: 0.78 },
    { angle: 62, length: 0.78 },
    { angle: -36, length: 0.9 },
    { angle: 36, length: 0.9 },
    { angle: -12, length: 0.96 },
    { angle: 12, length: 0.96 },
  ],
  harvest: [
    { angle: -66, length: 0.84 },
    { angle: 66, length: 0.84 },
    { angle: -40, length: 0.95 },
    { angle: 40, length: 0.95 },
    { angle: -16, length: 1 },
    { angle: 16, length: 1 },
    { angle: 0, length: 0.9 },
  ],
};

const BASE_X = 60;
const BASE_Y = 104;
const FULL_LENGTH = 82;
const MAX_TILT = 80;

/**
 * Inline drawing of a red romaine lettuce. Size follows the growth stage;
 * low plant health makes the leaves droop outward and fade.
 */
export function LettuceDrawing({
  stage,
  health,
  label,
}: {
  stage: GrowthStage;
  health: number;
  label: string;
}) {
  const vigor = Math.min(1, Math.max(0, health / HEALTH_MAX));
  // Below full vigor the leaves lean outward, up to about 30 degrees more.
  const droop = (1 - vigor) * 30;
  const leafOpacity = 0.45 + vigor * 0.55;

  return (
    <svg viewBox="-15 0 150 120" role="img" aria-label={label} className="h-full w-full">
      <ellipse cx={BASE_X} cy={BASE_Y + 6} rx="40" ry="6" fill="var(--color-surface-2)" />
      <rect x="22" y={BASE_Y} width="76" height="12" rx="3" fill="var(--color-line)" />
      {LEAVES[stage].map(({ angle, length }, i) => {
        const len = FULL_LENGTH * length;
        // Keep drooping leaves above the pot rim.
        const tilt = angle === 0 ? 0 : Math.sign(angle) * Math.min(Math.abs(angle) + droop, MAX_TILT);
        const width = len * 0.36;
        return (
          <g
            key={i}
            className="transition-transform duration-700 motion-reduce:transition-none"
            style={{
              transform: `rotate(${tilt}deg)`,
              transformOrigin: `${BASE_X}px ${BASE_Y}px`,
            }}
          >
            <path
              d={`M ${BASE_X} ${BASE_Y} C ${BASE_X - width} ${BASE_Y - len * 0.35}, ${BASE_X - width * 0.9} ${BASE_Y - len * 0.9}, ${BASE_X} ${BASE_Y - len} C ${BASE_X + width * 0.9} ${BASE_Y - len * 0.9}, ${BASE_X + width} ${BASE_Y - len * 0.35}, ${BASE_X} ${BASE_Y} Z`}
              fill="var(--color-danger)"
              fillOpacity={leafOpacity * 0.85}
              stroke="var(--color-danger)"
              strokeOpacity={leafOpacity}
              strokeWidth="1.2"
            />
            <path
              d={`M ${BASE_X} ${BASE_Y} L ${BASE_X} ${BASE_Y - len * 0.85}`}
              stroke="var(--color-normal)"
              strokeOpacity={0.35 + vigor * 0.45}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
}
