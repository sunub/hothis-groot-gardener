import type { EventList } from '@/lib/contract/types';
import { eventListSchema } from './schema';

/**
 * Rules for the event list file beyond its shape, in the same form as
 * src/lib/evidence/check.ts. The data file belongs to the data role; this
 * check tells that role when the file stops fitting what the engine reads.
 */

export interface EventIssue {
  level: 'error' | 'warning';
  /** Location in the file, e.g. `events[3].actions[0]`. */
  path: string;
  message: string;
}

export interface EventCheckResult {
  /** True when there is no error. Warnings do not make the list fail. */
  ok: boolean;
  issues: EventIssue[];
}

/** Ids from other files that the event list points to. */
export interface EventCheckRefs {
  /** Crisis ids of the evidence list. */
  crisisIds: ReadonlySet<string>;
  /** Chunk ids of data/json/total_RAG.json. Omit to skip the chunk check (e.g. in the browser). */
  chunkIds?: ReadonlySet<string>;
}

/**
 * Check an event list. The shape is checked first; the list rules run only
 * when the shape is valid.
 */
export function checkEventList(data: unknown, refs: EventCheckRefs): EventCheckResult {
  const parsed = eventListSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue): EventIssue => ({
        level: 'error',
        path: issue.path.join('.') || '(root)',
        message: `Schema: ${issue.message}`,
      }),
    );
    return { ok: false, issues };
  }
  const list: EventList = parsed.data;
  const issues: EventIssue[] = [];
  const error = (path: string, message: string) => issues.push({ level: 'error', path, message });
  const warning = (path: string, message: string) => issues.push({ level: 'warning', path, message });
  const checkChunk = (path: string, chunkId: string) => {
    if (refs.chunkIds && !refs.chunkIds.has(chunkId)) error(path, `Chunk "${chunkId}" is not in the chunk file.`);
  };

  const seenEvents = new Set<string>();
  const flagsSet = new Set<string>();
  const flagsCleared = new Set<string>();
  const flagsWithEffect = new Set<string>();

  list.events.forEach((event, i) => {
    const path = `events[${i}]`;
    if (seenEvents.has(event.event_id)) error(path, `Duplicate event_id "${event.event_id}".`);
    seenEvents.add(event.event_id);
    event.source_chunks.forEach((chunkId, c) => checkChunk(`${path}.source_chunks[${c}]`, chunkId));

    if (event.kind === 'crisis') {
      if (!refs.crisisIds.has(event.crisis_ref)) {
        error(`${path}.crisis_ref`, `Crisis "${event.crisis_ref}" is not in the evidence list.`);
      }
      return;
    }

    const seenActions = new Set<string>();
    event.actions.forEach((action, a) => {
      if (seenActions.has(action.action_id)) {
        error(`${path}.actions[${a}]`, `Duplicate action_id "${action.action_id}".`);
      }
      seenActions.add(action.action_id);
      for (const flag of action.effect.clear_flags ?? []) flagsCleared.add(flag);
    });
    if (event.actions.length > 0 && !event.actions.some((a) => a.verdict === 'appropriate')) {
      error(`${path}.actions`, 'No action is appropriate.');
    }

    if (event.kind === 'scheduled') {
      // A scheduled event occurs on window.from only (judge.ts).
      if (event.window.from !== event.window.to) {
        error(`${path}.window`, 'A scheduled event must have a one-day window.');
      }
      if (event.maps_to_phase === undefined && event.actions.length === 0) {
        error(`${path}.actions`, 'A scheduled event without maps_to_phase needs actions.');
      }
      return;
    }

    const own = event.on_occur?.set_flags ?? [];
    for (const flag of own) flagsSet.add(flag);
    for (const flag of own) {
      const cleared = event.actions.some((a) => a.effect.clear_flags?.includes(flag));
      if (!cleared) error(`${path}.on_occur`, `No action of this event clears the flag "${flag}".`);
    }
    for (const flag of Object.keys(event.flag_effects ?? {})) {
      flagsWithEffect.add(flag);
      if (!own.includes(flag)) {
        error(`${path}.flag_effects`, `Flag "${flag}" has an effect but this event does not set it.`);
      }
    }
    (event.chains_to ?? []).forEach((crisisId, c) => {
      if (!refs.crisisIds.has(crisisId)) {
        error(`${path}.chains_to[${c}]`, `Crisis "${crisisId}" is not in the evidence list.`);
      }
    });
  });

  for (const flag of flagsCleared) {
    if (!flagsSet.has(flag)) error('events', `Flag "${flag}" is cleared but no event sets it.`);
  }
  // A flag without an effect entry changes nothing in the game (judge.ts, activeFlagEffects).
  for (const flag of flagsSet) {
    if (!flagsWithEffect.has(flag)) {
      warning('events', `Flag "${flag}" is set but has no flag_effects entry, so it changes nothing.`);
    }
  }

  const seenEntryKeys = new Set<string>();
  list.parallel_tracks.forEach((track, t) => {
    track.entries.forEach((entry, e) => {
      const path = `parallel_tracks[${t}].entries[${e}]`;
      checkChunk(`${path}.source_chunk`, entry.source_chunk);
      if (entry.day === null && !entry.when) error(path, 'An entry needs a day or a "when" label.');
      if (entry.entry_id !== undefined) {
        if (seenEntryKeys.has(entry.entry_id)) error(path, `Duplicate entry_id "${entry.entry_id}".`);
        seenEntryKeys.add(entry.entry_id);
      }
    });
  });

  return { ok: issues.every((issue) => issue.level !== 'error'), issues };
}
