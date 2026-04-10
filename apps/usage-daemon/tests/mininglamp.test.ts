import { describe, expect, it } from 'vitest';
import { fetchMininglampUsage } from '../src/adapters/mininglamp';

describe('fetchMininglampUsage', () => {
  it('normalizes trailing slashes and maps USD quota fields', async () => {
    const calledUrls: string[] = [];

    const fakeFetch = (async (input, init) => {
      const url = String(input);
      calledUrls.push(url);

      const authHeader = new Headers(
        (init?.headers as HeadersInit | undefined) ?? undefined
      ).get('authorization');
      expect(authHeader).toBe('Bearer sk-test');

      if (url.endsWith('/dashboard/billing/subscription')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { hard_limit_usd: 500 };
          }
        } as Response;
      }

      if (url.endsWith('/dashboard/billing/usage')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { total_usage: 5981 };
          }
        } as Response;
      }

      throw new Error(`unexpected url: ${url}`);
    }) as typeof fetch;

    const snapshot = await fetchMininglampUsage(
      {
        baseUrl: 'https://llm-gateway.mlamp.cn/',
        apiKey: 'sk-test'
      },
      fakeFetch
    );

    expect(calledUrls).toEqual([
      'https://llm-gateway.mlamp.cn/dashboard/billing/subscription',
      'https://llm-gateway.mlamp.cn/dashboard/billing/usage'
    ]);

    expect(snapshot.sourceId).toBe('mininglamp');
    expect(snapshot.sourceKind).toBe('custom_endpoint');
    expect(snapshot.amountUnit).toBe('USD');
    expect(snapshot.usedAmount).toBeCloseTo(59.81, 2);
    expect(snapshot.totalAmount).toBe(500);
    expect(snapshot.usagePercent).toBeCloseTo(11.96, 2);
  });

  it('throws on non-ok responses', async () => {
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
      fetchMininglampUsage(
        {
          baseUrl: 'https://llm-gateway.mlamp.cn',
          apiKey: 'sk-test'
        },
        fakeFetch
      )
    ).rejects.toThrow('mininglamp-http-401');
  });
});

