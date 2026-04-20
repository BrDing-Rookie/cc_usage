import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SourceAdapter } from '../src/adapters/types';
import { runOnce } from '../src/index';
import { createStorage } from '../src/storage/memoryStore';

async function waitForFile(filePath: string, child: ReturnType<typeof spawn>) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5_000) {
    if (existsSync(filePath)) {
      return;
    }

    if (child.exitCode !== null) {
      throw new Error(`daemon exited before writing ${filePath}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`timed out waiting for ${filePath}`);
}

describe('daemon end-to-end', () => {
  it('writes a materialized state file from a refresh cycle', async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'vibe-e2e-'));
    const adapters: SourceAdapter[] = [
      {
        sourceId: 'mininglamp',
        sourceKind: 'custom_endpoint',
        vendorFamily: 'mininglamp',
        async refresh() {
          return {
            ok: true,
            snapshot: {
              sourceId: 'mininglamp',
              vendorFamily: 'mininglamp',
              sourceKind: 'custom_endpoint',
              accountLabel: 'mininglamp',
              planName: null,
              usagePercent: 42,
              usedAmount: 210,
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
          };
        }
      }
    ];

    await runOnce(runtimeDir, adapters, createStorage(), () => new Date('2026-04-09T12:00:00.000Z'));

    const materialized = JSON.parse(
      readFileSync(join(runtimeDir, 'var/current-snapshots.json'), 'utf8')
    );

    expect(materialized).toHaveProperty('generatedAt');
      expect(materialized.accounts[0].sourceId).toBe('llm-gateway:default');
  });

  it('writes a materialized state file when executed directly', async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'vibe-daemon-'));
    const materializedPath = join(runtimeDir, 'var/current-snapshots.json');
    const tsxPath = fileURLToPath(new URL('../../../node_modules/.bin/tsx', import.meta.url));
    const childEnv = { ...process.env };

    delete childEnv.VITEST;
    delete childEnv.VITEST_MODE;
    delete childEnv.VITEST_POOL_ID;
    delete childEnv.VITEST_WORKER_ID;

    const child = spawn(
      tsxPath,
      [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
      {
        cwd: runtimeDir,
        env: childEnv,
        stdio: 'ignore'
      }
    );

    try {
      await waitForFile(materializedPath, child);

      const materialized = JSON.parse(readFileSync(materializedPath, 'utf8'));
      expect(materialized).toHaveProperty('generatedAt');
      expect(Array.isArray(materialized.gateways)).toBe(true);
      expect(Array.isArray(materialized.accounts)).toBe(true);
    } finally {
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
  });
});
