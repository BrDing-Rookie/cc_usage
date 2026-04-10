import Database from 'better-sqlite3';
import type { SourceSnapshot } from '@vibe-monitor/shared';
import { resolveDataFile } from '../config';

export type Storage = {
  db: Database.Database;
};

export function openStorage(cwd: string): Storage {
  const db = new Database(resolveDataFile(cwd));
  db.exec(`
    CREATE TABLE IF NOT EXISTS current_sources (
      source_id TEXT PRIMARY KEY,
      snapshot_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      refresh_status TEXT NOT NULL,
      error_text TEXT,
      recorded_at TEXT NOT NULL,
      snapshot_json TEXT NOT NULL
    );
  `);

  return { db };
}

export function persistCurrentSnapshots(
  storage: Storage,
  snapshots: SourceSnapshot[]
): void {
  const upsert = storage.db.prepare(`
    INSERT INTO current_sources (source_id, snapshot_json, updated_at)
    VALUES (@sourceId, @snapshotJson, @updatedAt)
    ON CONFLICT(source_id) DO UPDATE SET
      snapshot_json = excluded.snapshot_json,
      updated_at = excluded.updated_at
  `);

  const appendHistory = storage.db.prepare(`
    INSERT INTO refresh_history (source_id, refresh_status, error_text, recorded_at, snapshot_json)
    VALUES (@sourceId, @refreshStatus, @errorText, @recordedAt, @snapshotJson)
  `);

  const tx = storage.db.transaction((batch: SourceSnapshot[]) => {
    for (const snapshot of batch) {
      const snapshotJson = JSON.stringify(snapshot);
      const recordedAt = snapshot.lastSuccessAt ?? new Date().toISOString();

      upsert.run({
        sourceId: snapshot.sourceId,
        snapshotJson,
        updatedAt: recordedAt
      });

      appendHistory.run({
        sourceId: snapshot.sourceId,
        refreshStatus: snapshot.refreshStatus,
        errorText: snapshot.lastError,
        recordedAt,
        snapshotJson
      });
    }
  });

  tx(snapshots);
}

export function readCurrentSnapshots(storage: Storage): SourceSnapshot[] {
  const rows = storage.db
    .prepare('SELECT snapshot_json FROM current_sources ORDER BY source_id')
    .all() as Array<{ snapshot_json: string }>;

  return rows.map((row) => JSON.parse(row.snapshot_json) as SourceSnapshot);
}

export function readRecentHistory(
  storage: Storage,
  sinceIso: string
): Array<{
  sourceId: string;
  recordedAt: string;
  snapshot: SourceSnapshot;
}> {
  const rows = storage.db
    .prepare(
      `
        SELECT source_id, recorded_at, snapshot_json
        FROM refresh_history
        WHERE recorded_at >= ?
        ORDER BY recorded_at ASC
      `
    )
    .all(sinceIso) as Array<{
    source_id: string;
    recorded_at: string;
    snapshot_json: string;
  }>;

  return rows.map((row) => ({
    sourceId: row.source_id,
    recordedAt: row.recorded_at,
    snapshot: JSON.parse(row.snapshot_json) as SourceSnapshot
  }));
}
