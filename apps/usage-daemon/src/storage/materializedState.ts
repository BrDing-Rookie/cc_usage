import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SourceSnapshot } from '@vibe-monitor/shared';

export function writeMaterializedState(
  dataDir: string,
  snapshots: SourceSnapshot[],
  generatedAt: string = new Date().toISOString()
): void {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    join(dataDir, 'current-snapshots.json'),
    JSON.stringify(
      {
        generatedAt,
        sources: snapshots
      },
      null,
      2
    ),
    'utf8'
  );
}
