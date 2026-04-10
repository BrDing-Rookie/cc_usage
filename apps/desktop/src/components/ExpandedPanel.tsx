import type { MaterializedState } from '@vibe-monitor/shared';

export function ExpandedPanel({ state }: { state: MaterializedState }) {
  return (
    <div className="panel expanded">
      {state.sources.map((source) => (
        <article key={source.sourceId} className="source-card">
          <header>
            <strong>{source.sourceId}</strong>
            <span>{source.usagePercent === null ? '--' : `${source.usagePercent}%`}</span>
          </header>
          <p>{source.planName ?? 'Unknown plan'}</p>
          <p>
            {source.usedAmount === null || source.totalAmount === null
              ? 'absolute quota unavailable'
              : `${source.usedAmount} / ${source.totalAmount} ${source.amountUnit ?? ''}`.trim()}
          </p>
        </article>
      ))}
    </div>
  );
}
