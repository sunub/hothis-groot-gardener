import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrisisResponse, DayRecord, MissionPhase, MissionState } from '@/lib/contract/types';
import type { UseMission } from '@/features/mission/use-mission';
import { LocaleProvider } from '@/lib/i18n';
import { INITIAL_PLANT_STATE } from '@/lib/game/rules';

// Screens are rendered once per phase against a fixed mission, with the store and router mocked.
const hook: { current: UseMission } = { current: undefined as unknown as UseMission };

vi.mock('@/features/mission/use-mission', () => ({ useMission: () => hook.current }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const { MissionScreen } = await import('./mission-screen');
const { StartScreen } = await import('./start-screen');

const SECRET = {
  reason: 'SECRET-REASON-TEXT',
  why: 'SECRET-WHY-TEXT',
  result: 'SECRET-RESULT-LINE',
  source: 'SECRET-SOURCE-TITLE',
  quote: 'SECRET-SOURCE-QUOTE',
  action: 'secret_action_id',
};

const response: CrisisResponse = {
  crisis_id: 'overwater_mold',
  name: 'Overwatering and mold',
  stage: 1,
  attempt: 2,
  scene: 'Drops sit on the leaf tips.',
  plant_line: 'My leaves feel heavy.',
  clues: [{ symptom_id: 'guttation', text: 'Water drops on leaf tips' }],
  options: [
    {
      action_id: SECRET.action,
      label: 'Raise the fan to high',
      result_line: SECRET.result,
      why: SECRET.why,
      verdict: 'appropriate',
      reason: SECRET.reason,
      delta: { fan: 'high', humidity: 'to_mid' },
      value_type: 'game_value',
      source: { title: SECRET.source, url: 'https://example.org/s', quote: SECRET.quote },
    },
    {
      action_id: 'water_more',
      label: 'Give more water',
      result_line: 'r',
      why: 'w',
      verdict: 'inappropriate',
      reason: 'x',
      delta: { root_moisture: 20 },
      value_type: 'game_value',
      source: null,
    },
  ],
  record_note: 'This record is from zinnia, not lettuce.',
  crisis_source: { title: 'Crisis record', url: 'https://example.org/c', quote: 'q' },
  origin: 'fallback',
};

function makeMission(phase: MissionPhase): MissionState {
  const after = { ...INITIAL_PLANT_STATE, fan: 'high' as const, humidity: 55 };
  const day: DayRecord = {
    game_day: 3,
    cultivation_day: 12,
    growth_stage: 'growth',
    start: INITIAL_PLANT_STATE,
    roll: null,
    care: [{ kind: 'water', level: 'heavy' }],
    crisis:
      phase === 'crisis_result'
        ? {
            crisis_id: response.crisis_id,
            name: response.name,
            start_stage: 1,
            max_stage: 1,
            outcome: 'resolved',
            attempts: [
              {
                attempt: 1,
                stage: 1,
                offered_action_ids: [SECRET.action],
                action_id: SECRET.action,
                label: 'Raise the fan to high',
                verdict: 'appropriate',
                delta: {},
                before: INITIAL_PLANT_STATE,
                after,
                ground_support: false,
              },
            ],
          }
        : null,
    night:
      phase === 'night'
        ? {
            drift: { root_moisture: -10, humidity: 5 },
            zones: { root_moisture: 'caution_low', humidity: 'normal' },
            health_change: -3,
            end: { ...INITIAL_PLANT_STATE, root_moisture: 35, plant_health: 67 },
          }
        : null,
  };
  return {
    schema_version: 1,
    mission_id: 'm',
    mode: 'standard',
    seed: 1,
    rng_state: 1,
    phase,
    game_day: 3,
    plant: INITIAL_PLANT_STATE,
    care_ops_used: 1,
    danger_days: { root_moisture: 0, humidity: 0 },
    recurrence: null,
    active_crisis: {
      candidates: [response.crisis_id],
      crisis_id: response.crisis_id,
      attempt: 2,
      stage: 1,
      inappropriate_action_ids: [],
      response,
    },
    days: [{ ...day, game_day: 1, cultivation_day: 1, crisis: null, night: null }, day],
    harvest: null,
  };
}

function render(phase: MissionPhase | null, element: 'mission' | 'start' = 'mission'): string {
  hook.current = {
    ready: true,
    mission: phase ? makeMission(phase) : null,
    crisisStatus: 'idle',
    actions: {} as UseMission['actions'],
  };
  const screen = element === 'mission' ? MissionScreen : StartScreen;
  return renderToStaticMarkup(createElement(LocaleProvider, null, createElement(screen)));
}

describe('grow room screens', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders every grow room phase', () => {
    expect(render('care')).toContain('Forecast after tonight');
    expect(render('crisis_pending')).toContain('Checking the grow chamber');
    expect(render('crisis_result')).toContain(SECRET.reason);
    expect(render('night')).toContain('Root moisture in a caution zone: −3');
  });

  it('shows nothing of the verdict, reason, delta or source before the choice', () => {
    const html = render('crisis');
    expect(html).toContain('Raise the fan to high');
    expect(html).toContain('This record is from zinnia');
    expect(html).toContain('The problem continues. New symptoms appeared.');
    for (const secret of [...Object.values(SECRET), 'Appropriate', 'Inappropriate', 'appropriate', 'to_mid', 'Overwatering and mold']) {
      expect(html).not.toContain(secret);
    }
  });

  it('renders the start screen with and without a saved mission', () => {
    expect(render(null, 'start')).not.toContain('Continue mission');
    expect(render('care', 'start')).toContain('Continue mission');
  });

  it('never shows words about eating or approval', () => {
    const all = (['care', 'crisis', 'crisis_result', 'night'] as const).map((p) => render(p)).join(' ') + render(null, 'start');
    expect(all).not.toMatch(/\b(safe|edible|pass|approved)\b/i);
  });
});
