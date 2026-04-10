import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';

afterEach(() => cleanup());

const fixtureState = {
  generatedAt: '2026-04-10T10:00:00.000Z',
  historyWindow: 'last_5_hours',
  sources: [
    {
      sourceId: 'claude-code-official',
      vendorFamily: 'Anthropic',
      sourceKind: 'official_api' as const,
      accountLabel: 'Personal',
      planName: 'Max',
      usagePercent: 68,
      usedAmount: null,
      totalAmount: null,
      amountUnit: null,
      resetAt: '2026-04-10T12:00:00.000Z',
      refreshStatus: 'ok' as const,
      lastSuccessAt: '2026-04-10T09:55:00.000Z',
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
          resetAt: '2026-04-10T12:00:00.000Z'
        }
      ]
    },
    {
      sourceId: 'codex-official',
      vendorFamily: 'OpenAI',
      sourceKind: 'browser_automation' as const,
      accountLabel: 'Personal',
      planName: 'Plus',
      usagePercent: 15,
      usedAmount: null,
      totalAmount: null,
      amountUnit: null,
      resetAt: null,
      refreshStatus: 'ok' as const,
      lastSuccessAt: '2026-04-10T09:56:00.000Z',
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
    },
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
  history: {
    'claude-code-official': [
      { recordedAt: '2026-04-10T09:00:00.000Z', value: 62, kind: 'percent' }
    ],
    'codex-official': [
      { recordedAt: '2026-04-10T09:00:00.000Z', value: 15, kind: 'percent' }
    ],
    mininglamp: [
      { recordedAt: '2026-04-10T09:00:00.000Z', value: 59.81, kind: 'usd' }
    ]
  }
};

describe('App', () => {
  it('renders the fixed three-source compact strip by default', () => {
    render(<App initialState={fixtureState} />);

    expect(screen.getByText('Claude Code')).toBeTruthy();
    expect(screen.getByText('OpenAI Codex')).toBeTruthy();
    expect(screen.getByText('mininglamp')).toBeTruthy();
    expect(screen.getByText('$59.81')).toBeTruthy();
  });

  it('expands the monitor on click', () => {
    render(<App initialState={fixtureState} />);

    fireEvent.click(screen.getByRole('button', { name: /usage monitor/i }));

    expect(screen.getByText('Last 5 hours')).toBeTruthy();
    expect(screen.getByText('Today usage')).toBeTruthy();
  });
});
