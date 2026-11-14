import { z } from 'zod';
import type { GenerationCandidate } from '../generator';

/**
 * Client for the evidence search server (rag_server.py on the minjung branch
 * line). Search is optional: any failure returns no excerpts and the
 * generation goes on without them.
 */

export interface EvidenceChunk {
  id: string;
  subsection: string;
  /** Chunk body without its section headings. */
  text: string;
  source_url: string;
  source_location: string;
  source_license: string | null;
}

const responseSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      section: z.string(),
      subsection: z.string(),
      text: z.string(),
      source_url: z.string(),
      source_location: z.string(),
      source_license: z.string().nullable(),
    }),
  ),
});

/** English search query for one crisis: what it is, what is visible, what can be done. */
export function buildRetrievalQuery(candidate: GenerationCandidate): string {
  const symptoms = candidate.symptoms.map((s) => s.name).join('; ');
  const actions = candidate.actions.map((a) => a.name).join('; ');
  return `Red romaine lettuce in the ISS Veggie unit. ${candidate.name}. Observed: ${symptoms}. Possible actions: ${actions}.`;
}

export interface RetrieveOptions {
  ragUrl: string;
  topN: number;
  timeoutMs: number;
  /** The generation's signal: aborting it also stops the search. */
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export async function retrieveExcerpts(
  query: string,
  { ragUrl, topN, timeoutMs, signal, fetchImpl = fetch }: RetrieveOptions,
): Promise<EvidenceChunk[]> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const res = await fetchImpl(`${ragUrl}/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_n: topN }),
      signal: combined,
    });
    if (!res.ok) {
      console.warn(`Evidence search answered ${res.status}; continuing without excerpts.`);
      return [];
    }
    const parsed = responseSchema.safeParse(await res.json());
    if (!parsed.success) {
      console.warn('Evidence search returned an unexpected shape; continuing without excerpts.');
      return [];
    }
    return parsed.data.results.map((r) => ({
      id: r.id,
      subsection: r.subsection,
      text: stripHeadings(r.text, [r.section, r.subsection]),
      source_url: r.source_url,
      source_location: r.source_location,
      source_license: r.source_license,
    }));
  } catch (error) {
    if (signal?.aborted) throw error;
    console.warn('Evidence search failed; continuing without excerpts.', error);
    return [];
  }
}

/** Chunks start with their section and subsection titles on separate lines. */
function stripHeadings(text: string, headings: string[]): string {
  const lines = text.split('\n');
  while (lines.length > 0 && (lines[0].trim() === '' || headings.includes(lines[0].trim()))) {
    lines.shift();
  }
  return lines.join('\n').trim() || text.trim();
}
