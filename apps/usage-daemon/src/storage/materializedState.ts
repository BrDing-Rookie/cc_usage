import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SourceSnapshot } from '@vibe-monitor/shared';

export function writeMaterializedState(
  dataDir: string,
  snapshots: SourceSnapshot[],
  generatedAt: string = new Date().toISOString()
): void {
  mkdirSync(dataDir, { recursive: true });
  const target = join(dataDir, 'current-snapshots.json');
  const tmp = join(dataDir, 'current-snapshots.json.tmp');
  writeFileSync(tmp, JSON.stringify({ generatedAt, sources: snapshots }, null, 2), 'utf8');
  renameSync(tmp, target);
}
