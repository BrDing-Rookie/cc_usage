import { describe, expect, it } from 'vitest';
import type { SourceAdapter } from '../src/adapters/types';
import { runRefreshCycle } from '../src/refreshLoop';

describe('runRefreshCycle', () => {
  it('keeps the last good snapshot when a source later fails', async () => {
    let callCount = 0;

    const adapter: SourceAdapter = {
      sourceId: 'claude-code-official',
      sourceKind: 'official_api',
      vendorFamily: 'Anthropic',
      async refresh() {
        callCount += 1;

        if (callCount === 1) {
          return {
            ok: true,
            snapshot: {
              sourceId: 'claude-code-official',
              vendorFamily: 'Anthropic',
              sourceKind: 'official_api',
              accountLabel: 'Personal',
              planName: 'Pro',
              usagePercent: 82,
              usedAmount: null,
              totalAmount: null,
              amountUnit: null,
              resetAt: '2026-04-09T14:00:00.000Z',
              refreshStatus: 'ok',
              lastSuccessAt: '2026-04-09T11:55:00.000Z',
              lastError: null,
              alertKind: null,
              capabilities: {
                percent: true,
                absoluteAmount: false,
                resetTime: true,
                planName: true,
                healthSignal: true
              },
              windows: []
            }
          };
        }

        return {
          ok: false,
          sourceId: 'claude-code-official',
          refreshStatus: 'source_broken',
          errorText: 'selector missing'
        };
      }
    };

    const first = await runRefreshCycle([adapter], new Map(), {
      now: () => new Date('2026-04-09T12:00:00.000Z')
    });
    const second = await runRefreshCycle([adapter], first.currentBySource, {
      now: () => new Date('2026-04-09T12:05:00.000Z')
    });

    expect(first.snapshots[0].alertKind).toBe('quota_low');
    expect(second.snapshots[0].usagePercent).toBe(82);
    expect(second.snapshots[0].refreshStatus).toBe('source_broken');
    expect(second.snapshots[0].lastError).toBe('selector missing');
  });
});
