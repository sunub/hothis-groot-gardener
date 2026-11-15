import { warmUp } from './client';
import { readLlmConfig } from './config';

/** Longest wait for the model to load. */
export const WARM_UP_TIMEOUT_MS = 120_000;

/**
 * Called once when the server starts (src/instrumentation.ts). Loads the model
 * in the background, so the first crisis does not wait for it. Never throws:
 * without the model the game still runs on the pre-made crises.
 */
export async function warmUpModel(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let config;
  try {
    config = readLlmConfig(env);
  } catch (error) {
    console.warn(`[llm] Settings are invalid: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (!config || config.provider !== 'ollama') return;
  console.log(`[llm] Loading ${config.model} ...`);
  try {
    const ms = await warmUp(config, AbortSignal.timeout(WARM_UP_TIMEOUT_MS), fetchImpl);
    if (ms !== null) console.log(`[llm] ${config.model} is loaded (${(ms / 1000).toFixed(1)} s).`);
  } catch (error) {
    console.warn(
      `[llm] Could not load ${config.model}: ${error instanceof Error ? error.message : String(error)}. ` +
        'The first crisis may be slow or use a pre-made text.',
    );
  }
}
