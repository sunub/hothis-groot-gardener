'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

/** True once the phase has changed at least once since the page opened. */
export const PhaseChangedContext = createContext(false);

/**
 * Heading of a phase panel. After a phase change it takes focus, because the
 * button the player pressed has just been removed with the old panel.
 */
export function PanelHeading({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const phaseChanged = useContext(PhaseChangedContext);
  useEffect(() => {
    // preventScroll: the grow room scrolls to the top of the page on a step change (mission-screen.tsx).
    if (phaseChanged && document.activeElement === document.body) ref.current?.focus({ preventScroll: true });
  }, [phaseChanged]);
  return (
    <h2 ref={ref} tabIndex={-1} className="text-heading font-bold tracking-tight focus:outline-none sm:text-heading">
      {children}
    </h2>
  );
}
