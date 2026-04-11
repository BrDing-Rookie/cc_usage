import { useEffect, useState } from 'react';
import { readAppConfig, writeAppConfig, restartDaemon } from '../api/client';

export function SettingsWindow() {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    readAppConfig()
      .then((config) => {
        setBaseUrl(config.baseUrl ?? '');
        setApiKey(config.apiKey ?? '');
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setStatus('saving');
    try {
      await writeAppConfig({ baseUrl, apiKey });
      await restartDaemon();
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

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
        />
      </label>

      <button
        className="settings-save"
        onClick={handleSave}
        disabled={status === 'saving'}
      >
        {status === 'saving' ? 'Saving...' : 'Save'}
      </button>

      {status === 'saved' && (
        <div className="settings-status settings-status--ok">Saved. Daemon restarted.</div>
      )}
      {status === 'error' && (
        <div className="settings-status settings-status--err">Failed to save.</div>
      )}
    </div>
  );
}
