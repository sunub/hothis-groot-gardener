import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import licenses from '@content/source-licenses.json';

/**
 * Checks the license record (data/content/source-licenses.json) against the
 * retrieval chunks, so no chunk is used without a known license.
 */

/** Licenses that allow showing the source sentences with attribution. */
const QUOTABLE_LICENSES = new Set(['CC BY 4.0']);

const Source = z.strictObject({
  source_id: z.string().min(1),
  citation: z.string().min(1),
  url: z.url(),
  license: z.string().min(1).nullable(),
  license_url: z.url().nullable(),
  use: z.enum(['quote', 'facts_only']),
  translation_may_be_published: z.boolean(),
  public_nasa_copy: z.url().nullable(),
  note: z.string().min(1),
});

const LicenseRecord = z.object({
  meta: z.object({ checked_on: z.iso.date(), method: z.string().min(1) }).loose(),
  sources: z.array(Source).min(1),
});

interface Chunk {
  id: string;
  metadata: { source_id: string; source_url: string; source_license?: string | null };
}

const chunks = JSON.parse(
  readFileSync(join(process.cwd(), '../../data/sources/total_RAG.json'), 'utf8'),
) as Chunk[];
const record = LicenseRecord.parse(licenses);
const bySourceId = new Map(record.sources.map((s) => [s.source_id, s]));

describe('source-licenses.json', () => {
  it('lists each source once', () => {
    expect(bySourceId.size).toBe(record.sources.length);
  });

  it('covers the source of every retrieval chunk', () => {
    for (const chunk of chunks) {
      expect(bySourceId.has(chunk.metadata.source_id), chunk.id).toBe(true);
    }
  });

  it('lists no source that the chunks do not use', () => {
    const used = new Set(chunks.map((c) => c.metadata.source_id));
    for (const source of record.sources) expect(used.has(source.source_id), source.source_id).toBe(true);
  });

  it('agrees with the url and the license written on the chunks', () => {
    for (const chunk of chunks) {
      const source = bySourceId.get(chunk.metadata.source_id);
      expect(chunk.metadata.source_url, chunk.id).toBe(source?.url);
      if (chunk.metadata.source_license) {
        expect(chunk.metadata.source_license, chunk.id).toBe(source?.license);
      }
    }
  });

  it('allows quoting and published translations only under a license that permits them', () => {
    for (const source of record.sources) {
      const quotable = source.license !== null && QUOTABLE_LICENSES.has(source.license);
      expect(source.use === 'quote', source.source_id).toBe(quotable);
      expect(source.translation_may_be_published, source.source_id).toBe(quotable);
      expect(source.license === null, source.source_id).toBe(source.license_url === null);
    }
  });
});
