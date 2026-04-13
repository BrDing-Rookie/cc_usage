import type { SourceSnapshot } from '@vibe-monitor/shared';
import { classifyAlert } from './alerts/classify';
import type { SourceAdapter } from './adapters/types';

export async function runRefreshCycle(
  adapters: SourceAdapter[],
  currentBySource: Map<string, SourceSnapshot>,
  deps: {
    now?: () => Date;
    staleAfterMs?: number;
  } = {}
): Promise<{
  snapshots: SourceSnapshot[];
}> {
  const now = deps.now?.() ?? new Date();
  const staleAfterMs = deps.staleAfterMs ?? 15 * 60_000;
  const next = new Map(currentBySource);

  for (const adapter of adapters) {
    const result = await adapter.refresh();

    if (result.ok) {
      const snapshot: SourceSnapshot = {
        ...result.snapshot,
        alertKind: classifyAlert(result.snapshot, staleAfterMs, now)
      };
      next.set(adapter.sourceId, snapshot);
      continue;
    }

    const lastGood = next.get(adapter.sourceId);
    if (!lastGood) {
      // First run with no prior data — still emit a snapshot so the source
      // is visible in materialized state (with error status).
      next.set(adapter.sourceId, {
        sourceId: adapter.sourceId,
        vendorFamily: adapter.vendorFamily,
        sourceKind: adapter.sourceKind,
        accountLabel: adapter.sourceId,
        planName: null,
        usagePercent: null,
        usedAmount: null,
        totalAmount: null,
        amountUnit: null,
        resetAt: null,
        refreshStatus: result.refreshStatus,
        lastSuccessAt: null,
        lastError: result.errorText,
        alertKind: classifyAlert(
          { refreshStatus: result.refreshStatus, lastSuccessAt: null, usagePercent: null } as SourceSnapshot,
          staleAfterMs,
          now
        ),
        capabilities: {
          percent: false,
          absoluteAmount: false,
          resetTime: false,
          planName: false,
          healthSignal: true,
        },
        windows: [],
      });
      continue;
    }

    const merged: SourceSnapshot = {
      ...lastGood,
      refreshStatus: result.refreshStatus,
      lastError: result.errorText
    };

    merged.alertKind = classifyAlert(merged, staleAfterMs, now);
    next.set(adapter.sourceId, merged);
  }

  return {
    snapshots: Array.from(next.values())
  };
}
