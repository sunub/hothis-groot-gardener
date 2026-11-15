import { useSyncExternalStore } from 'react';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(listener: () => void): () => void {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

/** True when the user asked the system for less motion. False while rendering on the server. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}
