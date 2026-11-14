import raw from '@content/evidence.json';
import type { EvidenceList } from '@/lib/contract/types';

/**
 * The evidence list as typed data. The JSON file is checked against the
 * schema and the list rules (check.ts) in the test suite, and again by the
 * crisis API before it serves a crisis. The screens read it here as is.
 */
export const evidence = raw as EvidenceList;

export * from './select';
