import type { SourceSnapshot } from '@vibe-monitor/shared';

type SourceConfig = {
  sourceId: string;
  vendorFamily: string;
  accountLabel: string;
  baseUrl: string;
  usagePath: string;
  planNamePath: string;
  percentPath: string;
  usedPath: string;
  totalPath: string;
  unitPath: string;
  resetAtPath: string;
};

function pickPath(input: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (value && typeof value === 'object' && segment in value) {
      return (value as Record<string, unknown>)[segment];
    }

    return undefined;
  }, input);
}

export function normalizeCustomEndpointUsage(
  config: SourceConfig,
  payload: unknown
): SourceSnapshot {
  const planName = pickPath(payload, config.planNamePath);
  const amountUnit = pickPath(payload, config.unitPath);
  const resetAt = pickPath(payload, config.resetAtPath);
  const usedAmount = Number(pickPath(payload, config.usedPath));
  const totalAmount = Number(pickPath(payload, config.totalPath));

  return {
    sourceId: config.sourceId,
    vendorFamily: config.vendorFamily,
    sourceKind: 'custom_endpoint',
    accountLabel: config.accountLabel,
    planName: typeof planName === 'string' && planName.length > 0 ? planName : null,
    usagePercent: Number(pickPath(payload, config.percentPath)),
    usedAmount,
    totalAmount,
    amountUnit: typeof amountUnit === 'string' && amountUnit.length > 0 ? amountUnit : null,
    resetAt: typeof resetAt === 'string' && resetAt.length > 0 ? resetAt : null,
    refreshStatus: 'ok',
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
    alertKind: null,
    capabilities: {
      percent: true,
      absoluteAmount: true,
      resetTime: true,
      planName: true,
      healthSignal: true
    },
    windows: []
  };
}
