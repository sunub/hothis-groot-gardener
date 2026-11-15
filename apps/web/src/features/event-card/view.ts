import type { ChangeRow } from '@/components/change-list';
import { signed } from '@/features/grow-room/derive';
import {
  eventCardResponseSchema,
  type EventCardRequest,
  type EventCardResponse,
} from '@/lib/contract/schemas';
import type { EventEffect, Locale, PendingEvent, PlantState, Verdict } from '@/lib/contract/types';
import { format, type Dictionary } from '@/lib/i18n';

export const EVENT_CARD_ENDPOINT = '/api/event';

/**
 * What an event card shows before the choice. The event name is left out:
 * several names give the answer away (ROLE-TASKS B5). Verdicts, reasons,
 * effects and the record come only after the choice.
 */
export interface EventCardView {
  cultivation_day: number;
  scene: string;
  plant_line: string;
  labels: readonly string[];
  /** "generated": written by the language model, so the screen says so. */
  origin: EventCardResponse['origin'];
}

export function toEventCardView(response: EventCardResponse): EventCardView {
  return {
    cultivation_day: response.cultivation_day,
    scene: response.scene,
    plant_line: response.plant_line,
    labels: response.options.map((o) => o.label),
    origin: response.origin,
  };
}

/** What the card shows after the player confirms an option. */
export interface EventCardOutcome {
  action_id: string;
  name: string;
  label: string;
  verdict: Verdict;
  result_line: string;
  why: string;
  effect: EventEffect;
  summary: string;
  origin: EventCardResponse['origin'];
}

export function outcomeOf(response: EventCardResponse, index: number): EventCardOutcome | null {
  const option = response.options[index];
  if (!option) return null;
  return {
    action_id: option.action_id,
    name: response.name,
    label: option.label,
    verdict: option.verdict,
    result_line: option.result_line,
    why: option.why,
    effect: option.effect,
    summary: response.summary,
    origin: response.origin,
  };
}

const NUMBER_KEYS = ['plant_health', 'root_moisture', 'humidity'] as const;

/**
 * The effect of an action as "What changed" rows: numbers as signed changes,
 * the fan as its new setting, and cleared flags as one "problem resolved" row
 * (flag ids are not shown to the player).
 */
export function effectRows(effect: EventEffect, t: Dictionary): ChangeRow[] {
  const e = t.mission.event_card;
  const rows: ChangeRow[] = [];
  for (const key of NUMBER_KEYS) {
    const value = effect[key];
    if (value !== undefined && value !== 0) rows.push({ key, label: t.common.metric[key], value: signed(value) });
  }
  if (effect.fan) {
    rows.push({ key: 'fan', label: t.common.metric.fan, value: format(e.fan_to, { level: t.common.fan_level[effect.fan] }) });
  }
  if (effect.clear_flags && effect.clear_flags.length > 0) {
    rows.push({ key: 'clear_flags', label: e.resolves, value: e.resolved });
  }
  if (rows.length === 0) rows.push({ key: 'none', label: e.changes_title, value: e.no_change, unchanged: true });
  return rows;
}

export function buildEventCardRequest(pending: PendingEvent, plant: PlantState, locale: Locale): EventCardRequest {
  return {
    locale,
    cultivation_day: pending.cultivation_day,
    state: plant,
    event_id: pending.event_id,
    offered_action_ids: [...pending.offered_action_ids],
  };
}

/** POST /api/event, with the response shape checked before anything uses it. */
export async function fetchEventCard(request: EventCardRequest, signal?: AbortSignal): Promise<EventCardResponse> {
  const response = await fetch(EVENT_CARD_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) throw new Error(`Event API answered ${response.status}`);
  return eventCardResponseSchema.parse(await response.json());
}
