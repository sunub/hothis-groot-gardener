import type { en } from './en';

/** Every string widened from its literal type (readonly is kept), so other languages need not repeat the English words. */
type Widen<T> = T extends string
  ? string
  : T extends readonly unknown[]
    ? { [K in keyof T]: Widen<T[K]> }
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T;

/**
 * The shape every dictionary must have: same keys and same array lengths as
 * English. A key missing from another language fails the type check.
 */
export type Dictionary = Widen<typeof en>;
