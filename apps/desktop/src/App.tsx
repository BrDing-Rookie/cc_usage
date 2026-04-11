import type { MaterializedState } from '@vibe-monitor/shared';
import { PopoverContent } from './components/PopoverContent';
import { useSnapshots } from './hooks/useSnapshots';
import { invoke } from '@tauri-apps/api/core';
import './app.css';

type AppProps = {
  initialState?: MaterializedState;
};

export default function App({ initialState }: AppProps) {
  const state = useSnapshots(initialState);

  const mininglamp = state?.sources.find((s) => s.sourceId === 'mininglamp') ?? null;

  return (
    <main
      className="popover"
      onMouseEnter={() => invoke('popover_mouse_enter').catch(() => {})}
      onMouseLeave={() => invoke('popover_mouse_leave').catch(() => {})}
    >
      {!state ? (
        <div className="popover-loading">Loading...</div>
      ) : (
        <PopoverContent snapshot={mininglamp} />
      )}
    </main>
  );
}
