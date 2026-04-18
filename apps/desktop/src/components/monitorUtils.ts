export function formatUsd(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '--';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '--';
  }

  return `${Math.round(value)}%`;
}

export function formatMetricPair(
  used: number | null | undefined,
  total: number | null | undefined,
  unit: string | null | undefined
) {
  if (
    used === null ||
    used === undefined ||
    total === null ||
    total === undefined ||
    unit !== 'USD'
  ) {
    return 'Usage unavailable';
  }

  return `${formatUsd(used)} / ${formatUsd(total)}`;
}

export function getGatewayLabel(gatewayId: 'llm-gateway' | 'vibe') {
  return gatewayId === 'llm-gateway' ? 'LLM Gateway' : 'Vibe';
}

export function getGatewayStatusLabel(gateway: {
  accountCount: number;
  brokenCount: number;
  topAlertKind: string | null;
}) {
  if (gateway.accountCount === 0) {
    return 'No accounts';
  }

  if (gateway.brokenCount > 0 || gateway.topAlertKind) {
    return 'Attention';
  }

  return 'Live';
}

export function formatRefreshLabel(status: string) {
  switch (status) {
    case 'ok':
      return 'Live';
    case 'auth_invalid':
      return 'Auth invalid';
    case 'source_broken':
      return 'Source broken';
    case 'stale':
      return 'Stale';
    default:
      return status.replaceAll('_', ' ');
  }
}

export function formatCountLabel(count: number, noun: string) {
  const singular =
    noun.endsWith('s') && noun.length > 1 ? noun.slice(0, -1) : noun;
  return `${count} ${count === 1 ? singular : noun}`;
}
