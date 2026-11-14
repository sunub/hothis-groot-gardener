import { describe, expect, it } from 'vitest';
import raw from '@/data/evidence.json';
import type { EvidenceList, SourceRef } from '@/lib/contract/types';
import { checkEvidenceList, type EvidenceIssue } from './check';

const SOURCE: SourceRef = {
  title: 'Test source',
  url: 'https://example.org/doc',
  quote: 'A sentence copied from the source.',
};

/** A small list that passes every rule. Each test breaks one rule. */
function validList(): EvidenceList {
  return {
    meta: { schema_version: 1, description: 'Test list', ai_disclosure: 'None', updated: 'today' },
    crises: [
      {
        crisis_id: 'c1',
        name: 'Crisis one',
        summary: 'What was recorded.',
        record: { crop: 'Lettuce', experiment: 'X', note: '' },
        trigger: { any_of: [{ metric: 'root_moisture', side: 'low' }] },
        symptoms: [
          { symptom_id: 's1', name: 'S1', stage: 1, value_type: 'game_value', source: null },
          { symptom_id: 's2', name: 'S2', stage: 2, value_type: 'game_value', source: null },
        ],
        actions: [
          {
            action_id: 'a1',
            name: 'Right',
            verdict: 'appropriate',
            reason: 'Because.',
            delta: { root_moisture: 'to_mid' },
            value_type: 'game_value',
            source: { ...SOURCE },
          },
          {
            action_id: 'a2',
            name: 'Wrong',
            verdict: 'inappropriate',
            reason: 'Because.',
            delta: { plant_health: -10 },
            value_type: 'game_value',
            source: { ...SOURCE },
          },
        ],
        source: { ...SOURCE },
      },
    ],
    harvest: {
      steps: [
        {
          step_id: 'harvest_sanitize',
          name: 'Sanitize',
          description: 'Wipe.',
          value_type: 'game_value',
          source: null,
        },
      ],
      microbial_range: {
        min: 1,
        max: 2,
        unit: 'log10 CFU/g',
        description: 'Range.',
        value_type: 'measured',
        source: { ...SOURCE },
      },
      pathogen_screen: {
        organisms: ['E. coli'],
        result: 'None found.',
        value_type: 'measured',
        source: { ...SOURCE },
      },
      standards_note: { text: 'No standard.', source: { ...SOURCE } },
    },
    background: [{ claim_id: 'b1', claim: 'Claim.', source: { ...SOURCE } }],
  };
}

function errors(issues: EvidenceIssue[]): EvidenceIssue[] {
  return issues.filter((i) => i.level === 'error');
}

function warnings(issues: EvidenceIssue[]): EvidenceIssue[] {
  return issues.filter((i) => i.level === 'warning');
}

