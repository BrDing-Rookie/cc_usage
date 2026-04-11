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
        sourceId: 'mininglamp',
        vendorFamily: 'mininglamp',
        sourceKind: 'custom_endpoint',
        accountLabel: 'mininglamp',
        planName: null,
        usagePercent: 11.96,
        usedAmount: 59.81,
        totalAmount: 500,
        amountUnit: 'USD',
        resetAt: null,
        refreshStatus: 'ok',
        lastSuccessAt: '2026-04-09T11:55:00.000Z',
        lastError: null,
        alertKind: null,
        capabilities: {
          percent: true,
          absoluteAmount: true,
          resetTime: false,
          planName: false,
          healthSignal: true
        },
        windows: []
      }
    ]);

    const current = readCurrentSnapshots(storage);
    writeMaterializedState(
      storage,
      join(dataDir, 'var'),
      current,
      '2026-04-09T12:00:00.000Z'
    );

    const materialized = JSON.parse(
      readFileSync(join(dataDir, 'var', 'current-snapshots.json'), 'utf8')
    );

    expect(current).toHaveLength(1);
    expect(materialized.sources[0].sourceId).toBe('mininglamp');
    expect(materialized.historyWindow).toBe('last_5_hours');
    expect(materialized.history['mininglamp'][0].kind).toBe('usd');
  });
});
