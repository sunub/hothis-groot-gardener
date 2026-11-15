import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { DayRecord, MissionPhase, MissionState, PlantState } from '@/lib/contract/types';
import type { UseMission } from '@/features/mission/use-mission';
import { evidence } from '@/lib/evidence';
import { LocaleProvider } from '@/lib/i18n';
import { en } from '@/lib/i18n/en';

// Screens are rendered to static markup with the store and router mocked; no DOM is needed.
const hook: { current: UseMission } = { current: undefined as unknown as UseMission };

vi.mock('@/features/mission/use-mission', () => ({ useMission: () => hook.current }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const { HarvestScreen } = await import('./harvest-screen');
const { ReportScreen } = await import('./report-screen');
const { SourcesScreen } = await import('./sources-screen');

function plant(health: number, root = 55, humidity = 55): PlantState {
  return { plant_health: health, root_moisture: root, humidity, fan: 'low', light: { red: 'medium', blue: 'medium' } };
}

function makeMission(phase: MissionPhase): MissionState {
  const crisisStart = plant(70, 85, 75);
  const days: DayRecord[] = [
    {
      game_day: 1,
      cultivation_day: 1,
      growth_stage: 'germination',
      start: plant(70),
      roll: null,
      care: [{ kind: 'water', level: 'heavy' }, { kind: 'fan', level: 'low' }],
      crisis: null,
      night: {
        drift: { root_moisture: -10, humidity: 5 },
        zones: { root_moisture: 'danger_high', humidity: 'caution_high' },
        health_change: -13,
        end: crisisStart,
      },
    },
    {
      game_day: 2,
      cultivation_day: 6,
      growth_stage: 'germination',
      start: crisisStart,
      roll: { candidates: ['overwater_mold'], probability: 1, roll: 0.2, occurred: true },
      care: [],
      crisis: {
        crisis_id: 'overwater_mold',
        name: 'Overwatering and mold',
        start_stage: 1,
        max_stage: 1,
        outcome: phase === 'failed' ? 'mission_failed' : 'resolved',
        attempts: [
          {
            attempt: 1,
            stage: 1,
            offered_action_ids: ['fan_high', 'add_water'],
            action_id: phase === 'failed' ? 'add_water' : 'fan_high',
            label: 'Raise the fan to high',
            verdict: phase === 'failed' ? 'inappropriate' : 'appropriate',
            delta: { fan: 'high' },
            before: crisisStart,
            after: phase === 'failed' ? plant(0, 95, 75) : plant(75),
            ground_support: false,
          },
        ],
      },
      night: null,
    },
  ];
  const finished = phase === 'report' || phase === 'harvest' || phase === 'freeze';
  if (finished) {
    days[1].night = {
      drift: { root_moisture: -10, humidity: 5 },
      zones: { root_moisture: 'normal', humidity: 'normal' },
      health_change: 3,
      end: plant(78),
    };
    days.push({
      game_day: 7,
      cultivation_day: 33,
      growth_stage: 'harvest',
      start: plant(78),
      roll: null,
      care: [],
      crisis: null,
      night: null,
    });
  }
  return {
    schema_version: 1,
    mission_id: 'm1',
    mode: 'demo',
    seed: 0,
    rng_state: 1,
    phase,
    game_day: days[days.length - 1].game_day,
    plant: phase === 'failed' ? plant(0, 95, 75) : plant(78),
    care_ops_used: 0,
    danger_days: { root_moisture: 0, humidity: 0 },
    recurrence: null,
    active_crisis: null,
    days,
    harvest:
      phase === 'report' || phase === 'freeze'
        ? {
            sanitized: true,
            final_health: 78,
            grade: 'success',
            microbial: {
              value: 2.9,
              classification: 'within_range',
              factors: [
                { key: 'baseline', count: 1, change: 3 },
                { key: 'humidity_caution_days', count: 2, change: 0.2 },
                { key: 'humidity_danger_days', count: 0, change: 0 },
                { key: 'mold_partial_end', count: 0, change: 0 },
                { key: 'mold_inappropriate', count: 0, change: 0 },
                { key: 'mold_stage_3', count: 0, change: 0 },
                { key: 'crisis_sanitize', count: 0, change: 0 },
                { key: 'harvest_sanitize', count: 1, change: -0.3 },
              ],
            },
          }
        : null,
  };
}

function render(screen: ComponentType, mission: MissionState | null): string {
  hook.current = {
    ready: true,
    mission,
    crisisStatus: 'idle',
    eventCard: null,
    eventStatus: 'idle',
    actions: {} as UseMission['actions'],
  };
  return renderToStaticMarkup(createElement(LocaleProvider, null, createElement(screen)));
}

/** Visible text without tags, entities decoded enough for word checks. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

/** The product's own words: the mandatory denial sentence and verbatim quotes are removed. */
function ownWords(html: string): string {
  return text(html)
    .split(en.report.report.microbial.not_safe)
    .join(' ')
    .replace(/“[^”]*”/g, ' ');
}

function expectNoVerdictWords(html: string): void {
  const words = ownWords(html);
  expect(words).not.toMatch(/\bsafe(ty)?\b/i);
  expect(words).not.toMatch(/\bedible\b|\bpass(ed|es)?\b|\bapproved\b|\bcertified\b/i);
  expect(words).not.toMatch(/\bwip(e|es|ed|ing)\b/i);
}

describe('harvest screen', () => {
  it('shows the grade, the step and both harvest choices', () => {
    const html = render(HarvestScreen, makeMission('harvest'));
    const h = en.report.harvest;
    expect(html).toContain(h.sanitize_button);
    expect(html).toContain(h.plain_button);
    expect(html).toContain(h.grade_note);
    expect(html).toContain(en.report.grade.success);
    expectNoVerdictWords(html);
  });

  it('shows the freeze step after harvest', () => {
    const html = render(HarvestScreen, makeMission('freeze'));
    expect(html).toContain(en.report.freeze.confirm);
    expect(html).not.toContain(en.report.harvest.sanitize_button);
  });
});

describe('report screen', () => {
  it('shows every section of the ground analysis report in order', () => {
    const html = render(ReportScreen, makeMission('report'));
    const r = en.report;
    const order = [
      r.report.summary.title,
      r.report.microbial.title,
      r.report.pathogen.title,
      r.report.factors.title,
      r.metrics.title,
      r.history.title,
      r.record.title,
      r.actions.new_mission,
    ].map((s) => html.lastIndexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('2.90');
    expect(html).toContain(r.classification.within_range);
    expect(html).toContain(r.report.microbial.not_safe);
    expect(text(html)).toContain(evidence.harvest.standards_note.text);
    expect(text(html)).toContain(evidence.harvest.microbial_range.description);
    expect(text(html)).toContain(evidence.harvest.pathogen_screen.result);
    expectNoVerdictWords(html);
  });

  it('shows a cultivation record summary without harvest sections when the mission failed', () => {
    const html = render(ReportScreen, makeMission('failed'));
    const r = en.report;
    expect(html).toContain(r.failed.title);
    expect(html).not.toContain(r.report.microbial.title);
    expect(html).not.toContain(r.report.pathogen.title);
    expect(html).toContain(r.metrics.title);
    expect(html).toContain(r.record.title);
    expect(text(html)).toContain('Raise the fan to high');
    expectNoVerdictWords(html);
  });
});

describe('sources screen', () => {
  it('renders without a mission and lists every crisis and the game rules', () => {
    const html = render(SourcesScreen, null);
    for (const crisis of evidence.crises) expect(text(html)).toContain(crisis.name);
    expect(html).toContain(en.report.sources.rules_title);
    expect(text(html)).toContain(evidence.meta.ai_disclosure);
    expectNoVerdictWords(html);
  });
});
