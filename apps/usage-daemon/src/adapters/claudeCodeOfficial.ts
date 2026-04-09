import type { SourceSnapshot } from '@vibe-monitor/shared';

type ClaudeUsagePayload = {
  five_hour?: {
    utilization?: number;
    resets_at?: string;
  };
  seven_day?: {
    utilization?: number;
    resets_at?: string;
  };
};

export function normalizeClaudeOfficialUsage(
  payload: ClaudeUsagePayload,
  meta: {
    sourceId: string;
    accountLabel: string;
    planName: string | null;
  }
): SourceSnapshot {
  const windows: SourceSnapshot['windows'] = [
    {
      key: 'five_hour',
      label: '5h',
      percent: payload.five_hour?.utilization ?? null,
      usedAmount: null,
      totalAmount: null,
      unit: null,
      resetAt: payload.five_hour?.resets_at ?? null
    },
    {
      key: 'seven_day',
      label: '7d',
      percent: payload.seven_day?.utilization ?? null,
      usedAmount: null,
      totalAmount: null,
      unit: null,
      resetAt: payload.seven_day?.resets_at ?? null
    }
  ];

  const primary =
    windows
      .filter((window) => window.percent !== null)
      .sort((left, right) => (right.percent ?? 0) - (left.percent ?? 0))[0] ?? windows[0];

  return {
    sourceId: meta.sourceId,
    vendorFamily: 'Anthropic',
    sourceKind: 'official_api',
    accountLabel: meta.accountLabel,
    planName: meta.planName,
    usagePercent: primary.percent,
    usedAmount: null,
    totalAmount: null,
    amountUnit: null,
    resetAt: primary.resetAt,
    refreshStatus: 'ok',
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
    alertKind: null,
    capabilities: {
      percent: true,
      absoluteAmount: false,
      resetTime: true,
      planName: meta.planName !== null,
      healthSignal: true
    },
    windows
  };
}

export async function fetchClaudeOfficialUsage(
  accessToken: string
): Promise<ClaudeUsagePayload> {
  const signal = AbortSignal.timeout(3_000);
  const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
    signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'anthropic-beta': 'oauth-2025-04-20',
      'user-agent': 'vibe-usage-monitor/0.1'
    }
  });

  if (!response.ok) {
    throw new Error(`claude-official-http-${response.status}`);
  }

  return response.json() as Promise<ClaudeUsagePayload>;
}
