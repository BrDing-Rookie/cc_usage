import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  openStorage,
  persistCurrentSnapshots,
  readCurrentSnapshots
} from '../src/storage/db';
import { writeMaterializedState } from '../src/storage/materializedState';

describe('storage', () => {
  it('persists current snapshots and writes a materialized JSON file', () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'vibe-storage-'));
    const storage = openStorage(dataDir);

    persistCurrentSnapshots(storage, [
      {
        sourceId: 'claude-code-official',
        vendorFamily: 'Anthropic',
        sourceKind: 'official_api',
        accountLabel: 'Personal',
        planName: 'Pro',
        usagePercent: 68,
        usedAmount: null,
        totalAmount: null,
        amountUnit: null,
        resetAt: '2026-04-09T14:00:00.000Z',
        refreshStatus: 'ok',
        lastSuccessAt: '2026-04-09T11:55:00.000Z',
        lastError: null,
        alertKind: null,
        capabilities: {
          percent: true,
          absoluteAmount: false,
          resetTime: true,
          planName: true,
          healthSignal: true
        },
        windows: []
      }
    ]);

    const current = readCurrentSnapshots(storage);
    writeMaterializedState(dataDir, current, '2026-04-09T12:00:00.000Z');

    const materialized = JSON.parse(
      readFileSync(join(dataDir, 'current-snapshots.json'), 'utf8')
    );

    expect(current).toHaveLength(1);
    expect(materialized.sources[0].sourceId).toBe('claude-code-official');
  });
});
