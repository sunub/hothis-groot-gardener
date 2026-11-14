import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import evidence from '@/data/evidence.json';
import events from '@/data/events.json';

/**
 * Checks the draft event list (src/data/events.json) against the DB chunks and
 * the evidence list. The engine does not read the event list yet.
 */

const Op = z.enum([
  'water_normal',
  'water_heavy',
  'fan_high',
  'fan_low',
  'open_wicks',
  'thin_to_one',
  'replace_pillow',
  'check_fan_running',
  'keep_observing',
  'do_nothing',
]);

const Action = z.object({
  action_id: z.string().min(1),
  op: Op,
  verdict: z.enum(['appropriate', 'partial', 'inappropriate']),
  effect: z.record(z.string(), z.unknown()),
  value_type: z.literal('game_value'),
});

const Window = z.object({ from: z.number().int().min(0).max(33), to: z.number().int().min(0).max(33) });

const Base = {
  event_id: z.string().regex(/^[a-z0-9_]+$/),
  window: Window,
  summary: z.string().min(1),
  source_chunks: z.array(z.string()).min(1),
};

const Event = z.discriminatedUnion('kind', [
  z.object({ ...Base, kind: z.literal('crisis'), crisis_ref: z.string(), open_questions: z.array(z.string()).optional() }),
  z.object({
    ...Base,
    kind: z.literal('scheduled'),
    name: z.string(),
    actions: z.array(Action),
    maps_to_phase: z.string().optional(),
    scene_hint: z.string().optional(),
    draft: z.array(z.string()),
  }),
  z.object({
    ...Base,
    kind: z.literal('conditional'),
    name: z.string(),
    condition: z.record(z.string(), z.unknown()),
    probability: z.number().gt(0).max(1),
    actions: z.array(Action).min(2),
    chains_to: z.array(z.string()).optional(),
    on_occur: z.object({ set_flags: z.array(z.string()), note: z.string() }).optional(),
    flag_effects: z.record(z.string(), z.unknown()).optional(),
    scene_hint: z.string().optional(),
    draft: z.array(z.string()),
  }),
]);

const Track = z.object({
  experiment: z.string().min(1),
  entries: z.array(
    z.object({ day: z.number().int().min(0).max(33).nullable(), when: z.string().optional(), text: z.string().min(1), source_chunk: z.string() }),
  ).min(1),
});

const EventList = z.object({
  meta: z.object({ schema_version: z.literal(1) }).loose(),
  events: z.array(Event),
  parallel_tracks: z.array(Track),
});

const chunkIds = new Set(
  (JSON.parse(readFileSync(join(process.cwd(), 'data/json/total_RAG.json'), 'utf8')) as { id: string }[]).map((c) => c.id),
);
const list = EventList.parse(events);

describe('events.json (draft)', () => {
  it('matches the draft schema', () => {
    expect(EventList.safeParse(events).success).toBe(true);
  });

  it('has unique event ids and action ids per event', () => {
    const ids = list.events.map((e) => e.event_id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of list.events) {
      if (e.kind === 'crisis') continue;
      const actionIds = e.actions.map((a) => a.action_id);
      expect(new Set(actionIds).size, e.event_id).toBe(actionIds.length);
    }
  });

  it('cites only chunks that exist in the vector DB source file', () => {
    for (const e of list.events) {
      for (const id of e.source_chunks) expect(chunkIds.has(id), `${e.event_id}: ${id}`).toBe(true);
    }
  });

  it('cites only existing chunks in parallel tracks, with a day or a "when" label', () => {
    for (const track of list.parallel_tracks) {
      for (const entry of track.entries) {
        expect(chunkIds.has(entry.source_chunk), `${track.experiment}: ${entry.source_chunk}`).toBe(true);
        expect(entry.day !== null || Boolean(entry.when), `${track.experiment}: ${entry.text}`).toBe(true);
      }
    }
  });

  it('points crisis events and chains at crises in evidence.json', () => {
    const crisisIds = new Set(evidence.crises.map((c) => c.crisis_id));
    for (const e of list.events) {
      if (e.kind === 'crisis') expect(crisisIds.has(e.crisis_ref), e.event_id).toBe(true);
      if (e.kind === 'conditional') for (const c of e.chains_to ?? []) expect(crisisIds.has(c), `${e.event_id} → ${c}`).toBe(true);
    }
  });

  it('keeps windows in order and offers an appropriate action when it offers any', () => {
    for (const e of list.events) {
      expect(e.window.from, e.event_id).toBeLessThanOrEqual(e.window.to);
      if (e.kind !== 'crisis' && e.actions.length > 0) {
        expect(e.actions.some((a) => a.verdict === 'appropriate'), e.event_id).toBe(true);
      }
    }
  });

  it('clears every flag it sets', () => {
    for (const e of list.events) {
      if (e.kind !== 'conditional') continue;
      const cleared = e.actions.flatMap((a) => (a.effect.clear_flags as string[] | undefined) ?? []);
      for (const flag of e.on_occur?.set_flags ?? []) expect(cleared, `${e.event_id}: ${flag}`).toContain(flag);
    }
  });
});
