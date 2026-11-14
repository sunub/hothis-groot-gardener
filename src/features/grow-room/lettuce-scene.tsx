import Image from 'next/image';
import { spriteUrl } from './lettuce-sprite';

/**
 * The grow bay with the lettuce sprite (layout from the euna demo branch, v1.2 placement spec).
 * The 600×520 sprite sits on the 1672×941 bay background at 1.1×, top-left (140, 220);
 * percentages keep that ratio at any size.
 */
export function LettuceScene({
  sprite,
  label,
  artNote,
  className = '',
}: {
  sprite: string;
  label: string;
  artNote: string;
  className?: string;
}) {
  const url = spriteUrl(sprite);
  return (
    <div className={`relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-line ${className}`}>
      <Image src="/bg/bay.png" alt="" fill sizes="(min-width: 1024px) 24rem, 100vw" className="pixel object-cover" priority />
      <div className="absolute top-[23.38%] left-[8.37%] h-[60.79%] w-[39.47%]">
        {/* Dark shadow under the pouch */}
        <div className="absolute top-[96.15%] left-1/2 h-[7%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(20,6,30,0.55),rgba(20,6,30,0))]" />
        <div key={sprite} className="sprite-pop absolute inset-0">
          <Image src={url} alt={label} fill sizes="(min-width: 1024px) 10rem, 40vw" className="pixel" />
          {/* Pink LED light, masked to the sprite's shape */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-soft-light"
            style={{
              background: 'linear-gradient(180deg, rgba(240,90,230,0.55), rgba(200,80,220,0.15) 70%, transparent)',
              WebkitMaskImage: `url(${url})`,
              maskImage: `url(${url})`,
              WebkitMaskSize: '100% 100%',
              maskSize: '100% 100%',
            }}
          />
        </div>
      </div>
      <span className="absolute right-1 bottom-1 rounded bg-bg/85 px-1.5 py-0.5 text-[10px] tracking-wide text-ink-muted">
        {artNote}
      </span>
    </div>
  );
}
