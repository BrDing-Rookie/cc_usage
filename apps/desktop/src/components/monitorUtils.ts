import type { MaterializedState, QuotaWindow, SourceSnapshot } from '@vibe-monitor/shared';

type SourceTone = 'sky' | 'mint' | 'amber' | 'coral' | 'rose';

const toneCycle: SourceTone[] = ['sky', 'mint', 'amber', 'coral'];

function trimDecimal(value: string) {
  return value.replace(/\.0$/, '');
}

export function formatUsd(value: number | null | undefined) {
  const normalized = value === null || value === undefined ? 0 : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(normalized);
}

export function getDisplayName(sourceId: string) {
  switch (sourceId) {
    case 'claude-code-official':
      return 'Claude Code';
    case 'codex-official':
      return 'OpenAI Codex';
    case 'mininglamp':
      return 'mininglamp';
    default:
      return humanizeSourceLabel(sourceId);
  }
}

export function getSnapshotOrPlaceholder(state: MaterializedState, sourceId: string) {
  const found = state.sources.find((source) => source.sourceId === sourceId);
  if (found) {
    return found;
  }

  const meta =
    sourceId === 'claude-code-official'
      ? { vendorFamily: 'Anthropic', sourceKind: 'official_api' as const }
      : sourceId === 'codex-official'
        ? { vendorFamily: 'OpenAI', sourceKind: 'browser_automation' as const }
        : { vendorFamily: 'mininglamp', sourceKind: 'custom_endpoint' as const };

  return {
    sourceId,
    vendorFamily: meta.vendorFamily,
    sourceKind: meta.sourceKind,
    accountLabel: 'Not connected',
    planName: null,
    usagePercent: null,
    usedAmount: null,
    totalAmount: null,
    amountUnit: null,
    resetAt: null,
    refreshStatus: 'auth_invalid' as const,
    lastSuccessAt: null,
    lastError: 'missing local state',
    alertKind: null,
    capabilities: {
      percent: false,
      absoluteAmount: false,
      resetTime: false,
      planName: false,
      healthSignal: true
    },
    windows: []
  };
}

export function getProgressPercent(source: SourceSnapshot) {
  if (source.usagePercent !== null) {
    return Math.max(0, Math.min(100, Math.round(source.usagePercent)));
  }

  if (source.usedAmount !== null && source.totalAmount !== null && source.totalAmount > 0) {
    return Math.max(0, Math.min(100, Math.round((source.usedAmount / source.totalAmount) * 100)));
  }

  return 0;
}

export function formatCompactNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const absolute = Math.abs(value);

  if (absolute >= 1_000_000) {
    return `${trimDecimal((value / 1_000_000).toFixed(1))}m`;
  }

  if (absolute >= 1_000) {
    return `${trimDecimal((value / 1_000).toFixed(1))}k`;
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0
  }).format(value);
}

export function humanizeSourceLabel(sourceId: string) {
  return sourceId
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (token) => token.toUpperCase())
    .replace(/\bApi\b/g, 'API')
    .replace(/\bCli\b/g, 'CLI')
    .replace(/\bUrl\b/g, 'URL');
}

export function getSourceLabel(source: SourceSnapshot) {
  return humanizeSourceLabel(source.sourceId);
}

export function getSourceTone(source: SourceSnapshot, index: number): SourceTone {
  if (source.alertKind === 'quota_low') {
    return 'amber';
  }

  if (source.refreshStatus !== 'ok' || source.alertKind !== null) {
    return 'rose';
  }

  return toneCycle[index % toneCycle.length];
}

export function getSourceProgress(source: SourceSnapshot) {
  if (source.usagePercent !== null) {
    return Math.max(0, Math.min(100, Math.round(source.usagePercent)));
  }

  if (source.usedAmount !== null && source.totalAmount !== null && source.totalAmount > 0) {
    return Math.max(0, Math.min(100, Math.round((source.usedAmount / source.totalAmount) * 100)));
  }

  return 0;
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '--';
  }

  return `${Math.round(value)}%`;
}

