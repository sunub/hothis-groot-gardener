import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { spriteUrl } from './lettuce-sprite';

/**
 * The grow bay with the lettuce sprite (layout from the euna demo branch, v1.2 placement spec).
 * The 600×520 sprite sits on the 1672×941 bay background at 1.1×, top-left (140, 220);
 * percentages keep that ratio at any size.
 */
export function LettuceScene({
  sprite,
  label,
  className = '',
  dimLabel,
  children,
}: {
  sprite: string;
  label: string;
  className?: string;
  /** When set, the lights are dimmed and this label names why (the night phase). */
  dimLabel?: string;
  /** Overlays on the empty right half of the bay (speech bubble, status badge). */
  children?: ReactNode;
}) {
  const url = spriteUrl(sprite);
  return (
    <div className={cn('relative m-1 aspect-[1672/941] overflow-hidden pixel-frame-flat pixel-tone-line', className)}>
      <Image src="/bg/bay-teal.jpg" alt="" fill sizes="(min-width: 1024px) 48rem, 100vw" className="pixel object-cover" priority />
      <div className="absolute top-[23.38%] left-[8.37%] h-[60.79%] w-[39.47%]">
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
