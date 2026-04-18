import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { MaterializedState } from '@vibe-monitor/shared';
import App from './App';

afterEach(() => cleanup());

const fixtureState: MaterializedState = {
  generatedAt: '2026-04-18T10:00:00.000Z',
  gateways: [
    {
      gatewayId: 'llm-gateway',
      accountCount: 1,
      healthyCount: 1,
      brokenCount: 0,
      usagePercent: 12,
      usedAmount: 60,
      totalAmount: 500,
      amountUnit: 'USD',
      topAlertKind: null,
      lastSuccessAt: '2026-04-18T09:59:00.000Z'
    },
    {
      gatewayId: 'vibe',
      accountCount: 2,
      healthyCount: 1,
      brokenCount: 1,
      usagePercent: 35,
      usedAmount: 70,
      totalAmount: 200,
      amountUnit: 'USD',
      topAlertKind: 'quota_low',
      lastSuccessAt: '2026-04-18T09:59:00.000Z'
    }
  ],
  accounts: [
    {
      sourceId: 'llm-gateway:prod',
      gatewayId: 'llm-gateway',
      accountId: 'prod',
      vendorFamily: 'llm-gateway',
      sourceKind: 'custom_endpoint',
      accountLabel: 'Prod',
      planName: null,
      usagePercent: 12,
      usedAmount: 60,
      totalAmount: 500,
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
    },
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
    },
    {
      sourceId: 'vibe:backup',
      gatewayId: 'vibe',
      accountId: 'backup',
      vendorFamily: 'vibe',
      sourceKind: 'custom_endpoint',
      accountLabel: 'Backup',
      planName: null,
      usagePercent: 85,
      usedAmount: 170,
      totalAmount: 200,
      amountUnit: 'USD',
      resetAt: null,
      refreshStatus: 'source_broken',
      lastSuccessAt: '2026-04-18T09:54:00.000Z',
      lastError: 'vibe-http-500',
      alertKind: 'source_broken',
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
};

describe('App', () => {
  it('renders both gateway overview cards', () => {
    render(<App initialState={fixtureState} />);

    expect(screen.getByRole('button', { name: /llm gateway/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /vibe/i })).toBeTruthy();
    expect(screen.getByText('$60.00 / $500.00')).toBeTruthy();
    expect(screen.getByText('$70.00 / $200.00')).toBeTruthy();
    expect(screen.getByText('1 issue')).toBeTruthy();
  });

  it('drills into one gateway and returns to the overview', () => {
    render(<App initialState={fixtureState} />);

    fireEvent.click(screen.getByRole('button', { name: /vibe/i }));

    expect(screen.getByText('Main')).toBeTruthy();
    expect(screen.getByText('Backup')).toBeTruthy();
    expect(screen.getByRole('button', { name: /back/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(screen.getByRole('button', { name: /llm gateway/i })).toBeTruthy();
  });

  it('renders the fixed zero-state overview when no accounts are configured', () => {
    const emptyState: MaterializedState = {
      generatedAt: fixtureState.generatedAt,
      gateways: [
        {
          gatewayId: 'llm-gateway',
          accountCount: 0,
          healthyCount: 0,
          brokenCount: 0,
          usagePercent: null,
          usedAmount: null,
          totalAmount: null,
          amountUnit: null,
          topAlertKind: null,
          lastSuccessAt: null
        },
        {
          gatewayId: 'vibe',
          accountCount: 0,
          healthyCount: 0,
          brokenCount: 0,
          usagePercent: null,
          usedAmount: null,
          totalAmount: null,
          amountUnit: null,
          topAlertKind: null,
          lastSuccessAt: null
        }
      ],
      accounts: []
    };

    render(<App initialState={emptyState} />);

    expect(screen.getByRole('button', { name: /llm gateway/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /vibe/i })).toBeTruthy();
    expect(screen.getAllByText('No accounts')).toHaveLength(2);
  });
});
