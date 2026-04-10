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
  currentBySource: Map<string, SourceSnapshot>;
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
    snapshots: Array.from(next.values()),
    currentBySource: next
  };
}