describe('checkEvidenceList rules', () => {
  it('accepts a valid list with no issues', () => {
    expect(checkEvidenceList(validList())).toEqual({ ok: true, issues: [] });
  });

  it('reports a schema failure as an error and stops', () => {
    const list = validList() as unknown as Record<string, unknown>;
    delete list.harvest;
    const result = checkEvidenceList(list);
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatchObject({ level: 'error', path: 'harvest' });
  });

  it('reports an empty quote (schema rejects blank text)', () => {
    const list = validList();
    list.crises[0].source.quote = '   ';
    const result = checkEvidenceList(list);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.path)).toContain('crises[0].source.quote');
  });

  it('reports a duplicate crisis_id', () => {
    const list = validList();
    list.crises.push(structuredClone(list.crises[0]));
    const result = checkEvidenceList(list);
    expect(result.ok).toBe(false);
    expect(errors(result.issues).map((i) => i.path)).toEqual(['crises[1].crisis_id']);
  });

  it('reports a duplicate action_id within a crisis', () => {
    const list = validList();
    list.crises[0].actions[1].action_id = 'a1';
    const result = checkEvidenceList(list);
    expect(errors(result.issues).map((i) => i.path)).toEqual(['crises[0].actions[1].action_id']);
  });

  it('allows the same action_id in two different crises', () => {
    const list = validList();
    const second = structuredClone(list.crises[0]);
    second.crisis_id = 'c2';
    list.crises.push(second);
    expect(checkEvidenceList(list).ok).toBe(true);
  });

  it('reports a duplicate symptom_id within a crisis', () => {
    const list = validList();
    list.crises[0].symptoms[1].symptom_id = 's1';
    const result = checkEvidenceList(list);
    expect(errors(result.issues).map((i) => i.path)).toEqual(['crises[0].symptoms[1].symptom_id']);
  });

  it('reports a crisis without an appropriate action', () => {
    const list = validList();
    list.crises[0].actions[0].verdict = 'partial';
    const result = checkEvidenceList(list);
    expect(result.ok).toBe(false);
    expect(errors(result.issues).map((i) => i.path)).toEqual(['crises[0].actions']);
  });

  it('warns about a crisis without an inappropriate action', () => {
    const list = validList();
    list.crises[0].actions[1].verdict = 'partial';
    const result = checkEvidenceList(list);
    expect(result.ok).toBe(true);
    expect(warnings(result.issues).map((i) => i.path)).toEqual(['crises[0].actions']);
  });

  it('reports an appropriate action with a null source', () => {
    const list = validList();
    list.crises[0].actions[0].source = null;
    const result = checkEvidenceList(list);
    expect(errors(result.issues).map((i) => i.path)).toEqual(['crises[0].actions[0].source']);
  });

  it('warns about a non-appropriate action with a null source', () => {
    const list = validList();
    list.crises[0].actions[1].source = null;
    const result = checkEvidenceList(list);
    expect(result.ok).toBe(true);
    expect(warnings(result.issues).map((i) => i.path)).toEqual(['crises[0].actions[1].source']);
  });

  it('reports a measured symptom with a null source', () => {
    const list = validList();
    list.crises[0].symptoms[0].value_type = 'measured';
    const result = checkEvidenceList(list);
    expect(errors(result.issues).map((i) => i.path)).toEqual(['crises[0].symptoms[0].source']);
  });

  it('reports a measured action delta with a null source', () => {
    const list = validList();
    list.crises[0].actions[1].value_type = 'measured';
    list.crises[0].actions[1].source = null;
    const result = checkEvidenceList(list);
    expect(errors(result.issues).map((i) => i.path)).toEqual(['crises[0].actions[1].source']);
  });

  it('reports a measured harvest step with a null source', () => {
    const list = validList();
    list.harvest.steps[0].value_type = 'measured';
    const result = checkEvidenceList(list);
    expect(errors(result.issues).map((i) => i.path)).toEqual(['harvest.steps[0].source']);
  });

  it.each([
    ['crisis source', (l: EvidenceList) => l.crises[0].source, 'crises[0].source.quote'],
    [
      'action source',
      (l: EvidenceList) => l.crises[0].actions[0].source!,
      'crises[0].actions[0].source.quote',
    ],
    [
      'microbial range source',
      (l: EvidenceList) => l.harvest.microbial_range.source,
      'harvest.microbial_range.source.quote',
    ],
    [
      'pathogen screen source',
      (l: EvidenceList) => l.harvest.pathogen_screen.source,
      'harvest.pathogen_screen.source.quote',
    ],
    [
      'standards note source',
      (l: EvidenceList) => l.harvest.standards_note.source,
      'harvest.standards_note.source.quote',
    ],
    ['background source', (l: EvidenceList) => l.background[0].source, 'background[0].source.quote'],
  ])('reports a PROVISIONAL quote in the %s', (_name, pick, path) => {
    const list = validList();
    pick(list).quote = 'PROVISIONAL';
    const result = checkEvidenceList(list);
    expect(errors(result.issues).map((i) => i.path)).toEqual([path]);
  });

  it('reports a PROVISIONAL quote in a symptom source', () => {
    const list = validList();
    list.crises[0].symptoms[0].source = { ...SOURCE, quote: 'PROVISIONAL' };
    const result = checkEvidenceList(list);
    expect(errors(result.issues).map((i) => i.path)).toEqual(['crises[0].symptoms[0].source.quote']);
  });

  it('reports symptom stages that do not start at 1', () => {
    const list = validList();
    list.crises[0].symptoms[0].stage = 2;
    const result = checkEvidenceList(list);
    expect(errors(result.issues).map((i) => i.path)).toEqual(['crises[0].symptoms']);
  });

  it('reports a gap in symptom stages', () => {
    const list = validList();
    list.crises[0].symptoms[1].stage = 3;
    const result = checkEvidenceList(list);
    expect(errors(result.issues)).toHaveLength(1);
    expect(errors(result.issues)[0].message).toContain('stage 2');
  });

  it('reports microbial_range.min >= max', () => {
    const list = validList();
    list.harvest.microbial_range.min = 2;
    const result = checkEvidenceList(list);
    expect(errors(result.issues).map((i) => i.path)).toEqual(['harvest.microbial_range']);
  });
});

describe('shipped evidence list', () => {
  // Expected to fail until the evidence owner replaces the PROVISIONAL quotes
  // and fills in the sources of the appropriate actions. Do not weaken it.
  it('the shipped evidence list has no errors', () => {
    const result = checkEvidenceList(raw);
    expect(errors(result.issues)).toEqual([]);
  });
});
