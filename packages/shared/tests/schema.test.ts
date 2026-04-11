import { describe, expect, it } from 'vitest';
import { materializedStateSchema } from '../src/schema';

describe('materializedStateSchema', () => {
  it('rejects invalid history point kinds', () => {
    expect(() =>
      materializedStateSchema.parse({
        generatedAt: '2026-04-10T10:00:00.000Z',
        historyWindow: 'last_5_hours',
        sources: [],
        history: {
          mininglamp: [
            {
              recordedAt: '2026-04-10T09:00:00.000Z',
              value: 68,
              kind: 'pct'
            }
          ]
        }
      })
    ).toThrow();
  });

  it('allows missing absolute quota when the capability is false', () => {
    const parsed = materializedStateSchema.parse({
      generatedAt: '2026-04-09T12:00:00.000Z',
      historyWindow: 'last_5_hours',
      sources: [
        {
          sourceId: 'mininglamp',
          vendorFamily: 'mininglamp',
          sourceKind: 'custom_endpoint',
          accountLabel: 'mininglamp',
          planName: null,
          usagePercent: 42,
          usedAmount: null,
          totalAmount: null,
          amountUnit: null,
          resetAt: null,
          refreshStatus: 'ok',
          lastSuccessAt: '2026-04-09T11:55:00.000Z',
          lastError: null,
          alertKind: null,
          capabilities: {
            percent: true,
            absoluteAmount: false,
            resetTime: false,
            planName: false,
            healthSignal: true
          },
          windows: []
        }
      ],
      history: {}
    });

    expect(parsed.sources[0].usedAmount).toBeNull();
  });

  it('rejects a partial absolute quota pair', () => {
    expect(() =>
      materializedStateSchema.parse({
        generatedAt: '2026-04-09T12:00:00.000Z',
        historyWindow: 'last_5_hours',
        sources: [
          {
            sourceId: 'broken-source',
            vendorFamily: 'test',
            sourceKind: 'custom_endpoint',
            accountLabel: 'Broken',
            planName: null,
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
              planName: false,
              healthSignal: true
            },
            windows: []
          }
        ],
        history: {}
      })
    ).toThrow();
  });
});
