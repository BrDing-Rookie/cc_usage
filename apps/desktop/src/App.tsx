import { useState } from 'react';
import type { MaterializedState } from '@vibe-monitor/shared';
import { CompactStrip } from './components/CompactStrip';
import { ExpandedMonitor } from './components/ExpandedMonitor';
import { useSnapshots } from './hooks/useSnapshots';
import './app.css';

type AppProps = {
  initialState?: MaterializedState;
};

export default function App({ initialState }: AppProps) {
  const state = useSnapshots(initialState);
  const [expanded, setExpanded] = useState(false);

  if (!state) {
    return <div className="panel loading-state">Loading...</div>;
  }

  return (
    <main className={`shell${expanded ? ' is-expanded' : ''}`}>
      <button
        type="button"
        className="monitor-trigger"
        aria-label="Usage monitor"
        onClick={() => setExpanded((current) => !current)}
      >
        <CompactStrip state={state} />
      </button>
      {expanded ? <ExpandedMonitor state={state} onClose={() => setExpanded(false)} /> : null}
    </main>
  );
}
