import raw from '@/data/evidence.json';
import type { EvidenceList } from '@/lib/contract/types';

/**
 * The evidence list as typed data. The JSON file is checked against the
 * schema and the list rules in the test suite (see check.ts), so the app
 * reads it here without parsing it again.
 */
export const evidence = raw as EvidenceList;

export * from './select';
