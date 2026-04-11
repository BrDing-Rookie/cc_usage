import { describe, expect, it } from 'vitest';
import { materializedStateSchema } from '../src/schema';

describe('materializedStateSchema', () => {
  it('rejects sources with invalid data', () => {
    expect(() =>
      materializedStateSchema.parse({
        generatedAt: '2026-04-10T10:00:00.000Z',
        sources: [
          {
            sourceId: '',
            vendorFamily: 'test',
            sourceKind: 'custom_endpoint',
            accountLabel: 'Test',
            planName: null,
            usagePercent: null,
            usedAmount: null,
            totalAmount: null,
            amountUnit: null,
            resetAt: null,
            refreshStatus: 'ok',
            lastSuccessAt: null,
            lastError: null,
            alertKind: null,
            capabilities: {
              percent: false,
              absoluteAmount: false,
              resetTime: false,
              planName: false,
              healthSignal: true
            },
            windows: []
          }
        ]
      })
    ).toThrow();
  });

  it('allows missing absolute quota when the capability is false', () => {
    const parsed = materializedStateSchema.parse({
      generatedAt: '2026-04-09T12:00:00.000Z',
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
      ]
    });

    expect(parsed.sources[0].usedAmount).toBeNull();
  });

  it('rejects a partial absolute quota pair', () => {
    expect(() =>
      materializedStateSchema.parse({
        generatedAt: '2026-04-09T12:00:00.000Z',
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
        ]
      })
    ).toThrow();
  });
});
