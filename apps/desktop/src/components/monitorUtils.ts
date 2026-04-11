export function formatUsd(value: number | null | undefined) {
  const normalized = value === null || value === undefined ? 0 : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(normalized);
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '--';
  }

  return `${Math.round(value)}%`;
}
