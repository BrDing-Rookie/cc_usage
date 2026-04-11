import type { SourceSnapshot } from '@vibe-monitor/shared';

export type Storage = {
  snapshots: Map<string, SourceSnapshot>;
};

export function createStorage(): Storage {
  return { snapshots: new Map() };
}

export function persistCurrentSnapshots(
  storage: Storage,
  snapshots: SourceSnapshot[]
): void {
  for (const snapshot of snapshots) {
    storage.snapshots.set(snapshot.sourceId, snapshot);
  }
}

export function readCurrentSnapshots(storage: Storage): SourceSnapshot[] {
  return Array.from(storage.snapshots.values());
}
