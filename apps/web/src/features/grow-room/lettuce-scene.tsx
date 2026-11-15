import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { spriteTop, spriteUrl } from './lettuce-sprite';

/**
 * The grow bay with the lettuce sprite (layout from the euna demo branch, v1.2 placement spec).
 * The 600×520 sprite sits on the 1672×941 bay background at 1.1×, top-left (140, 220);
 * percentages keep that ratio at any size.
 */
export type SceneBackdrop = 'normal' | 'event' | 'result';

const BACKDROP_URL: Record<SceneBackdrop, string> = {
  normal: '/bg/growth-normal.jpg',
  event: '/bg/growth-event.jpg',
  result: '/bg/growth-result.jpg',
};

/** The sprite box in each layout, in % of the scene (matches the classes below). */
const SPRITE_BOX = {
  staged: { top: 15, left: 18, width: 64, height: 82 },
  bay: { top: 23.38, left: 8.37, width: 39.47, height: 60.79 },
} as const;

export function LettuceScene({
  sprite,
  label,
  className = '',
  dimLabel,
  backdrop,
  children,
}: {
  sprite: string;
  label: string;
  className?: string;
  /** When set, the lights are dimmed and this label names why (the night phase). */
  dimLabel?: string;
  /**
   * Stage layout: the plant is large and centred in the chamber crop of a BG_growth_* image,
   * and children overlay the top right (speech bubble). Without it: the original two-half bay.
   */
  backdrop?: SceneBackdrop;
  /**
   * Overlays on the scene (speech bubble, status badge). The scene is a size
   * container and sets --plant-top / --plant-x: the plant's top leaf and middle.
   */
  children?: ReactNode;
}) {
  const url = spriteUrl(sprite);
  const staged = backdrop !== undefined;
  const box = SPRITE_BOX[staged ? 'staged' : 'bay'];
  // Top leaf and middle of the plant, for overlays that point at it (PlantSpeech's anchor).
  const plantAnchor = {
    '--plant-top': `${(box.top + box.height * spriteTop(sprite)).toFixed(2)}%`,
    '--plant-x': `${box.left + box.width / 2}%`,
  } as CSSProperties;
  return (
    <div
      style={plantAnchor}
      className={cn(
        '@container relative m-1 overflow-hidden pixel-frame-flat pixel-tone-line',
        staged ? 'aspect-[1052/710]' : 'aspect-[1672/941]',
        className,
      )}
    >
      <Image
        src={staged ? BACKDROP_URL[backdrop] : '/bg/bay-teal.jpg'}
        alt=""
        fill
        sizes="(min-width: 1024px) 48rem, 100vw"
        className="pixel object-cover"
        priority
      />
      <div
        className={
          staged
            ? // 600×520 sprite kept at its ratio on the 1052×710 crop: 64% wide, pouch near the floor.
              'absolute top-[15%] left-[18%] h-[82%] w-[64%]'
            : 'absolute top-[23.38%] left-[8.37%] h-[60.79%] w-[39.47%]'
        }
      >
        {/* Dark shadow under the pouch */}
        <div className="absolute top-[96.15%] left-1/2 h-[7%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(20,6,30,0.55),rgba(20,6,30,0))]" />
        <div key={sprite} className="sprite-pop absolute inset-0">
          <Image src={url} alt={label} fill sizes="(min-width: 1024px) 20rem, 40vw" className="pixel" />
          {/* Teal grow light, masked to the sprite's shape (matches the recolored bay art) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-soft-light"
            style={{
              background: 'linear-gradient(180deg, rgb(79 209 192 / 0.45), rgb(79 209 192 / 0.12) 70%, transparent)',
              WebkitMaskImage: `url(${url})`,
              maskImage: `url(${url})`,
              WebkitMaskSize: '100% 100%',
              maskSize: '100% 100%',
            }}
          />
        </div>
      </div>
      {dimLabel ? (
        <div className="pointer-events-none absolute inset-0 bg-[rgb(4_8_20/0.62)] p-3.5">
          <span className="bg-bg px-3 py-0.5 font-data text-data-lg text-ink-muted">{dimLabel}</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}
