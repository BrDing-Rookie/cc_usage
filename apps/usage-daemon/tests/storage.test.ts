import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createStorage,
  persistCurrentSnapshots,
  readCurrentSnapshots
} from '../src/storage/memoryStore';
import { writeMaterializedState } from '../src/storage/materializedState';

describe('storage', () => {
  it('persists current snapshots and writes a materialized JSON file', () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'vibe-storage-'));
    const storage = createStorage();

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
      join(dataDir, 'var'),
      current,
      '2026-04-09T12:00:00.000Z'
    );

    const materialized = JSON.parse(
      readFileSync(join(dataDir, 'var', 'current-snapshots.json'), 'utf8')
    );

    expect(current).toHaveLength(1);
    expect(materialized.sources[0].sourceId).toBe('mininglamp');
    expect(materialized.generatedAt).toBe('2026-04-09T12:00:00.000Z');
    expect(materialized).not.toHaveProperty('historyWindow');
    expect(materialized).not.toHaveProperty('history');
  });
});
