import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaterializedState } from '@vibe-monitor/shared';
import { getCurrentWindow } from '@tauri-apps/api/window';
import App from './App';
import { readAppConfig } from './api/client';

vi.mock('@tauri-apps/api/window', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tauri-apps/api/window')>();

  return {
    ...actual,
    getCurrentWindow: vi.fn()
  };
});

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>();

  return {
    ...actual,
    readAppConfig: vi.fn()
  };
});

afterEach(() => cleanup());

const setSizeMock = vi.fn();
const originalScrollHeightDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollHeight'
);

beforeEach(() => {
  setSizeMock.mockReset();
  vi.mocked(getCurrentWindow).mockReturnValue({
    setSize: setSizeMock
  } as never);
  vi.mocked(readAppConfig).mockResolvedValue({
    statusBar: { pinnedAccountId: 'vibe:main' },
    gateways: [
      {
        gatewayId: 'llm-gateway',
        accounts: [{ accountId: 'prod', label: 'Prod', apiKey: 'sk-prod', enabled: true }]
      },
      {
        gatewayId: 'vibe',
        accounts: [{ accountId: 'main', label: 'Main', apiKey: 'sk-main', enabled: true }]
      }
    ]
  });

  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get() {
      if (this.classList.contains('popover-overview')) {
        return 244;
      }

      if (this.classList.contains('gateway-detail__header')) {
        return 116;
      }

      if (this.classList.contains('account-list')) {
        return this.children.length > 4 ? 520 : 84 * this.children.length;
      }

      return 0;
    }
  });
});

afterEach(() => {
  if (originalScrollHeightDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeightDescriptor);
  } else {
    delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
  }
});

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

  it('sorts overview and detail with the pinned account first', async () => {
    const { container } = render(<App initialState={fixtureState} />);

    await waitFor(() => expect(readAppConfig).toHaveBeenCalled());

    const overviewButtons = Array.from(
      container.querySelectorAll('.popover-overview .gateway-card')
    );
    expect(overviewButtons).toHaveLength(2);
    expect(overviewButtons[0]?.textContent).toContain('Vibe');
    expect(overviewButtons[1]?.textContent).toContain('LLM Gateway');

    fireEvent.click(screen.getByRole('button', { name: /vibe/i }));

    const accountCards = Array.from(
      container.querySelectorAll('.account-list .account-card')
    );
    expect(accountCards).toHaveLength(2);
    expect(accountCards[0]?.textContent).toContain('Main');
    expect(accountCards[1]?.textContent).toContain('Backup');
  });

  it('resizes the popover to fit the overview content with a stable width', async () => {
    render(<App initialState={fixtureState} />);

    await waitFor(() => expect(setSizeMock).toHaveBeenCalled());

    const latestSize = setSizeMock.mock.calls.at(-1)?.[0] as {
      width: number;
      height: number;
    };

    expect(latestSize.width).toBe(320);
    expect(latestSize.height).toBe(268);
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

  it('caps tall gateway details and enables internal scrolling for long account lists', async () => {
    const crowdedState: MaterializedState = {
      ...fixtureState,
      gateways: [
        fixtureState.gateways[0],
        {
          ...fixtureState.gateways[1],
          accountCount: 7,
          healthyCount: 5,
          brokenCount: 2
        }
      ],
      accounts: [
        fixtureState.accounts[0],
        ...Array.from({ length: 7 }, (_, index) => ({
          ...fixtureState.accounts[1],
          sourceId: `vibe:account-${index + 1}`,
          accountId: `account-${index + 1}`,
          accountLabel: `Account ${index + 1}`
        }))
      ]
    };

    render(<App initialState={crowdedState} />);

    fireEvent.click(screen.getByRole('button', { name: /vibe/i }));

    const accountList = await screen.findByRole('list', { name: /vibe accounts/i });

    await waitFor(() => expect(setSizeMock).toHaveBeenCalledTimes(2));

    const latestSize = setSizeMock.mock.calls.at(-1)?.[0] as {
      width: number;
      height: number;
    };

    expect(latestSize.width).toBe(320);
    expect(latestSize.height).toBe(420);
    expect(accountList.className).toContain('account-list--scrollable');
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
