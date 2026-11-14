import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { crisisResponseSchema } from '@/lib/contract/schemas';
import type { CrisisRequest } from '@/lib/contract/types';
import { INITIAL_PLANT_STATE } from '@/lib/game/rules';
import { POST } from './route';

const text = z.string().trim().min(1);

const errorSchema = z.strictObject({
  error: z.strictObject({ code: z.enum(['bad_request', 'no_candidate', 'internal']), message: text }),
});

function body(patch: Partial<CrisisRequest> = {}): CrisisRequest {
  return {
    locale: 'en',
    cultivation_day: 12,
    state: { ...INITIAL_PLANT_STATE, root_moisture: 20 },
    danger_days: { root_moisture: 1, humidity: 0 },
    history: [],
    active: null,
    ...patch,
  };
}

function post(raw: string): Request {
  return new Request('http://localhost/api/crisis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw,
  });
}

describe('POST /api/crisis', () => {
  it('returns 400 bad_request for invalid JSON', async () => {
    const res = await POST(post('{not json'));
    expect(res.status).toBe(400);
    const json = errorSchema.parse(await res.json());
    expect(json.error.code).toBe('bad_request');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 400 bad_request when the body does not match the request schema', async () => {
    const res = await POST(post(JSON.stringify({ ...body(), cultivation_day: 0, extra: true })));
    expect(res.status).toBe(400);
    expect(errorSchema.parse(await res.json()).error.code).toBe('bad_request');
  });

  it('returns 422 no_candidate when no crisis fits the state', async () => {
    const res = await POST(post(JSON.stringify(body({ state: INITIAL_PLANT_STATE }))));
    expect(res.status).toBe(422);
    expect(errorSchema.parse(await res.json()).error.code).toBe('no_candidate');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 200 with a valid crisis for low root moisture', async () => {
    const res = await POST(post(JSON.stringify(body())));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const crisis = crisisResponseSchema.parse(await res.json());
    expect(crisis).toMatchObject({ crisis_id: 'water_shortage', stage: 1, origin: 'fallback' });
  });

  it('returns 500 internal without leaking the error', async () => {
    vi.resetModules();
    vi.doMock('@/lib/crisis', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@/lib/crisis')>()),
      createCrisis: () => Promise.reject(new Error('secret detail at /srv/path')),
    }));
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { POST: mockedPost } = await import('./route');
      const res = await mockedPost(post(JSON.stringify(body())));
      expect(res.status).toBe(500);
      const raw = await res.text();
      expect(errorSchema.parse(JSON.parse(raw)).error.code).toBe('internal');
      expect(raw).not.toContain('secret');
    } finally {
      quiet.mockRestore();
      vi.doUnmock('@/lib/crisis');
      vi.resetModules();
    }
  });
});
