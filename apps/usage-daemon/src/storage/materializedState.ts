import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MaterializedHistoryPoint, SourceSnapshot } from '@vibe-monitor/shared';
import type { Storage } from './db';
import { readRecentHistory } from './db';

function buildHistorySeries(
  rows: Array<{
    sourceId: string;
    recordedAt: string;
    snapshot: SourceSnapshot;
  }>
): Record<string, MaterializedHistoryPoint[]> {
  const history: Record<string, MaterializedHistoryPoint[]> = {};

  for (const row of rows) {
    const isMininglamp = row.sourceId === 'mininglamp';
    const rawValue = isMininglamp ? row.snapshot.usedAmount : row.snapshot.usagePercent;

    if (rawValue === null || rawValue === undefined) {
      continue;
    }

    const point: MaterializedHistoryPoint = {
      recordedAt: row.recordedAt,
      value: rawValue,
      kind: isMininglamp ? 'usd' : 'percent'
    };

    history[row.sourceId] ??= [];
    history[row.sourceId].push(point);
  }

  return history;
}

export function writeMaterializedState(
  storage: Storage,
  dataDir: string,
  snapshots: SourceSnapshot[],
  generatedAt: string = new Date().toISOString()
): void {
  const sinceIso = new Date(Date.parse(generatedAt) - 5 * 60 * 60_000).toISOString();
  const historyRows = readRecentHistory(storage, sinceIso);
  const history = buildHistorySeries(historyRows);

  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    join(dataDir, 'current-snapshots.json'),
    JSON.stringify(
      {
        generatedAt,
        historyWindow: 'last_5_hours',
        sources: snapshots,
        history
      },
      null,
      2
    ),
    'utf8'
  );
}