export function formatUsageCaption(source: SourceSnapshot) {
  const compactValue = formatCompactNumber(source.usedAmount);

  if (compactValue && source.amountUnit) {
    return `${compactValue} ${source.amountUnit} today`;
  }

  if (compactValue) {
    return `${compactValue} used today`;
  }

  if (source.usagePercent !== null) {
    return `${Math.round(source.usagePercent)}% of plan used`;
  }

  return 'Usage pending';
}

export function formatAbsoluteUsage(
  usedAmount: number | null,
  totalAmount: number | null,
  unit: string | null
) {
  if (usedAmount === null || totalAmount === null) {
    return 'Absolute quota unavailable';
  }

  const used = formatCompactNumber(usedAmount) ?? '0';
  const total = formatCompactNumber(totalAmount) ?? '0';
  const suffix = unit ? ` ${unit}` : '';
  return `${used} / ${total}${suffix}`;
}

export function getDisplayWindows(source: SourceSnapshot): QuotaWindow[] {
  if (source.windows.length > 0) {
    return source.windows;
  }

  return [
    {
      key: `${source.sourceId}-overall`,
      label: source.planName ?? 'Overall usage',
      percent: source.usagePercent,
      usedAmount: source.usedAmount,
      totalAmount: source.totalAmount,
      unit: source.amountUnit,
      resetAt: source.resetAt
    }
  ];
}

export function getOrderedSources(state: MaterializedState) {
  return [...state.sources].sort((left, right) => {
    const leftPriority = Number(left.alertKind !== null || left.refreshStatus !== 'ok');
    const rightPriority = Number(right.alertKind !== null || right.refreshStatus !== 'ok');

    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    return getSourceProgress(right) - getSourceProgress(left);
  });
}

export function getAggregateUsedAmount(state: MaterializedState) {
  const amounts = state.sources
    .map((source) => source.usedAmount)
    .filter((amount): amount is number => amount !== null);

  if (amounts.length === 0) {
    return null;
  }

  return amounts.reduce((sum, amount) => sum + amount, 0);
}

export function getAggregateUnit(state: MaterializedState) {
  const units = new Set(
    state.sources
      .map((source) => source.amountUnit)
      .filter((unit): unit is string => unit !== null && unit.length > 0)
  );

  if (units.size !== 1) {
    return 'usage';
  }

  return [...units][0];
}

export function getAggregatePercent(state: MaterializedState) {
  const absoluteSources = state.sources.filter(
    (source): source is SourceSnapshot & { usedAmount: number; totalAmount: number } =>
      source.usedAmount !== null && source.totalAmount !== null && source.totalAmount > 0
  );

  if (absoluteSources.length > 0) {
    const totals = absoluteSources.reduce(
      (sum, source) => {
        sum.used += source.usedAmount;
        sum.total += source.totalAmount;
        return sum;
      },
      { used: 0, total: 0 }
    );

    return Math.max(0, Math.min(100, Math.round((totals.used / totals.total) * 100)));
  }

  const percents = state.sources
    .map((source) => source.usagePercent)
    .filter((value): value is number => value !== null);

  if (percents.length === 0) {
    return 0;
  }

  return Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length);
}

export function getHealthCounts(state: MaterializedState) {
  return state.sources.reduce(
    (counts, source) => {
      if (source.refreshStatus === 'ok' && source.alertKind === null) {
        counts.healthy += 1;
      } else if (source.refreshStatus === 'stale') {
        counts.stale += 1;
      } else {
        counts.attention += 1;
      }

      return counts;
    },
    { healthy: 0, stale: 0, attention: 0 }
  );
}

export function getLatestSuccessAt(state: MaterializedState) {
  const timestamps = state.sources
    .map((source) => source.lastSuccessAt)
    .filter((value): value is string => value !== null)
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

export function formatTimeLabel(value: string | null) {
  if (!value) {
    return 'Waiting for first refresh';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

export function getInitials(label: string) {
  return label
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
