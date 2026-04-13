import { describe, expect, it } from 'vitest';
import { buildLiteLLMAdapter, fetchLiteLLMUsage } from '../src/adapters/litellm';

describe('fetchLiteLLMUsage', () => {
  it('normalizes spend and max_budget into USD quota fields', async () => {
    const fakeFetch = (async (input, init) => {
      const url = String(input);
      expect(url).toBe('https://vibe.deepminer.ai/key/info');

      const authHeader = new Headers(
        (init?.headers as HeadersInit | undefined) ?? undefined
      ).get('authorization');
      expect(authHeader).toBe('Bearer sk-test');

      return {
        ok: true,
        status: 200,
        async json() {
          return {
            key: 'sk-test',
            info: {
              spend: 368.18,
              max_budget: 500.0,
              key_alias: 'panfeng1@mininglamp.com',
              budget_reset_at: null,
              budget_duration: null
            }
          };
        }
      } as Response;
    }) as typeof fetch;

    const snapshot = await fetchLiteLLMUsage(
      {
        baseUrl: 'https://vibe.deepminer.ai/',
        apiKey: 'sk-test'
      },
      fakeFetch
    );

    expect(snapshot.sourceId).toBe('vibe');
    expect(snapshot.sourceKind).toBe('custom_endpoint');
    expect(snapshot.vendorFamily).toBe('vibe');
    expect(snapshot.amountUnit).toBe('USD');
    expect(snapshot.usedAmount).toBeCloseTo(368.18, 2);
    expect(snapshot.totalAmount).toBe(500);
    expect(snapshot.usagePercent).toBeCloseTo(73.636, 2);
    expect(snapshot.accountLabel).toBe('panfeng1@mininglamp.com');
    expect(snapshot.capabilities.absoluteAmount).toBe(true);
    expect(snapshot.capabilities.percent).toBe(true);
    expect(snapshot.capabilities.resetTime).toBe(false);
  });

  it('returns null amounts when max_budget is null', async () => {
    const fakeFetch = (async () => {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            key: 'sk-test',
            info: {
              spend: 100.5,
              max_budget: null,
              key_alias: 'user@example.com',
              budget_reset_at: null,
              budget_duration: null
            }
          };
        }
      } as Response;
    }) as typeof fetch;

    const snapshot = await fetchLiteLLMUsage(
      { baseUrl: 'https://vibe.deepminer.ai', apiKey: 'sk-test' },
      fakeFetch
    );

    expect(snapshot.usedAmount).toBeNull();
    expect(snapshot.totalAmount).toBeNull();
    expect(snapshot.usagePercent).toBeNull();
    expect(snapshot.amountUnit).toBeNull();
    expect(snapshot.capabilities.absoluteAmount).toBe(false);
    expect(snapshot.capabilities.percent).toBe(false);
  });

  it('throws on 401 responses', async () => {
    const fakeFetch = (async () => {
      return {
        ok: false,
        status: 401,
        async json() {
          return { error: 'unauthorized' };
        }
      } as Response;
    }) as typeof fetch;

    await expect(
      fetchLiteLLMUsage(
        { baseUrl: 'https://vibe.deepminer.ai', apiKey: 'sk-bad' },
        fakeFetch
      )
    ).rejects.toThrow('litellm-http-401');
  });

  it('falls back accountLabel to vibe when key_alias is null', async () => {
    const fakeFetch = (async () => {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            key: 'sk-test',
            info: {
              spend: 10,
              max_budget: 100,
              key_alias: null,
              budget_reset_at: null,
              budget_duration: null
            }
          };
        }
      } as Response;
    }) as typeof fetch;

    const snapshot = await fetchLiteLLMUsage(
      { baseUrl: 'https://vibe.deepminer.ai', apiKey: 'sk-test' },
      fakeFetch
    );

    expect(snapshot.accountLabel).toBe('vibe');
  });
});

describe('buildLiteLLMAdapter', () => {
  it('maps 401 errors to auth_invalid', async () => {
    const fakeFetch = (async () => {
      return { ok: false, status: 401 } as Response;
    }) as typeof fetch;

    const adapter = buildLiteLLMAdapter(
      { baseUrl: 'https://vibe.deepminer.ai', apiKey: 'sk-bad' },
      { fetchImpl: fakeFetch }
    );

    const result = await adapter.refresh();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refreshStatus).toBe('auth_invalid');
      expect(result.errorText).toBe('litellm-http-401');
    }
  });

  it('maps other HTTP errors to source_broken', async () => {
    const fakeFetch = (async () => {
      return { ok: false, status: 500 } as Response;
    }) as typeof fetch;

    const adapter = buildLiteLLMAdapter(
      { baseUrl: 'https://vibe.deepminer.ai', apiKey: 'sk-test' },
      { fetchImpl: fakeFetch }
    );

    const result = await adapter.refresh();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refreshStatus).toBe('source_broken');
      expect(result.errorText).toBe('litellm-http-500');
    }
  });
});
