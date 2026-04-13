import type { SourceSnapshot } from '@vibe-monitor/shared';
import type { SourceAdapter } from './types';

export type LiteLLMCredentials = {
  baseUrl: string;
  apiKey: string;
};

async function fetchJson(
  url: string,
  apiKey: string,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const signal = AbortSignal.timeout(3_000);
  const response = await fetchImpl(url, {
    signal,
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: 'application/json',
      'user-agent': 'vibe-usage-monitor/0.1'
    }
  });

  if (!response.ok) {
    throw new Error(`litellm-http-${response.status}`);
  }

  return response.json();
}

export async function fetchLiteLLMUsage(
  credentials: LiteLLMCredentials,
  fetchImpl: typeof fetch = fetch
): Promise<SourceSnapshot> {
  const normalizedBaseUrl = credentials.baseUrl.replace(/\/+$/, '');
  const data = await fetchJson(
    `${normalizedBaseUrl}/key/info`,
    credentials.apiKey,
    fetchImpl
  );

  const info = (data as Record<string, unknown>)?.info as
    | Record<string, unknown>
    | null
    | undefined;

  const maxBudget = info?.max_budget ?? null;
  const spend = info?.spend ?? null;
  const keyAlias = info?.key_alias;
  const budgetResetAt = info?.budget_reset_at;

  const hasAbsoluteAmount =
    typeof maxBudget === 'number' && Number.isFinite(maxBudget) && maxBudget > 0;

  const usedAmount =
    hasAbsoluteAmount && typeof spend === 'number' && Number.isFinite(spend) && spend >= 0
      ? spend
      : null;
  const totalAmount = hasAbsoluteAmount ? (maxBudget as number) : null;

  const usagePercent =
    totalAmount === null || usedAmount === null
      ? null
      : Math.min(100, Math.max(0, (usedAmount / totalAmount) * 100));

  const resetAt =
    typeof budgetResetAt === 'string' && budgetResetAt.length > 0
      ? budgetResetAt
      : null;

  const accountLabel =
    typeof keyAlias === 'string' && keyAlias.length > 0 ? keyAlias : 'vibe';

  return {
    sourceId: 'vibe',
    vendorFamily: 'vibe',
    sourceKind: 'custom_endpoint',
    accountLabel,
    planName: null,
    usagePercent,
    usedAmount,
    totalAmount,
    amountUnit: totalAmount === null ? null : 'USD',
    resetAt,
    refreshStatus: 'ok',
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
    alertKind: null,
    capabilities: {
      percent: usagePercent !== null,
      absoluteAmount: totalAmount !== null,
      resetTime: resetAt !== null,
      planName: false,
      healthSignal: true
    },
    windows: []
  };
}

export function buildLiteLLMAdapter(
  credentials: LiteLLMCredentials,
  deps: { fetchImpl?: typeof fetch } = {}
): SourceAdapter {
  const fetchImpl = deps.fetchImpl ?? fetch;

  return {
    sourceId: 'vibe',
    sourceKind: 'custom_endpoint',
    vendorFamily: 'vibe',
    async refresh() {
      try {
        return {
          ok: true,
          snapshot: await fetchLiteLLMUsage(credentials, fetchImpl)
        } as const;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'vibe fetch failed';
        const refreshStatus = message === 'litellm-http-401' ? 'auth_invalid' : 'source_broken';

        return {
          ok: false,
          sourceId: 'vibe',
          refreshStatus,
          errorText: message
        } as const;
      }
    }
  };
}
