import type { MaterializedHistoryPoint, MaterializedState } from '@vibe-monitor/shared';
import { Sparkline } from './charts/Sparkline';
import {
  formatPercent,
  formatUsd,
  getDisplayName,
  getSnapshotOrPlaceholder
} from './monitorUtils';

function pickHistory(
  state: MaterializedState,
  sourceId: string,
  kind: MaterializedHistoryPoint['kind']
) {
  return (state.history?.[sourceId] ?? []).filter((point) => point.kind === kind);
}

export function ExpandedMonitor({
  state,
  onClose
}: {
  state: MaterializedState;
  onClose: () => void;
}) {
  const claude = getSnapshotOrPlaceholder(state, 'claude-code-official');
  const codex = getSnapshotOrPlaceholder(state, 'codex-official');
  const mininglamp = getSnapshotOrPlaceholder(state, 'mininglamp');

  return (
    <section className="expanded-monitor" role="region" aria-label="Expanded usage monitor">
      <header className="expanded-monitor__head">
        <div>
          <h1>Usage Monitor</h1>
          <p className="expanded-monitor__sub">Last 5 hours</p>
        </div>
        <button type="button" className="expanded-monitor__close" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="expanded-monitor__cards">
        <article className="monitor-card">
          <header className="monitor-card__head">
            <h2>{getDisplayName(claude.sourceId)}</h2>
            <strong>{formatPercent(claude.usagePercent)}</strong>
          </header>
          <Sparkline points={pickHistory(state, 'claude-code-official', 'percent')} />
        </article>

        <article className="monitor-card">
          <header className="monitor-card__head">
            <h2>{getDisplayName(codex.sourceId)}</h2>
            <strong>{formatPercent(codex.usagePercent)}</strong>
          </header>
          <Sparkline points={pickHistory(state, 'codex-official', 'percent')} />
        </article>

        <article className="monitor-card mininglamp-card">
          <header className="monitor-card__head">
            <h2>{getDisplayName(mininglamp.sourceId)}</h2>
            <strong>{formatPercent(mininglamp.usagePercent)}</strong>
          </header>
          <div className="metric-grid">
            <article>
              <span>Today usage</span>
              <strong>{formatUsd(mininglamp.usedAmount)}</strong>
            </article>
            <article>
              <span>Current quota</span>
              <strong>{formatUsd(mininglamp.totalAmount)}</strong>
            </article>
          </div>
        </article>
      </div>
    </section>
  );
}

