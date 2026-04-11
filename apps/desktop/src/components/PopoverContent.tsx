import type { SourceSnapshot } from '@vibe-monitor/shared';
import { formatPercent, formatUsd } from './monitorUtils';

type PopoverContentProps = {
  snapshot: SourceSnapshot | null;
};

export function PopoverContent({ snapshot }: PopoverContentProps) {
  if (!snapshot) {
    return <div className="popover-empty">No data available</div>;
  }

  const percent = snapshot.usagePercent ?? 0;
  const isWarning = percent > 80;

  return (
    <div className={`popover-card${isWarning ? ' popover-card--warning' : ''}`}>
      <div className="popover-header">
        <span className="popover-source">mininglamp</span>
        <span className={`popover-percent${isWarning ? ' text-red' : ''}`}>
          {formatPercent(snapshot.usagePercent)}
        </span>
      </div>
      <div className="popover-metrics">
        <div className="popover-metric">
          <span className="popover-metric__label">Used</span>
          <strong>{formatUsd(snapshot.usedAmount)}</strong>
        </div>
        <div className="popover-metric">
          <span className="popover-metric__label">Quota</span>
          <strong>{formatUsd(snapshot.totalAmount)}</strong>
        </div>
      </div>
      {snapshot.refreshStatus !== 'ok' && (
        <div className="popover-status">
          Status: {snapshot.refreshStatus}
        </div>
      )}
    </div>
  );
}
