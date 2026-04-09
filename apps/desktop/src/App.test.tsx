import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the calm grouped summary and alert emphasis', () => {
    render(
      <App
        initialState={{
          generatedAt: '2026-04-09T12:00:00.000Z',
          sources: [
            {
              sourceId: 'claude-code-official',
              vendorFamily: 'Anthropic',
              sourceKind: 'official_api',
              accountLabel: 'Personal',
              planName: 'Pro',
              usagePercent: 87,
              usedAmount: null,
              totalAmount: null,
              amountUnit: null,
              resetAt: '2026-04-09T14:00:00.000Z',
              refreshStatus: 'ok',
              lastSuccessAt: '2026-04-09T11:55:00.000Z',
              lastError: null,
              alertKind: 'quota_low',
              capabilities: {
                percent: true,
                absoluteAmount: false,
                resetTime: true,
                planName: true,
                healthSignal: true
              },
              windows: []
            }
          ]
        }}
      />
    );

    expect(screen.getByText('Anthropic')).toBeTruthy();
    expect(screen.getByText('Attention Needed')).toBeTruthy();
  });
});
