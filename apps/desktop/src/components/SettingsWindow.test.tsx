import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig, MaterializedState } from '@vibe-monitor/shared';
import { SettingsWindow } from './SettingsWindow';
import {
  loadMaterializedState,
  readAppConfig,
  restartDaemon,
  writeAppConfig
} from '../api/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';

vi.mock('../api/client', () => ({
  loadMaterializedState: vi.fn(),
  readAppConfig: vi.fn(),
  restartDaemon: vi.fn(),
  writeAppConfig: vi.fn()
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn()
}));

const closeMock = vi.fn();
const setSizeMock = vi.fn();
const innerSizeMock = vi.fn();
const scaleFactorMock = vi.fn();

const baseScrollHeight = 240;
const accountScrollHeight = 120;
const settingsMaxHeight = 720;

const initialConfig: AppConfig = {
  statusBar: { pinnedAccountId: 'llm-gateway:prod' },
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
};

const materializedState: MaterializedState = {
  generatedAt: '2026-04-18T10:00:00.000Z',
  gateways: [],
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
      sourceId: 'vibe:account-2',
      gatewayId: 'vibe',
      accountId: 'account-2',
      vendorFamily: 'vibe',
      sourceKind: 'custom_endpoint',
      accountLabel: 'Backup',
      planName: null,
      usagePercent: 20,
      usedAmount: 40,
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
};

describe('SettingsWindow', () => {
  beforeEach(() => {
    closeMock.mockReset();
    setSizeMock.mockReset();
    innerSizeMock.mockReset();
    scaleFactorMock.mockReset();

    innerSizeMock.mockResolvedValue({
      toLogical: () => ({ width: 720, height: 420 })
    });
    scaleFactorMock.mockResolvedValue(1);

    vi.mocked(getCurrentWindow).mockReturnValue({
      close: closeMock,
      innerSize: innerSizeMock,
      scaleFactor: scaleFactorMock,
      setSize: setSizeMock
    } as never);
    vi.mocked(readAppConfig).mockResolvedValue(initialConfig);
    vi.mocked(writeAppConfig).mockResolvedValue(undefined);
    vi.mocked(restartDaemon).mockResolvedValue(undefined);
    vi.mocked(loadMaterializedState).mockResolvedValue(materializedState);

    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function () {
      if (!(this instanceof HTMLElement) || !this.classList.contains('settings')) {
        return 0;
      }

      return baseScrollHeight + this.querySelectorAll('.settings-account').length * accountScrollHeight;
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('grows the window height as accounts are added while keeping the current width', async () => {
    render(<SettingsWindow />);

    await screen.findByDisplayValue('Main');

    await waitFor(() => {
      expect(setSizeMock).toHaveBeenCalledWith(expect.any(LogicalSize));
    });

    const initialSize = setSizeMock.mock.calls.at(-1)?.[0];
    expect(initialSize).toBeInstanceOf(LogicalSize);
    expect(initialSize.width).toBe(720);
    expect(initialSize.height).toBe(baseScrollHeight + 2 * accountScrollHeight);

    fireEvent.click(screen.getByRole('button', { name: /add vibe account/i }));

    await waitFor(() => {
      const nextSize = setSizeMock.mock.calls.at(-1)?.[0];
      expect(nextSize).toBeInstanceOf(LogicalSize);
      expect(nextSize.width).toBe(720);
      expect(nextSize.height).toBe(baseScrollHeight + 3 * accountScrollHeight);
    });
  });

  it('caps the window height and keeps account content in a scroll container', async () => {
    const crowdedConfig: AppConfig = {
      ...initialConfig,
      gateways: initialConfig.gateways.map((gateway) =>
        gateway.gatewayId === 'vibe'
          ? {
              ...gateway,
              accounts: Array.from({ length: 8 }, (_, index) => ({
                accountId: `account-${index + 1}`,
                label: `Account ${index + 1}`,
                apiKey: `sk-${index + 1}`,
                enabled: true
              }))
            }
          : gateway
      )
    };

    vi.mocked(readAppConfig).mockResolvedValueOnce(crowdedConfig);

    render(<SettingsWindow />);

    await screen.findByDisplayValue('Account 8');

    await waitFor(() => {
      const size = setSizeMock.mock.calls.at(-1)?.[0];
      expect(size).toBeInstanceOf(LogicalSize);
      expect(size.width).toBe(720);
      expect(size.height).toBe(settingsMaxHeight);
    });

    expect(screen.getByTestId('settings-body')).not.toBeNull();
  });

  it('saves multiple accounts and the pinned status-bar account', async () => {
    render(<SettingsWindow />);

    await screen.findByDisplayValue('Main');

    fireEvent.click(screen.getByRole('button', { name: /add vibe account/i }));
    fireEvent.change(screen.getByLabelText('Vibe account 2 label'), {
      target: { value: 'Backup' }
    });
    fireEvent.change(screen.getByLabelText('Vibe account 2 api key'), {
      target: { value: 'sk-backup' }
    });
    fireEvent.click(screen.getByLabelText('Pin Main to status bar'));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(writeAppConfig).toHaveBeenCalledWith({
        statusBar: { pinnedAccountId: 'vibe:main' },
        gateways: [
          {
            gatewayId: 'llm-gateway',
            accounts: [
              { accountId: 'prod', label: 'Prod', apiKey: 'sk-prod', enabled: true }
            ]
          },
          {
            gatewayId: 'vibe',
            accounts: [
              { accountId: 'main', label: 'Main', apiKey: 'sk-main', enabled: true },
              {
                accountId: 'account-2',
                label: 'Backup',
                apiKey: 'sk-backup',
                enabled: true
              }
            ]
          }
        ]
      });
    });

    await waitFor(() => {
      expect(restartDaemon).toHaveBeenCalled();
      expect(closeMock).toHaveBeenCalled();
    });
  });
});
