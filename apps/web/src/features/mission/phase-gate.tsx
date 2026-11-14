'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { MissionState } from '@/lib/contract/types';
import { ROUTES, routeForPhase, type MissionRoute } from './routes';
import { useMission } from './use-mission';

/**
 * Keeps the URL and the mission phase in step. A mission screen renders its
 * content only when the saved mission is in a phase that belongs to it.
 * Otherwise the player is sent to the screen for the current phase, or to the
 * start screen when there is no mission.
 */
export function PhaseGate({
  route,
  fallback = null,
  children,
}: {
  route: MissionRoute;
  /** Shown while the saved mission is being read or a redirect is in progress. */
  fallback?: ReactNode;
  children: (mission: MissionState) => ReactNode;
}) {
  const router = useRouter();
  const { ready, mission } = useMission();
  const target = !ready ? null : mission ? routeForPhase(mission.phase) : ROUTES.home;

  useEffect(() => {
    if (target && target !== route) router.replace(target);
  }, [router, route, target]);

  if (!mission || target !== route) return <>{fallback}</>;
  return <>{children(mission)}</>;
}
