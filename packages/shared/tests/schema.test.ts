import { describe, expect, it } from 'vitest';
import { materializedStateSchema } from '../src/schema';

describe('materializedStateSchema', () => {
  it('allows strict missing absolute quota when the capability is false', () => {
    const parsed = materializedStateSchema.parse({
      generatedAt: '2026-04-09T12:00:00.000Z',
      sources: [
        {
          sourceId: 'claude-code-official',
          vendorFamily: 'Anthropic',
          sourceKind: 'official_api',
          accountLabel: 'Personal',
          planName: 'Pro',
          usagePercent: 68,
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
          windows: [
            {
              key: 'five_hour',
              label: '5h',
              percent: 68,
              usedAmount: null,
              totalAmount: null,
              unit: null,
              resetAt: '2026-04-09T14:00:00.000Z'
            }
          ]
        }
      ]
    });

    expect(parsed.sources[0].usedAmount).toBeNull();
    expect(parsed.sources[0].windows[0].label).toBe('5h');
  });

  it('rejects a partial absolute quota pair', () => {
    expect(() =>
      materializedStateSchema.parse({
        generatedAt: '2026-04-09T12:00:00.000Z',
        sources: [
          {
            sourceId: 'broken-source',
            vendorFamily: 'Anthropic',
            sourceKind: 'official_api',
            accountLabel: 'Broken',
            planName: 'Pro',
            usagePercent: 12,
            usedAmount: 10,
            totalAmount: null,
            amountUnit: 'requests',
            resetAt: null,
            refreshStatus: 'ok',
            lastSuccessAt: '2026-04-09T11:55:00.000Z',
            lastError: null,
            alertKind: null,
            capabilities: {
              percent: true,
              absoluteAmount: false,
              resetTime: false,
              planName: true,
              healthSignal: true
            },
            windows: []
          }
        ]
      })
    ).toThrow();
  });
});
