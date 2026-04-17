import { describe, expect, it } from 'vitest';
import {
  appConfigSchema,
  gatewaySummarySchema,
  materializedStateSchema,
  quotaWindowSchema,
  sourceSnapshotSchema
} from '../src/schema';

describe('materializedStateSchema', () => {
  it('accepts gateway summaries plus account snapshots', () => {
    const parsed = materializedStateSchema.parse({
      generatedAt: '2026-04-18T10:00:00.000Z',
      gateways: [
        {
          gatewayId: 'vibe',
          accountCount: 2,
          healthyCount: 2,
          brokenCount: 0,
          usagePercent: 35,
          usedAmount: 70,
          totalAmount: 200,
          amountUnit: 'USD',
          topAlertKind: null,
          lastSuccessAt: '2026-04-18T09:59:00.000Z'
        }
      ],
      accounts: [
        {
          sourceId: 'vibe:main',
          gatewayId: 'vibe',
          accountId: 'main',
          vendorFamily: 'vibe',
          sourceKind: 'custom_endpoint',
          accountLabel: 'Main',
          planName: null,
          usagePercent: 35,
          usedAmount: 70,
          totalAmount: 200,
          amountUnit: 'USD',
          resetAt: null,
          refreshStatus: 'ok',
          lastSuccessAt: '2026-04-18T09:59:00.000Z',
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
      ]
    });

    expect(parsed.gateways[0].gatewayId).toBe('vibe');
    expect(parsed.accounts[0].sourceId).toBe('vibe:main');
  });

  it('rejects sources with invalid data', () => {
    expect(() =>
      materializedStateSchema.parse({
        generatedAt: '2026-04-10T10:00:00.000Z',
        gateways: [],
        accounts: [
          {
            sourceId: '',
            gatewayId: 'vibe',
            accountId: 'test',
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
      gateways: [
        {
          gatewayId: 'vibe',
          accountCount: 1,
          healthyCount: 1,
          brokenCount: 0,
          usagePercent: 42,
          usedAmount: null,
          totalAmount: null,
          amountUnit: null,
          topAlertKind: null,
          lastSuccessAt: '2026-04-09T11:55:00.000Z'
        }
      ],
      accounts: [
        {
          sourceId: 'mininglamp',
          gatewayId: 'vibe',
          accountId: 'main',
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

    expect(parsed.accounts[0].usedAmount).toBeNull();
  });

  it('rejects a partial absolute quota pair', () => {
    expect(() =>
      materializedStateSchema.parse({
        generatedAt: '2026-04-09T12:00:00.000Z',
        gateways: [],
        accounts: [
          {
            sourceId: 'broken-source',
            gatewayId: 'vibe',
            accountId: 'broken',
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

describe('quotaWindowSchema', () => {
  it('rejects a unit when the absolute pair is missing', () => {
    expect(() =>
      quotaWindowSchema.parse({
        key: 'daily',
        label: 'Daily',
        percent: null,
        usedAmount: null,
        totalAmount: null,
        unit: 'requests',
        resetAt: null
      })
    ).toThrow();
  });

  it('accepts a null unit when the absolute pair is missing', () => {
    const parsed = quotaWindowSchema.parse({
      key: 'daily',
      label: 'Daily',
      percent: null,
      usedAmount: null,
      totalAmount: null,
      unit: null,
      resetAt: null
    });

    expect(parsed.unit).toBeNull();
  });
});

describe('sourceSnapshotSchema', () => {
  it('rejects amount units when the absolute pair is missing', () => {
    expect(() =>
      sourceSnapshotSchema.parse({
        sourceId: 'vibe:main',
        vendorFamily: 'vibe',
        sourceKind: 'custom_endpoint',
        accountLabel: 'Main',
        planName: null,
        usagePercent: null,
        usedAmount: null,
        totalAmount: null,
        amountUnit: 'USD',
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
      })
    ).toThrow();
  });

  it('accepts a null amount unit when the absolute pair is missing', () => {
    const parsed = sourceSnapshotSchema.parse({
      sourceId: 'vibe:main',
      vendorFamily: 'vibe',
      sourceKind: 'custom_endpoint',
      accountLabel: 'Main',
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
    });

    expect(parsed.amountUnit).toBeNull();
  });
});

describe('gatewaySummarySchema', () => {
  it('rejects amount units when the absolute pair is missing', () => {
    expect(() =>
      gatewaySummarySchema.parse({
        gatewayId: 'vibe',
        accountCount: 1,
        healthyCount: 1,
        brokenCount: 0,
        usagePercent: null,
        usedAmount: null,
        totalAmount: null,
        amountUnit: 'USD',
        topAlertKind: null,
        lastSuccessAt: '2026-04-09T11:55:00.000Z'
      })
    ).toThrow();
  });

  it('accepts a null amount unit when the absolute pair is missing', () => {
    const parsed = gatewaySummarySchema.parse({
      gatewayId: 'vibe',
      accountCount: 1,
      healthyCount: 1,
      brokenCount: 0,
      usagePercent: null,
      usedAmount: null,
      totalAmount: null,
      amountUnit: null,
      topAlertKind: null,
      lastSuccessAt: '2026-04-09T11:55:00.000Z'
    });

    expect(parsed.amountUnit).toBeNull();
  });

  it('rejects partial absolute quota pairs', () => {
    expect(() =>
      gatewaySummarySchema.parse({
        gatewayId: 'vibe',
        accountCount: 1,
        healthyCount: 1,
        brokenCount: 0,
        usagePercent: 42,
        usedAmount: 10,
        totalAmount: null,
        amountUnit: 'USD',
        topAlertKind: null,
        lastSuccessAt: '2026-04-09T11:55:00.000Z'
      })
    ).toThrow();
  });

  it('rejects contradictory gateway counts', () => {
    expect(() =>
      gatewaySummarySchema.parse({
        gatewayId: 'vibe',
        accountCount: 2,
        healthyCount: 2,
        brokenCount: 1,
        usagePercent: 42,
        usedAmount: 10,
        totalAmount: 20,
        amountUnit: 'USD',
        topAlertKind: null,
        lastSuccessAt: '2026-04-09T11:55:00.000Z'
      })
    ).toThrow();
  });
});

describe('appConfigSchema', () => {
  it('accepts the multi-account app config with a pinned status-bar account', () => {
    const parsed = appConfigSchema.parse({
      statusBar: { pinnedAccountId: 'vibe:main' },
      gateways: [
        {
          gatewayId: 'vibe',
          accounts: [
            { accountId: 'main', label: 'Main', apiKey: 'sk-1', enabled: true }
          ]
        }
      ]
    });

    expect(parsed.statusBar.pinnedAccountId).toBe('vibe:main');
  });
});
