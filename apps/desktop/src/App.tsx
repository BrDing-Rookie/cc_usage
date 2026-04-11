import type { MaterializedState } from '@vibe-monitor/shared';
import { PopoverContent } from './components/PopoverContent';
import { SettingsWindow } from './components/SettingsWindow';
import { useSnapshots } from './hooks/useSnapshots';
import { invoke } from '@tauri-apps/api/core';
import './app.css';

type AppProps = {
  initialState?: MaterializedState;
};

const isSettingsView = window.location.search.includes('view=settings');

export default function App({ initialState }: AppProps) {
  if (isSettingsView) {
    return <SettingsWindow />;
  }

  const state = useSnapshots(initialState);

  const topSource = state?.sources[0] ?? null;

  return (
    <main
      className="popover"
      onMouseEnter={() => invoke('popover_mouse_enter').catch(() => {})}
      onMouseLeave={() => invoke('popover_mouse_leave').catch(() => {})}
    >
      {!state ? (
        <div className="popover-loading">Loading...</div>
      ) : (
        <PopoverContent snapshot={topSource} />
      )}
    </main>
  );
}
