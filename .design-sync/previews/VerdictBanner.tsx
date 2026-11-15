import * as React from 'react';
import { VerdictBanner } from 'space-garden-ui';

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

export const Verdicts = () => (
  <IconBase><div className="flex w-[34rem] flex-col gap-4 bg-bg p-6 text-ink">
    <VerdictBanner verdict="appropriate" detail="Crisis ends · related value moves to 55" />
    <VerdictBanner verdict="partial" detail="Crisis continues · try another action" />
    <VerdictBanner verdict="inappropriate" detail="Plant health −10" />
  </div></IconBase>
);
