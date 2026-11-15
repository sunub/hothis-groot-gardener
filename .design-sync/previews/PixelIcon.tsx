import * as React from 'react';
import { PixelIcon } from 'space-garden-ui';

/**
 * Preview only: the app serves icons at /icons/<name>.png, which does not exist in a card.
 * The sync copies apps/web/public/icons to _preview/icons, so point the images there.
 */
function IconBase({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const fix = () =>
      ref.current?.querySelectorAll<HTMLImageElement>('img[src^="/icons/"]').forEach((img) => {
        img.src = '../../../_preview' + img.getAttribute('src');
      });
    fix();
    const mo = new MutationObserver(fix);
    if (ref.current) mo.observe(ref.current, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return <div ref={ref}>{children}</div>;
}

const Stage = ({ children }: { children: React.ReactNode }) => (
  <IconBase><div className="flex flex-wrap items-center gap-4 bg-bg p-6 text-ink">{children}</div></IconBase>
);

export const Icons = () => (
  <Stage>
    {(['sprout', 'water', 'fan', 'scope', 'syringe', 'earth', 'ok', 'half', 'fail', 'info'] as const).map((name) => (
      <div key={name} className="flex flex-col items-center gap-1">
        <PixelIcon name={name} size="lg" />
        <span className="font-data text-data-sm text-ink-muted">{name}</span>
      </div>
    ))}
  </Stage>
);

export const Sizes = () => (
  <Stage>
    <PixelIcon name="sprout" size="sm" />
    <PixelIcon name="sprout" size="md" />
    <PixelIcon name="sprout" size="lg" />
    <PixelIcon name="sprout" size="xl" />
  </Stage>
);
