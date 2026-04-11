import process from 'node:process';
import { fileURLToPath } from 'node:url';
import type { SourceAdapter } from './adapters/types';
import { buildDefaultAdapters } from './defaultAdapters';
import { runRefreshCycle } from './refreshLoop';
import {
  createStorage,
  persistCurrentSnapshots,
  readCurrentSnapshots,
  type Storage
} from './storage/memoryStore';
import { writeMaterializedState } from './storage/materializedState';

export async function runOnce(
  runtimeDir: string,
  adapters: SourceAdapter[],
  storage: Storage,
  now: () => Date = () => new Date(),
) {
  const current = new Map(
    readCurrentSnapshots(storage).map((snapshot) => [snapshot.sourceId, snapshot])
  );
  const result = await runRefreshCycle(adapters, current, { now });

  persistCurrentSnapshots(storage, result.snapshots);
  writeMaterializedState(`${runtimeDir}/var`, result.snapshots, now().toISOString());
  return result.snapshots;
}

async function main() {
  const runtimeDir = process.env.VIBE_MONITOR_RUNTIME_DIR ?? process.cwd();
  const adapters: SourceAdapter[] = buildDefaultAdapters(runtimeDir);
  const storage = createStorage();

  await runOnce(runtimeDir, adapters, storage);
  setInterval(() => {
    void runOnce(runtimeDir, adapters, storage);
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
