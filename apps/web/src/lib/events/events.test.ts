import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import evidence from '@content/evidence.json';
import events from '@content/events.json';
import { CULTIVATION_DAYS } from '@/lib/game/rules';
import { checkEventList } from './check';
import { eventListSchema, RESPONSE_OPS } from './schema';

/**
 * Checks the event list (data/content/events.json) against its schema, the DB
 * chunks and the evidence list. The format is in schema.ts and the list
 * rules are in check.ts.
 */

const chunkIds = new Set(
  (JSON.parse(readFileSync(join(process.cwd(), '../../data/sources/total_RAG.json'), 'utf8')) as { id: string }[]).map((c) => c.id),
);
const crisisIds = new Set(evidence.crises.map((c) => c.crisis_id));

describe('events.json', () => {
  it('matches the schema', () => {
    const parsed = eventListSchema.safeParse(events);
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
  });

  it('passes the list rules: ids, chunks, crisis references, flags, windows', () => {
    const result = checkEventList(events, { crisisIds, chunkIds });
    expect(result.issues.filter((issue) => issue.level === 'error')).toEqual([]);
  });

  it('lists the same milestones and response operations as the code', () => {
    expect(events.meta.milestones.map((m) => m.cultivation_day)).toEqual([...CULTIVATION_DAYS]);
    expect(events.meta.milestones.map((m) => m.game_day)).toEqual(CULTIVATION_DAYS.map((_, i) => i + 1));
    const ops = [...events.meta.response_ops.care, ...events.meta.response_ops.procedure];
    expect([...ops].sort()).toEqual([...RESPONSE_OPS].sort());
  });
});

describe('checkEventList', () => {
  const refs = { crisisIds, chunkIds };
  /** A deep copy of the shipped list that a test may break. */
  const copy = () => structuredClone(events) as typeof events;
  const errorsOf = (data: unknown) =>
    checkEventList(data, refs).issues.filter((issue) => issue.level === 'error').map((issue) => issue.message);

  it('reports a schema error for a misspelled effect key', () => {
    const list = copy();
    (list.events[2].actions![0].effect as Record<string, unknown>).plant_helth = 1;
    expect(checkEventList(list, refs).ok).toBe(false);
  });

  it('reports a duplicate event id', () => {
    const list = copy();
    list.events[3].event_id = list.events[2].event_id;
    expect(errorsOf(list).some((m) => m.includes('Duplicate event_id'))).toBe(true);
  });

  it('reports a chunk or a crisis that does not exist', () => {
    const list = copy();
    list.events[0].source_chunks[0] = 'no-such-chunk';
    list.events[1].crisis_ref = 'no_such_crisis';
    const errors = errorsOf(list);
    expect(errors.some((m) => m.includes('no-such-chunk'))).toBe(true);
    expect(errors.some((m) => m.includes('no_such_crisis'))).toBe(true);
  });

  it('reports a flag that no action of its event clears', () => {
    const list = copy();
    const fan = list.events.find((e) => e.event_id === 'fan_off_after_restart')!;
    for (const action of fan.actions!) delete (action.effect as Record<string, unknown>).clear_flags;
    expect(errorsOf(list).some((m) => m.includes('clears the flag "fan_actually_off"'))).toBe(true);
  });

  it('requires a verified source exactly on checked track entries', () => {
    const checked = copy();
    const entry = checked.parallel_tracks.flatMap((t) => t.entries).find((e) => e.source_check === 'checked')!;
    delete (entry as Record<string, unknown>).verified_source;
    expect(errorsOf(checked).some((m) => m.includes('needs the verified source'))).toBe(true);

    const unchecked = copy();
    const source = (
      unchecked.parallel_tracks.flatMap((t) => t.entries).find((e) => e.source_check === 'checked') as Record<string, unknown>
    ).verified_source;
    const other = unchecked.parallel_tracks.flatMap((t) => t.entries).find((e) => e.source_check === 'not_checked')!;
    (other as Record<string, unknown>).verified_source = source;
    expect(errorsOf(unchecked).some((m) => m.includes('must not carry a verified source'))).toBe(true);
  });

  it('keeps the verified source when the list is read', () => {
    const parsed = eventListSchema.parse(events);
    const checked = parsed.parallel_tracks.flatMap((t) => t.entries).filter((e) => e.source_check === 'checked');
    expect(checked.length).toBeGreaterThan(0);
    for (const entry of checked) expect(entry.verified_source?.quote).toBeDefined();
  });

  it('reports a record that is longer than a day, points at an unknown crisis, or splits its group over days', () => {
    const list = copy();
    const records = list.events.filter((e) => e.kind === 'record') as Record<string, unknown>[];
    (records[0].window as { to: number }).to = 3;
    records[1].foreshadows = ['no_such_crisis'];
    const grouped = records.filter((r) => r.group === 'lead_up_day_4');
    grouped[1].window = { from: 5, to: 5 };
    const errors = errorsOf(list);
    expect(errors.some((m) => m.includes('record event must have a one-day window'))).toBe(true);
    expect(errors.some((m) => m.includes('no_such_crisis'))).toBe(true);
    expect(errors.some((m) => m.includes('must share one day'))).toBe(true);
  });

  it('reports a scheduled event with a window longer than one day', () => {
    const list = copy();
    list.events[2].window.to = list.events[2].window.from + 1;
    expect(errorsOf(list).some((m) => m.includes('one-day window'))).toBe(true);
  });

  it('warns about a flag that has no effect entry', () => {
    // A test list, so the test does not depend on whether the shipped list has filled in its effects (T5).
    const list = copy();
    const fan = list.events.find((e) => e.event_id === 'fan_off_after_restart')!;
    delete (fan as Record<string, unknown>).flag_effects;
    const warnings = checkEventList(list, refs).issues.filter((issue) => issue.level === 'warning');
    expect(warnings.map((w) => w.message).some((m) => m.includes('"fan_actually_off"'))).toBe(true);
  });

  it('does not warn about a flag that has an effect entry', () => {
    const warnings = checkEventList(events, refs).issues.filter((issue) => issue.level === 'warning');
    expect(warnings.map((w) => w.message).some((m) => m.includes('"fan_actually_off"'))).toBe(false);
  });
});
