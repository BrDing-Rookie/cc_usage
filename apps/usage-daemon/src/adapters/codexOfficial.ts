import type { SourceSnapshot } from '@vibe-monitor/shared';

export function normalizeCodexOfficialUsage(
  meta: {
    sourceId: string;
    accountLabel: string;
    planName: string | null;
  },
  workerResult: {
    planName: string | null;
    usagePercent: number | null;
    resetAt: string | null;
  }
): SourceSnapshot {
  return {
    sourceId: meta.sourceId,
    vendorFamily: 'OpenAI',
    sourceKind: 'browser_automation',
    accountLabel: meta.accountLabel,
    planName: workerResult.planName ?? meta.planName,
    usagePercent: workerResult.usagePercent,
    usedAmount: null,
    totalAmount: null,
    amountUnit: null,
    resetAt: workerResult.resetAt,
    refreshStatus: 'ok',
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
    alertKind: null,
    capabilities: {
      percent: workerResult.usagePercent !== null,
      absoluteAmount: false,
      resetTime: workerResult.resetAt !== null,
      planName: (workerResult.planName ?? meta.planName) !== null,
      healthSignal: true
    },
    windows: []
  };
}
