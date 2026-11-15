/**
 * Runs once when the Next.js server starts. Starts loading the language model
 * in the background (src/server/ai/crisis/llm/warmup.ts); the server does not wait
 * for it. Skipped in the build, which serves no crises.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { warmUpModel } = await import('@/server/ai/crisis/llm/warmup');
  void warmUpModel();
}
