import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { GATEWAY_LIST, type AppConfig, type GatewayId } from '@vibe-monitor/shared';
import {
  loadMaterializedState,
  readAppConfig,
  restartDaemon,
  writeAppConfig
} from '../api/client';
import './SettingsWindow.css';

const SETTINGS_MAX_HEIGHT = 720;
const SETTINGS_MIN_HEIGHT = 320;

type Status = 'idle' | 'saving' | 'verifying' | 'error';

const EMPTY_CONFIG: AppConfig = {
  statusBar: { pinnedAccountId: null },
  gateways: GATEWAY_LIST.map((gateway) => ({
    gatewayId: gateway.id,
    accounts: []
  }))
};

export function SettingsWindow() {
  const [config, setConfig] = useState<AppConfig>(EMPTY_CONFIG);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    readAppConfig()
      .then((loadedConfig) => {
        setConfig(normalizeConfig(loadedConfig));
      })
      .catch((error) => console.error('Failed to load config:', error));
  }, []);

  useLayoutEffect(() => {
    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      if (!settingsRef.current) {
        return;
      }

      void syncWindowHeight(settingsRef.current, () => cancelled);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [config, status, errorMsg]);

  function updateConfig(updater: (current: AppConfig) => AppConfig) {
    setConfig((current) => normalizeConfig(updater(current)));
  }

  function addAccount(gatewayId: GatewayId) {
    updateConfig((current) => ({
      ...current,
      gateways: current.gateways.map((gateway) =>
        gateway.gatewayId === gatewayId
          ? {
              ...gateway,
              accounts: [
                ...gateway.accounts,
                {
                  accountId: createAccountId(gateway.accounts),
                  label: '',
                  apiKey: '',
                  enabled: true
                }
              ]
            }
          : gateway
      )
    }));
  }

  function updateAccount(
    gatewayId: GatewayId,
    accountId: string,
    field: 'label' | 'apiKey',
    value: string
  ) {
    updateConfig((current) => ({
      ...current,
      gateways: current.gateways.map((gateway) =>
        gateway.gatewayId === gatewayId
          ? {
              ...gateway,
              accounts: gateway.accounts.map((account) =>
                account.accountId === accountId
                  ? { ...account, [field]: value }
                  : account
              )
            }
          : gateway
      )
    }));
  }

  function toggleEnabled(gatewayId: GatewayId, accountId: string) {
    updateConfig((current) => ({
      ...current,
      gateways: current.gateways.map((gateway) =>
        gateway.gatewayId === gatewayId
          ? {
              ...gateway,
              accounts: gateway.accounts.map((account) =>
                account.accountId === accountId
                  ? { ...account, enabled: !account.enabled }
                  : account
              )
            }
          : gateway
      )
    }));
  }

  function removeAccount(gatewayId: GatewayId, accountId: string) {
    updateConfig((current) => ({
      ...current,
      gateways: current.gateways.map((gateway) =>
        gateway.gatewayId === gatewayId
          ? {
              ...gateway,
              accounts: gateway.accounts.filter(
                (account) => account.accountId !== accountId
              )
            }
          : gateway
      )
    }));
  }

  function pinAccount(sourceId: string) {
    updateConfig((current) => ({
      ...current,
      statusBar: {
        pinnedAccountId: sourceId
      }
    }));
  }

  async function handleSave() {
    setStatus('saving');
    setErrorMsg('');

    const normalized = normalizeConfig(config);

    try {
      await writeAppConfig(normalized);
      await restartDaemon();
    } catch (error) {
      setErrorMsg(`Failed to save: ${error}`);
      setStatus('error');
      return;
    }

    const expectedIds = new Set(getEnabledSourceIds(normalized));
    if (!expectedIds.size) {
      await getCurrentWindow().close();
      return;
    }

    setStatus('verifying');

    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      try {
        const state = await loadMaterializedState();
        const accounts = state.accounts ?? [];
        const failedAccount = accounts.find(
          (account) =>
            expectedIds.has(account.sourceId) && account.refreshStatus !== 'ok'
        );

        if (failedAccount) {
          setErrorMsg(
            `Failed (${failedAccount.sourceId}): ${
              failedAccount.lastError ?? failedAccount.refreshStatus
            }`
          );
          setStatus('error');
          return;
        }

        const seenIds = new Set(accounts.map((account) => account.sourceId));
        if ([...expectedIds].every((sourceId) => seenIds.has(sourceId))) {
          await getCurrentWindow().close();
          return;
        }
      } catch {
        // daemon still restarting
      }

      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }

    setErrorMsg('Timeout: daemon did not return data within 15 seconds.');
    setStatus('error');
  }

  const busy = status === 'saving' || status === 'verifying';

  return (
    <div className="settings" ref={settingsRef}>
      <h2 className="settings-title">Settings</h2>

      <div className="settings-body" data-testid="settings-body">
        {GATEWAY_LIST.map((gatewayMeta) => {
          const gateway = config.gateways.find(
            (item) => item.gatewayId === gatewayMeta.id
          ) ?? {
            gatewayId: gatewayMeta.id,
            accounts: []
          };

          return (
            <section className="settings-group" key={gatewayMeta.id}>
              <div className="settings-group__header">
                <h3 className="settings-group__title">{gatewayMeta.label}</h3>
                <button
                  className="settings-add"
                  onClick={() => addAccount(gatewayMeta.id)}
                  disabled={busy}
                  type="button"
                >
                  Add {gatewayMeta.label} account
                </button>
              </div>

              {gateway.accounts.length === 0 ? (
                <div className="settings-empty">No accounts configured.</div>
              ) : (
                gateway.accounts.map((account, index) => {
                  const sourceId = `${gatewayMeta.id}:${account.accountId}`;
                  const radioLabel = `Pin ${
                    account.label || account.accountId
                  } to status bar`;

                  return (
                    <div className="settings-account" key={sourceId}>
                      <div className="settings-account__fields">
                        <label className="settings-label">
                          Label
                          <input
                            aria-label={`${gatewayMeta.label} account ${
                              index + 1
                            } label`}
                            className="settings-input"
                            disabled={busy}
                            onChange={(event) =>
                              updateAccount(
                                gatewayMeta.id,
                                account.accountId,
                                'label',
                                event.target.value
                              )
                            }
                            type="text"
                            value={account.label}
                          />
                        </label>

                        <label className="settings-label">
                          API Key
                          <input
                            aria-label={`${gatewayMeta.label} account ${
                              index + 1
                            } api key`}
                            className="settings-input"
                            disabled={busy}
                            onChange={(event) =>
                              updateAccount(
                                gatewayMeta.id,
                                account.accountId,
                                'apiKey',
                                event.target.value
                              )
                            }
                            type="password"
                            value={account.apiKey}
                          />
                        </label>
                      </div>

                      <div className="settings-account__controls">
                        <label className="settings-check">
                          <input
                            checked={account.enabled}
                            disabled={busy}
                            onChange={() =>
                              toggleEnabled(gatewayMeta.id, account.accountId)
                            }
                            type="checkbox"
                          />
                          Enabled
                        </label>

                        <label className="settings-check">
                          <input
                            aria-label={radioLabel}
                            checked={config.statusBar.pinnedAccountId === sourceId}
                            disabled={busy || !account.enabled}
                            name="pinned-account"
                            onChange={() => pinAccount(sourceId)}
                            type="radio"
                          />
                          Pin to status bar
                        </label>

                        <button
                          className="settings-remove"
                          disabled={busy}
                          onClick={() =>
                            removeAccount(gatewayMeta.id, account.accountId)
                          }
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          );
        })}
      </div>

      <div className="settings-actions">
        <button className="settings-save" onClick={handleSave} disabled={busy}>
          {status === 'idle' ? 'Save' : status === 'saving' ? 'Saving...' : 'Verifying...'}
        </button>

        {status === 'verifying' && (
          <div className="settings-loader">
            <div className="settings-spinner" />
            <span>Waiting for daemon to fetch data...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="settings-status settings-status--err">{errorMsg}</div>
        )}
      </div>
    </div>
  );
}

async function syncWindowHeight(
  element: HTMLDivElement,
  isCancelled: () => boolean
) {
  try {
    const currentWindow = getCurrentWindow();
    const [innerSize, scaleFactor] = await Promise.all([
      currentWindow.innerSize(),
      currentWindow.scaleFactor()
    ]);

    if (isCancelled()) {
      return;
    }

    const currentSize = innerSize.toLogical(scaleFactor);
    const nextHeight = Math.min(
      Math.max(element.scrollHeight, SETTINGS_MIN_HEIGHT),
      SETTINGS_MAX_HEIGHT
    );

    if (currentSize.height === nextHeight) {
      return;
    }

    await currentWindow.setSize(new LogicalSize(currentSize.width, nextHeight));
  } catch (error) {
    console.error('Failed to sync settings window size:', error);
  }
}

function normalizeConfig(raw: Partial<AppConfig> | undefined): AppConfig {
  const gateways = GATEWAY_LIST.map((gatewayMeta) => {
    const existingGateway = raw?.gateways?.find(
      (gateway) => gateway.gatewayId === gatewayMeta.id
    );

    return {
      gatewayId: gatewayMeta.id,
      accounts: (existingGateway?.accounts ?? []).map((account) => ({
        accountId: account.accountId,
        label: account.label,
        apiKey: account.apiKey,
        enabled: account.enabled ?? true
      }))
    };
  });

  const validSourceIds = getEnabledSourceIds({ gateways } as AppConfig);
  const pinnedAccountId =
    raw?.statusBar?.pinnedAccountId && validSourceIds.includes(raw.statusBar.pinnedAccountId)
      ? raw.statusBar.pinnedAccountId
      : validSourceIds[0] ?? null;

  return {
    statusBar: { pinnedAccountId },
    gateways
  };
}

function getEnabledSourceIds(config: Pick<AppConfig, 'gateways'>) {
  return config.gateways.flatMap((gateway) =>
    gateway.accounts
      .filter((account) => account.enabled)
      .map((account) => `${gateway.gatewayId}:${account.accountId}`)
  );
}

function createAccountId(accounts: Array<{ accountId: string }>) {
  let index = accounts.length + 1;
  let nextId = `account-${index}`;

  while (accounts.some((account) => account.accountId === nextId)) {
    index += 1;
    nextId = `account-${index}`;
  }

  return nextId;
}
