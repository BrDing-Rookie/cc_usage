import type { AlertKind, SourceSnapshot } from '@vibe-monitor/shared';

export function classifyAlert(
  snapshot: SourceSnapshot,
  staleAfterMs: number,
  now: Date
): AlertKind | null {
  if (snapshot.refreshStatus === 'auth_invalid') {
    return 'auth_invalid';
  }

  if (snapshot.refreshStatus === 'source_broken') {
    return 'source_broken';
  }

  if (snapshot.lastSuccessAt) {
    const ageMs = now.getTime() - new Date(snapshot.lastSuccessAt).getTime();
    if (ageMs > staleAfterMs) {
      return 'refresh_stale';
    }
  }

  if (snapshot.usagePercent !== null && snapshot.usagePercent >= 80) {
    return 'quota_low';
  }

  return null;
}
