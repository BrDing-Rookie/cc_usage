import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { readAppConfig, writeAppConfig, restartDaemon, loadMaterializedState } from '../api/client';

type Status = 'idle' | 'saving' | 'verifying' | 'error';

export function SettingsWindow() {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    readAppConfig()
      .then((config) => {
        setBaseUrl(config.mininglamp?.baseUrl ?? '');
        setApiKey(config.mininglamp?.apiKey ?? '');
      })
      .catch((e) => console.error('Failed to load config:', e));
  }, []);

  async function handleSave() {
    setStatus('saving');
    setErrorMsg('');
    try {
      await writeAppConfig({ mininglamp: { baseUrl, apiKey } });
      await restartDaemon();
    } catch (e) {
      setErrorMsg(`Failed to save: ${e}`);
      setStatus('error');
      return;
    }

    setStatus('verifying');

    // Wait a bit for daemon to initialize before polling
    await new Promise((r) => setTimeout(r, 2000));

    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try {
        const state = await loadMaterializedState();
        const source = state.sources?.find((s: { sourceId: string }) => s.sourceId === 'mininglamp');
        if (source) {
          if (source.refreshStatus === 'ok') {
            await getCurrentWindow().close();
            return;
          }
          // Got a source but with error status
          const detail = source.lastError ?? source.refreshStatus;
          setErrorMsg(`Failed: ${detail}`);
          setStatus('error');
          return;
        }
      } catch {
        // daemon still starting, keep polling
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    setErrorMsg('Timeout: daemon did not return data within 10 seconds.');
    setStatus('error');
  }

  const busy = status === 'saving' || status === 'verifying';

  return (
    <div className="settings">
      <h2 className="settings-title">Settings</h2>

      <label className="settings-label">
        Base URL
        <input
          className="settings-input"
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com"
          disabled={busy}
        />
      </label>

      <label className="settings-label">
        API Key
        <input
          className="settings-input"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter API key"
          disabled={busy}
        />
      </label>

      <button
        className="settings-save"
        onClick={handleSave}
        disabled={busy}
      >
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
