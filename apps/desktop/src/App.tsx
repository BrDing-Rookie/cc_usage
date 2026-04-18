import { useEffect, useState } from 'react';
import type { MaterializedState } from '@vibe-monitor/shared';
import { PopoverContent } from './components/PopoverContent';
import { SettingsWindow } from './components/SettingsWindow';
import { readAppConfig } from './api/client';
import { useSnapshots } from './hooks/useSnapshots';
import './app.css';

type AppProps = {
  initialState?: MaterializedState;
};

const isSettingsView = window.location.search.includes('view=settings');

export default function App({ initialState }: AppProps) {
  const [pinnedAccountId, setPinnedAccountId] = useState<string | null>(null);

  useEffect(() => {
    readAppConfig()
      .then((config) => setPinnedAccountId(config.statusBar?.pinnedAccountId ?? null))
      .catch(() => setPinnedAccountId(null));
  }, []);

  if (isSettingsView) {
    return <SettingsWindow />;
  }

  const state = useSnapshots(initialState);

  return (
    <main className="popover">
      {!state ? (
        <div className="popover-loading">Loading...</div>
      ) : (
        <PopoverContent pinnedAccountId={pinnedAccountId} state={state} />
      )}
    </main>
  );
}
