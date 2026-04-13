import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { GATEWAY_LIST, type GatewayId } from '@vibe-monitor/shared';
import { readAppConfig, writeAppConfig, restartDaemon, loadMaterializedState } from '../api/client';

type Status = 'idle' | 'saving' | 'verifying' | 'error';

export function SettingsWindow() {
  const [activeGateway, setActiveGateway] = useState<GatewayId>('llm-gateway');
  const [apiKeys, setApiKeys] = useState<Record<GatewayId, string>>({
    'llm-gateway': '',
    vibe: '',
  });
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    readAppConfig()
      .then((config) => {
        setActiveGateway(config.activeGateway ?? 'llm-gateway');
        setApiKeys({
          'llm-gateway': config['llm-gateway']?.apiKey ?? '',
          vibe: config.vibe?.apiKey ?? '',
        });
      })
      .catch((e) => console.error('Failed to load config:', e));
  }, []);

  function handleKeyChange(value: string) {
    setApiKeys((prev) => ({ ...prev, [activeGateway]: value }));
  }

  async function handleSave() {
    setStatus('saving');
    setErrorMsg('');

    const config: Record<string, unknown> = { activeGateway };
    if (apiKeys['llm-gateway']) {
      config['llm-gateway'] = { apiKey: apiKeys['llm-gateway'] };
    }
    if (apiKeys.vibe) {
      config.vibe = { apiKey: apiKeys.vibe };
    }

    const activeKey = apiKeys[activeGateway];

    try {
      await writeAppConfig(config);
      await restartDaemon();
    } catch (e) {
      setErrorMsg(`Failed to save: ${e}`);
      setStatus('error');
      return;
    }

    if (!activeKey) {
      await getCurrentWindow().close();
      return;
    }

    setStatus('verifying');
    await new Promise((r) => setTimeout(r, 2000));

    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      try {
        const state = await loadMaterializedState();
        const source = (state.sources ?? []).find(
          (s: { sourceId: string }) => s.sourceId === activeGateway,
        );

        if (source) {
          if (source.refreshStatus !== 'ok') {
            const detail = source.lastError ?? source.refreshStatus;
            setErrorMsg(`Failed (${source.sourceId}): ${detail}`);
            setStatus('error');
            return;
          }
          await getCurrentWindow().close();
          return;
        }
      } catch {
        // daemon still starting
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    setErrorMsg('Timeout: daemon did not return data within 15 seconds.');
    setStatus('error');
  }

  const busy = status === 'saving' || status === 'verifying';

  return (
    <div className="settings">
      <h2 className="settings-title">Settings</h2>

      <div className="settings-label">Select Gateway</div>
      <div className="settings-tabs">
        {GATEWAY_LIST.map((gw) => (
          <button
            key={gw.id}
            className={`settings-tab${gw.id === activeGateway ? ' settings-tab--active' : ''}`}
            onClick={() => setActiveGateway(gw.id)}
            disabled={busy}
          >
            {gw.label}
          </button>
        ))}
      </div>

      <label className="settings-label">
        API Key
        <input
          className="settings-input"
          type="password"
          value={apiKeys[activeGateway]}
          onChange={(e) => handleKeyChange(e.target.value)}
          placeholder="Enter API key"
          disabled={busy}
        />
      </label>

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
  );
}
