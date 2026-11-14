'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { CareOp, MissionMode, MissionState } from '@/lib/contract/types';
import { useLocale } from '@/lib/i18n';
import {
  ensureCrisisRequest,
  getServerSnapshot,
  getSnapshot,
  missionActions,
  subscribe,
} from './mission-store';

/**
 * React access to the mission. The mission state lives in one store that is
 * saved to browser storage after every change. Screens read the state and call
 * these actions. Screens never change the state themselves.
 */

export type CrisisFetchStatus = 'idle' | 'loading' | 'error';

export interface MissionActions {
  /** Start a new mission. Replaces any saved mission. */
  start(mode: MissionMode): void;
  applyCare(op: CareOp): void;
  endDay(): void;
  nextDay(): void;
  chooseOption(actionId: string): void;
  continueAfterResult(): void;
  harvestCrop(sanitize: boolean): void;
  confirmFreeze(): void;
  /** Ask the crisis API again after a failed request. */
  retryCrisis(): void;
  /** Delete the saved mission. */
  reset(): void;
}

export interface UseMission {
  /** False until the saved mission has been read from browser storage. */
  ready: boolean;
  /** null when there is no mission. */
  mission: MissionState | null;
  /** Status of the crisis API request while the phase is crisis_pending. */
  crisisStatus: CrisisFetchStatus;
  actions: MissionActions;
}

/**
 * Mission state and actions for a screen. Must be used inside LocaleProvider:
 * the crisis request is written in the current screen language.
 */
export function useMission(): UseMission {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { locale } = useLocale();

  // Covers a reload in crisis_pending and a language change; the store skips duplicates.
  useEffect(() => {
    ensureCrisisRequest(locale);
  }, [locale, snapshot.mission]);

  return useMemo(
    () => ({
      ready: snapshot.ready,
      mission: snapshot.mission,
      crisisStatus: snapshot.crisisStatus,
      actions: missionActions,
    }),
    [snapshot],
  );
}
