import type { MissionPhase } from '@/lib/contract/types';

/** Screens of the app. Each mission phase belongs to exactly one screen. */
export const ROUTES = {
  home: '/',
  mission: '/mission',
  harvest: '/harvest',
  report: '/report',
  sources: '/sources',
} as const;

export type MissionRoute = typeof ROUTES.mission | typeof ROUTES.harvest | typeof ROUTES.report;

const PHASE_ROUTE: Record<MissionPhase, MissionRoute> = {
  care: ROUTES.mission,
  crisis_pending: ROUTES.mission,
  crisis: ROUTES.mission,
  crisis_result: ROUTES.mission,
  night: ROUTES.mission,
  harvest: ROUTES.harvest,
  freeze: ROUTES.harvest,
  report: ROUTES.report,
  failed: ROUTES.report,
};

export function routeForPhase(phase: MissionPhase): MissionRoute {
  return PHASE_ROUTE[phase];
}
