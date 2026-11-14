import raw from '@/data/events.json';
import type { EventList } from '@/lib/contract/types';
import { eventListSchema } from './schema';

/**
 * The event list as typed data. Parsing at load time turns a broken data
 * file into an immediate, clear error, and drops the working notes
 * (`draft`, `open_questions`) that the engine must not read.
 *
 * The list rules that go beyond the format (ids exist, flags are cleared)
 * are checked by check.ts in the test suite.
 */
export const eventList: EventList = eventListSchema.parse(raw);

export * from './check';
export * from './judge';
export { eventListSchema, RESPONSE_OPS, TIMELINE_FIRST_DAY, TIMELINE_LAST_DAY } from './schema';
