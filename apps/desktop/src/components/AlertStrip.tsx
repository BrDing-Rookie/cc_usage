import type { MaterializedState } from '@vibe-monitor/shared';

export function AlertStrip({ state }: { state: MaterializedState }) {
  const alerting = state.sources.filter((source) => source.alertKind !== null);

  if (alerting.length === 0) {
    return null;
  }

  return (
    <div className="alert-strip">
      <span>Attention Needed</span>
      <span>{alerting.map((source) => source.sourceId).join(', ')}</span>
    </div>
  );
}
