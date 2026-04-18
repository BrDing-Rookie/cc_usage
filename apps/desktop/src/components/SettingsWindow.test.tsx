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
    vi.mocked(getCurrentWindow).mockReturnValue({
      close: closeMock
    } as never);
    vi.mocked(readAppConfig).mockResolvedValue(initialConfig);
    vi.mocked(writeAppConfig).mockResolvedValue(undefined);
    vi.mocked(restartDaemon).mockResolvedValue(undefined);
    vi.mocked(loadMaterializedState).mockResolvedValue(materializedState);
  });

  afterEach(() => cleanup());

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
