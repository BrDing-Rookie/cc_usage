import type { MaterializedState, SourceSnapshot } from '@vibe-monitor/shared';
import {
  formatPercent,
  formatUsd,
  getDisplayName,
  getProgressPercent,
  getSnapshotOrPlaceholder
} from './monitorUtils';

const orderedSourceIds = ['claude-code-official', 'codex-official', 'mininglamp'] as const;

export function CompactStrip({ state }: { state: MaterializedState }) {
  const sources: SourceSnapshot[] = orderedSourceIds.map((sourceId) =>
    getSnapshotOrPlaceholder(state, sourceId)
  );

  return (
    <div className="compact-strip" aria-label="Usage monitor">
      {sources.map((source) => {
        const progress = getProgressPercent(source);
        const label = getDisplayName(source.sourceId);
        const primary =
          source.sourceId === 'mininglamp'
            ? formatUsd(source.usedAmount)
            : formatPercent(source.usagePercent);

        return (
          <article key={source.sourceId} className="compact-tile">
            <header className="compact-tile__head">
              <span className="compact-tile__label">{label}</span>
              <strong className="compact-tile__value">{primary}</strong>
            </header>
            <div className="compact-tile__meter" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </div>
            <span className="compact-tile__percent">{formatPercent(progress)}</span>
          </article>
        );
      })}
    </div>
  );
}

