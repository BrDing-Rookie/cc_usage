import { useState } from 'react';
import type { MaterializedState } from '@vibe-monitor/shared';
import { AlertStrip } from './components/AlertStrip';
import { CalmPanel } from './components/CalmPanel';
import { ExpandedPanel } from './components/ExpandedPanel';
import { useSnapshots } from './hooks/useSnapshots';
import './app.css';

type AppProps = {
  initialState?: MaterializedState;
};

export default function App({ initialState }: AppProps) {
  const state = useSnapshots(initialState);
  const [expanded, setExpanded] = useState(false);

  if (!state) {
    return <div className="panel calm">Loading…</div>;
  }

  return (
    <main
      className="shell"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <AlertStrip state={state} />
      <CalmPanel state={state} />
      {expanded ? <ExpandedPanel state={state} /> : null}
    </main>
  );
}
