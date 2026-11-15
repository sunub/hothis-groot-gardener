/**
 * The timeline switch (ROLE-TASKS A1, option "connect it, keep it off").
 *
 * Set NEXT_PUBLIC_TIMELINE=1 in apps/web/.env.local to start new missions
 * with the cultivation timeline. Off by default: missions then run exactly as
 * before (seven game days, saved shape version 1). The switch is read when a
 * mission starts; a saved mission keeps the mode it was started with.
 *
 * NEXT_PUBLIC_ variables are inlined into the browser bundle at build time,
 * so restart `npm run dev` (or rebuild) after changing it.
 */

/** True only for the values that clearly mean "on". */
export function parseTimelineFlag(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

/** Whether new missions get a timeline. */
export const TIMELINE_ENABLED: boolean = parseTimelineFlag(process.env.NEXT_PUBLIC_TIMELINE);
