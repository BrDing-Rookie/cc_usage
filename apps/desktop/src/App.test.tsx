import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';

afterEach(() => cleanup());

const fixtureState = {
  generatedAt: '2026-04-10T10:00:00.000Z',
  sources: [
    {
      sourceId: 'mininglamp',
      vendorFamily: 'mininglamp',
      sourceKind: 'custom_endpoint' as const,
      accountLabel: 'mininglamp',
      planName: null,
      usagePercent: 11.96,
      usedAmount: 59.81,
      totalAmount: 500,
      amountUnit: 'USD',
      resetAt: null,
      refreshStatus: 'ok' as const,
      lastSuccessAt: '2026-04-10T09:57:00.000Z',
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
  ],
};

const warningState = {
  ...fixtureState,
  sources: [
    {
      ...fixtureState.sources[0],
      usagePercent: 85,
      usedAmount: 425,
    }
  ]
};

describe('App', () => {
  it('renders mininglamp usage in popover', () => {
    render(<App initialState={fixtureState} />);

    expect(screen.getByText('mininglamp')).toBeTruthy();
    expect(screen.getByText('12%')).toBeTruthy();
    expect(screen.getByText('$59.81')).toBeTruthy();
    expect(screen.getByText('$500.00')).toBeTruthy();
  });

  it('renders warning state when percent exceeds 80', () => {
    render(<App initialState={warningState} />);

    const percentEl = screen.getByText('85%');
    expect(percentEl.classList.contains('text-red')).toBe(true);
  });

  it('renders empty state when no sources', () => {
    const emptyState = { ...fixtureState, sources: [] };
    render(<App initialState={emptyState} />);

    expect(screen.getByText('No data available')).toBeTruthy();
  });
});
