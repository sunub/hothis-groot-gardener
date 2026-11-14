const ON_VALUES = new Set(['on', 'true', '1']);

/**
 * Whether event card text generation is switched on through LLM_EVENT_CARDS.
 * Only "on", "true" or "1" (any case, surrounding spaces ignored) turn it on;
 * anything else, including unset or empty, leaves it off.
 */
export function eventCardGenerationEnabled(value: string | undefined): boolean {
  return value !== undefined && ON_VALUES.has(value.trim().toLowerCase());
}
