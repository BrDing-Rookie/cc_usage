import process from 'node:process';
import { fileURLToPath } from 'node:url';
import type { SourceAdapter } from './adapters/types';
import { buildDefaultAdapters } from './defaultAdapters';
import { runRefreshCycle } from './refreshLoop';
import { openStorage, persistCurrentSnapshots, readCurrentSnapshots } from './storage/db';
import { writeMaterializedState } from './storage/materializedState';

export async function runOnce(
  runtimeDir: string,
  adapters: SourceAdapter[],
  now: () => Date = () => new Date()
) {
  const storage = openStorage(runtimeDir);

  try {
    const current = new Map(
      readCurrentSnapshots(storage).map((snapshot) => [snapshot.sourceId, snapshot])
    );
    const result = await runRefreshCycle(adapters, current, { now });

    persistCurrentSnapshots(storage, result.snapshots);
    writeMaterializedState(storage, `${runtimeDir}/var`, result.snapshots, now().toISOString());
    return result.snapshots;
  } finally {
    storage.db.close();
  }
}

async function main() {
  const runtimeDir = process.env.VIBE_MONITOR_RUNTIME_DIR ?? process.cwd();
  const adapters: SourceAdapter[] = buildDefaultAdapters(runtimeDir);

  await runOnce(runtimeDir, adapters);
  setInterval(() => {
    void runOnce(runtimeDir, adapters);
  }, 5 * 60_000);
}

function isDirectExecution(metaUrl: string): boolean {
  if (process.env.VITEST) {
    return false;
  }

  const entrypoint = process.argv[1];

  if (typeof entrypoint !== 'string') {
    return true;
  }

  return fileURLToPath(metaUrl) === entrypoint;
}

if (isDirectExecution(import.meta.url)) {
  void main();
}
