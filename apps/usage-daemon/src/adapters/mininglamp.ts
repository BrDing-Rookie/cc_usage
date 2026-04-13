import type { SourceSnapshot } from '@vibe-monitor/shared';
import type { SourceAdapter } from './types';

export type MininglampCredentials = {
  baseUrl: string;
  apiKey: string;
};

async function fetchJson(
  url: string,
  apiKey: string,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const signal = AbortSignal.timeout(8_000);
  const response = await fetchImpl(url, {
    signal,
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: 'application/json',
      'user-agent': 'vibe-usage-monitor/0.1'
    }
  });

  if (!response.ok) {
    throw new Error(`llm-gateway-http-${response.status}`);
  }

  return response.json();
}

function toPositiveNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function toNonnegativeNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export async function fetchMininglampUsage(
  credentials: MininglampCredentials,
  fetchImpl: typeof fetch = fetch
): Promise<SourceSnapshot> {
  const normalizedBaseUrl = credentials.baseUrl.replace(/\/+$/, '');
  const [subscription, usage] = await Promise.all([
    fetchJson(
      `${normalizedBaseUrl}/dashboard/billing/subscription`,
      credentials.apiKey,
      fetchImpl
    ),
    fetchJson(
      `${normalizedBaseUrl}/dashboard/billing/usage`,
      credentials.apiKey,
      fetchImpl
    )
  ]);

  const totalAmount = toPositiveNumber(
    (subscription as Record<string, unknown> | null)?.hard_limit_usd
  );
  const usedRaw = toNonnegativeNumber(
    (usage as Record<string, unknown> | null)?.total_usage
  );
  const usedAmount = totalAmount === null || usedRaw === null ? null : usedRaw / 100;

  const usagePercent =
    totalAmount === null || usedAmount === null
      ? null
      : Math.min(100, Math.max(0, (usedAmount / totalAmount) * 100));

  return {
    sourceId: 'llm-gateway',
    vendorFamily: 'llm-gateway',
    sourceKind: 'custom_endpoint',
    accountLabel: 'llm-gateway',
    planName: null,
    usagePercent,
    usedAmount,
    totalAmount,
    amountUnit: totalAmount === null ? null : 'USD',
    resetAt: null,
    refreshStatus: 'ok',
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
    alertKind: null,
    capabilities: {
      percent: usagePercent !== null,
      absoluteAmount: totalAmount !== null,
      resetTime: false,
      planName: false,
      healthSignal: true
    },
    windows: []
  };
}

export function buildMininglampAdapter(
  credentials: MininglampCredentials,
  deps: { fetchImpl?: typeof fetch } = {}
): SourceAdapter {
  const fetchImpl = deps.fetchImpl ?? fetch;

  return {
    sourceId: 'llm-gateway',
    sourceKind: 'custom_endpoint',
    vendorFamily: 'llm-gateway',
    async refresh() {
      try {
        return {
          ok: true,
          snapshot: await fetchMininglampUsage(credentials, fetchImpl)
        } as const;
      } catch (error) {
        return {
          ok: false,
          sourceId: 'llm-gateway',
          refreshStatus: 'source_broken',
          errorText: error instanceof Error ? error.message : 'llm-gateway fetch failed'
        } as const;
      }
    }
  };
}
