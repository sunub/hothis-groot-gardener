/**
 * Settings for the language model and the evidence search, read from
 * environment variables (`.env.local` in development). Server-side only.
 *
 * With LLM_MODEL unset, no generator is connected and every crisis comes from
 * the pre-made list, exactly as before.
 */

/** "ollama": Ollama's own API (/api/chat). "openai": any OpenAI-compatible server (vLLM on RunPod, LM Studio). */
export type LlmProvider = 'ollama' | 'openai';

export interface LlmConfig {
  provider: LlmProvider;
  /** Ollama: http://127.0.0.1:11434. OpenAI-compatible: the URL that ends in /v1. */
  baseUrl: string;
  model: string;
  /** Sent as a Bearer token when set (OpenAI-compatible servers that need one). */
  apiKey?: string;
  /** Per generation attempt. The pipeline tries twice before the pre-made crisis. */
  timeoutMs: number;
  temperature: number;
  /** Ollama only: context window in tokens. */
  numCtx: number;
  /** Ollama only: false turns the model's thinking mode off; undefined leaves the field out. */
  think?: boolean;
  /** Evidence search server (rag_server.py). Unset: no search. */
  ragUrl?: string;
  ragTopN: number;
  ragTimeoutMs: number;
  /** When set, every generation is appended to <dir>/generations.jsonl. */
  logDir?: string;
  /**
   * Ollama only: how long the model stays loaded after a request ("30m", "-1"
   * for always). Ollama's own default is 5 minutes; reloading the model took
   * about 27 s on the development laptop, close to the 30 s attempt limit.
   */
  keepAlive?: string;
}

type Env = Record<string, string | undefined>;

export const LLM_DEFAULTS = {
  provider: 'ollama' as LlmProvider,
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  timeoutMs: 30_000,
  temperature: 0.4,
  numCtx: 8192,
  ragTopN: 4,
  ragTimeoutMs: 3_000,
  keepAlive: '30m',
};

/** Read the settings. Returns null when LLM_MODEL is not set (generator off). */
export function readLlmConfig(env: Env = process.env): LlmConfig | null {
  const model = env.LLM_MODEL?.trim();
  if (!model) return null;

  const providerRaw = (env.LLM_PROVIDER ?? LLM_DEFAULTS.provider).trim().toLowerCase();
  if (providerRaw !== 'ollama' && providerRaw !== 'openai') {
    throw new Error(`LLM_PROVIDER must be "ollama" or "openai", got "${providerRaw}".`);
  }
  const provider: LlmProvider = providerRaw;

  const baseUrl = trimSlash(
    env.LLM_BASE_URL?.trim() || (provider === 'ollama' ? LLM_DEFAULTS.ollamaBaseUrl : ''),
  );
  if (!baseUrl) {
    throw new Error('LLM_BASE_URL is required when LLM_PROVIDER is "openai" (the URL that ends in /v1).');
  }

  const thinkRaw = (env.LLM_THINK ?? 'false').trim().toLowerCase();
  const think = thinkRaw === 'omit' ? undefined : thinkRaw === 'true';

  return {
    provider,
    baseUrl,
    model,
    apiKey: env.LLM_API_KEY?.trim() || undefined,
    timeoutMs: positiveInt(env.LLM_TIMEOUT_MS, LLM_DEFAULTS.timeoutMs, 'LLM_TIMEOUT_MS'),
    temperature: numberIn(env.LLM_TEMPERATURE, LLM_DEFAULTS.temperature, 0, 2, 'LLM_TEMPERATURE'),
    numCtx: positiveInt(env.LLM_NUM_CTX, LLM_DEFAULTS.numCtx, 'LLM_NUM_CTX'),
    think,
    ragUrl: env.RAG_URL?.trim() ? trimSlash(env.RAG_URL.trim()) : undefined,
    ragTopN: numberIn(env.RAG_TOP_N, LLM_DEFAULTS.ragTopN, 1, 10, 'RAG_TOP_N'),
    ragTimeoutMs: positiveInt(env.RAG_TIMEOUT_MS, LLM_DEFAULTS.ragTimeoutMs, 'RAG_TIMEOUT_MS'),
    logDir: env.LLM_LOG_DIR?.trim() || undefined,
    keepAlive:
      env.LLM_KEEP_ALIVE?.trim().toLowerCase() === 'omit'
        ? undefined
        : env.LLM_KEEP_ALIVE?.trim() || LLM_DEFAULTS.keepAlive,
  };
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function positiveInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}".`);
  }
  return value;
}

function numberIn(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number from ${min} to ${max}, got "${raw}".`);
  }
  return value;
}
