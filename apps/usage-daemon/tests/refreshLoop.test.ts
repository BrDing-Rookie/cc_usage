import { describe, expect, it } from 'vitest';
import type { SourceAdapter } from '../src/adapters/types';
import { runRefreshCycle } from '../src/refreshLoop';

describe('runRefreshCycle', () => {
  it('keeps the last good snapshot when a source later fails', async () => {
    let callCount = 0;

    const adapter: SourceAdapter = {
      sourceId: 'mininglamp',
      sourceKind: 'custom_endpoint',
      vendorFamily: 'mininglamp',
      async refresh() {
        callCount += 1;

        if (callCount === 1) {
          return {
            ok: true,
            snapshot: {
              sourceId: 'mininglamp',
              vendorFamily: 'mininglamp',
              sourceKind: 'custom_endpoint',
              accountLabel: 'mininglamp',
              planName: null,
              usagePercent: 82,
              usedAmount: 410,
              totalAmount: 500,
              amountUnit: 'USD',
              resetAt: null,
              refreshStatus: 'ok',
              lastSuccessAt: '2026-04-09T11:55:00.000Z',
              lastError: null,
              alertKind: null,
              capabilities: {
                percent: true,
                absoluteAmount: true,
                resetTime: false,
                planName: false,
                healthSignal: true
              },
              windows: []
            }
          };
        }

        return {
          ok: false,
          sourceId: 'mininglamp',
          refreshStatus: 'source_broken',
          errorText: 'endpoint unreachable'
        };
      }
    };

    const first = await runRefreshCycle([adapter], new Map(), {
      now: () => new Date('2026-04-09T12:00:00.000Z')
    });
    const firstBySource = new Map(first.snapshots.map((s) => [s.sourceId, s]));
    const second = await runRefreshCycle([adapter], firstBySource, {
      now: () => new Date('2026-04-09T12:05:00.000Z')
    });

    expect(first.snapshots[0].alertKind).toBe('quota_low');
    expect(second.snapshots[0].usagePercent).toBe(82);
    expect(second.snapshots[0].refreshStatus).toBe('source_broken');
    expect(second.snapshots[0].lastError).toBe('endpoint unreachable');
  });
});
