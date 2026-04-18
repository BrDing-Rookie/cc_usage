import type { MaterializedState } from '@vibe-monitor/shared';
import { PopoverContent } from './components/PopoverContent';
import { SettingsWindow } from './components/SettingsWindow';
import { useSnapshots } from './hooks/useSnapshots';
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

  return (
    <main className="popover">
      {!state ? (
        <div className="popover-loading">Loading...</div>
      ) : (
        <PopoverContent state={state} />
      )}
    </main>
  );
}
