# Vibe Usage Floating Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first macOS floating monitor that shows normalized usage and refresh health for multiple vibe-coding sources, starting with `claude-code-official`, one config-driven `claude-code-custom-<base_url>`, and `codex-official`.

**Architecture:** Use a `Tauri + React` floating shell for the desktop UI, a `Node.js + TypeScript` daemon for refresh orchestration and SQLite-backed snapshot storage, and a separate `Node.js + Playwright` browser worker that is only used for sources with no stable API or local-state path. The daemon writes both SQLite history and a materialized JSON snapshot file so the UI can remain simple and non-blocking.

**Tech Stack:** Tauri, React, TypeScript, Vitest, Vite, Zod, better-sqlite3, keytar, Playwright, Rust

---

## File Structure

`/.gitignore`
Purpose: Ignore build output, runtime state, browser profiles, and local caches.

`/package.json`
Purpose: Root workspace scripts for install, test, and local development.

`/pnpm-workspace.yaml`
Purpose: Define the monorepo packages.

`/tsconfig.base.json`
Purpose: Shared TypeScript compiler defaults and path aliases.

`/README.md`
Purpose: Explain local development flow, runtime directories, and source configuration.

`/config/sources.custom.json`
Purpose: Declare one or more config-driven custom endpoint sources and their field mappings.

`/packages/shared/package.json`
Purpose: Shared package manifest for normalized snapshot types and schemas.

`/packages/shared/tsconfig.json`
Purpose: Shared package TypeScript config.

`/packages/shared/src/schema.ts`
Purpose: Zod schemas for snapshots, quota windows, alerts, capabilities, and materialized state.

`/packages/shared/src/index.ts`
Purpose: Public exports for schemas and inferred types.

`/packages/shared/tests/schema.test.ts`
Purpose: Contract tests for strict missing-absolute handling and multi-window source support.

`/apps/usage-daemon/package.json`
Purpose: Daemon package manifest and scripts.

`/apps/usage-daemon/tsconfig.json`
Purpose: Daemon TypeScript config.

`/apps/usage-daemon/src/index.ts`
Purpose: Daemon entrypoint that starts the refresh loop and writes materialized state.

`/apps/usage-daemon/src/config.ts`
Purpose: Resolve runtime directories, thresholds, and source configuration.

`/apps/usage-daemon/src/storage/db.ts`
Purpose: Create and update SQLite tables for current source state and refresh history.

`/apps/usage-daemon/src/storage/materializedState.ts`
Purpose: Write `var/current-snapshots.json` from normalized current source state.

`/apps/usage-daemon/src/adapters/types.ts`
Purpose: Adapter contract, normalized refresh results, and source instance metadata.

`/apps/usage-daemon/src/alerts/classify.ts`
Purpose: Convert normalized snapshots into `quota_low`, `refresh_stale`, `auth_invalid`, or `source_broken`.

`/apps/usage-daemon/src/refreshLoop.ts`
Purpose: Schedule refreshes, preserve last-good snapshots, and call storage/materialization.

`/apps/usage-daemon/src/auth/credentialStore.ts`
Purpose: Resolve secrets from env, config, local state, Keychain, and browser-session references.

`/apps/usage-daemon/src/browser/workerClient.ts`
Purpose: Dispatch browser jobs to the browser worker and return structured results.

`/apps/usage-daemon/src/adapters/claudeCodeOfficial.ts`
Purpose: Normalize official Claude usage data from local auth plus official usage endpoint.

`/apps/usage-daemon/src/adapters/customEndpoint.ts`
Purpose: Normalize one config-driven custom endpoint source from declarative field mappings.

`/apps/usage-daemon/src/adapters/codexOfficial.ts`
Purpose: Normalize Codex usage using local auth plus browser-worker fallback.

`/apps/usage-daemon/tests/storage.test.ts`
Purpose: Test SQLite writes and materialized snapshot output.

`/apps/usage-daemon/tests/refreshLoop.test.ts`
Purpose: Test alert classification, staleness escalation, and last-good preservation.

`/apps/usage-daemon/tests/credentialStore.test.ts`
Purpose: Test credential precedence and browser-profile isolation.

`/apps/usage-daemon/tests/claudeCodeOfficial.test.ts`
Purpose: Test official Claude adapter normalization.

`/apps/usage-daemon/tests/customEndpoint.test.ts`
Purpose: Test config-driven custom endpoint normalization.

`/apps/usage-daemon/tests/codexOfficial.test.ts`
Purpose: Test Codex adapter normalization and browser-worker integration.

`/apps/usage-daemon/tests/e2e.test.ts`
Purpose: Verify the daemon can refresh sources and produce one coherent materialized snapshot file.

`/apps/usage-daemon/tests/fixtures/*.json`
Purpose: Sanitized raw API payloads and browser-worker results.

`/apps/browser-worker/package.json`
Purpose: Browser worker package manifest and scripts.

`/apps/browser-worker/tsconfig.json`
Purpose: Browser worker TypeScript config.

`/apps/browser-worker/src/index.ts`
Purpose: Read browser jobs from stdin and dispatch to provider handlers.

`/apps/browser-worker/src/profileRegistry.ts`
Purpose: Resolve per-source browser profile paths under `var/browser-profiles`.

`/apps/browser-worker/src/providers/codexChatgptUsage.ts`
Purpose: Browser-backed usage fetch for `codex-official`.

`/apps/browser-worker/tests/codexChatgptUsage.test.ts`
Purpose: Test Codex provider parsing from a stored HTML fixture.

`/apps/browser-worker/tests/fixtures/codex-usage.html`
Purpose: Sanitized DOM sample for Codex usage extraction tests.

`/apps/desktop/package.json`
Purpose: Desktop renderer package manifest and scripts.

`/apps/desktop/tsconfig.json`
Purpose: Desktop TypeScript config.

`/apps/desktop/index.html`
Purpose: Vite host page for the floating renderer.

`/apps/desktop/vite.config.ts`
Purpose: Vite configuration for the desktop renderer.

`/apps/desktop/src/main.tsx`
Purpose: React entrypoint.

`/apps/desktop/src/App.tsx`
Purpose: Root floating panel state machine for calm, expanded, and alert modes.

`/apps/desktop/src/app.css`
Purpose: The calm/expanded/alert visual system.

`/apps/desktop/src/api/client.ts`
Purpose: Tauri-backed snapshot loader.

`/apps/desktop/src/hooks/useSnapshots.ts`
Purpose: Poll and hydrate materialized state into React.

`/apps/desktop/src/components/CalmPanel.tsx`
Purpose: Vendor-group summary view for the calm state.

`/apps/desktop/src/components/ExpandedPanel.tsx`
Purpose: Per-source detail view for the expanded state.

`/apps/desktop/src/components/AlertStrip.tsx`
Purpose: Compact emphasis row for alert state.

`/apps/desktop/src/App.test.tsx`
Purpose: Verify calm, expanded, and alert rendering using fixture state.

`/apps/desktop/src-tauri/Cargo.toml`
Purpose: Rust dependencies for the Tauri shell.

`/apps/desktop/src-tauri/tauri.conf.json`
Purpose: Floating shell window configuration.

`/apps/desktop/src-tauri/src/main.rs`
Purpose: Tauri binary entrypoint.

`/apps/desktop/src-tauri/src/lib.rs`
Purpose: Register commands exposed to the React renderer.

`/apps/desktop/src-tauri/src/state_file.rs`
Purpose: Resolve and read the materialized snapshot file for the renderer.

### Task 1: Bootstrap The Workspace And Shared Snapshot Contract

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/schema.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/tests/schema.test.ts`

- [ ] **Step 1: Create the repository skeleton and root workspace files**

Run:

```bash
git init
mkdir -p packages/shared/src packages/shared/tests apps/desktop/src apps/desktop/src-tauri/src apps/usage-daemon/src apps/usage-daemon/tests apps/browser-worker/src apps/browser-worker/tests config
```

Write:

```gitignore
node_modules/
dist/
coverage/
.DS_Store
target/
var/
apps/desktop/src-tauri/gen/
.superpowers/
```

```json
{
  "name": "vibe-usage-monitor",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "corepack pnpm -r test",
    "test:desktop": "corepack pnpm --filter @vibe-monitor/desktop test",
    "test:daemon": "corepack pnpm --filter @vibe-monitor/usage-daemon test",
    "test:browser-worker": "corepack pnpm --filter @vibe-monitor/browser-worker test"
  }
}
```

```yaml
packages:
  - apps/*
  - packages/*
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@vibe-monitor/shared": [
        "packages/shared/src/index.ts"
      ]
    }
  }
}
```

```json
{
  "name": "@vibe-monitor/shared",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run"
  }
}
```

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": [
    "src",
    "tests"
  ]
}
```

- [ ] **Step 2: Install shared development dependencies**

Run:

```bash
corepack pnpm add -Dw typescript tsx vitest @types/node zod
```

Expected: the workspace installs successfully and a root lockfile is created.

- [ ] **Step 3: Write the failing shared schema tests**

Write:

```ts
import { describe, expect, it } from 'vitest';
import { materializedStateSchema } from '../src/schema';

describe('materializedStateSchema', () => {
  it('allows strict missing absolute quota when the capability is false', () => {
    const parsed = materializedStateSchema.parse({
      generatedAt: '2026-04-09T12:00:00.000Z',
      sources: [
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
          windows: [
            {
              key: 'five_hour',
              label: '5h',
              percent: 68,
              usedAmount: null,
              totalAmount: null,
              unit: null,
              resetAt: '2026-04-09T14:00:00.000Z'
            }
          ]
        }
      ]
    });

    expect(parsed.sources[0].usedAmount).toBeNull();
    expect(parsed.sources[0].windows[0].label).toBe('5h');
  });

  it('rejects a partial absolute quota pair', () => {
    expect(() =>
      materializedStateSchema.parse({
        generatedAt: '2026-04-09T12:00:00.000Z',
        sources: [
          {
            sourceId: 'broken-source',
            vendorFamily: 'Anthropic',
            sourceKind: 'official_api',
            accountLabel: 'Broken',
            planName: 'Pro',
            usagePercent: 12,
            usedAmount: 10,
            totalAmount: null,
            amountUnit: 'requests',
            resetAt: null,
            refreshStatus: 'ok',
            lastSuccessAt: '2026-04-09T11:55:00.000Z',
            lastError: null,
            alertKind: null,
            capabilities: {
              percent: true,
              absoluteAmount: false,
              resetTime: false,
              planName: true,
              healthSignal: true
            },
            windows: []
          }
        ]
      })
    ).toThrow();
  });
});
```

- [ ] **Step 4: Run the shared tests to verify they fail**

Run:

```bash
corepack pnpm --filter @vibe-monitor/shared test
```

Expected: FAIL with a module-not-found error for `../src/schema`.

- [ ] **Step 5: Implement the shared schemas and exports**

Write:

```ts
import { z } from 'zod';

const isoDateTime = z.string().datetime({ offset: true });

export const alertKindSchema = z.enum([
  'quota_low',
  'refresh_stale',
  'auth_invalid',
  'source_broken'
]);

export const capabilitySchema = z.object({
  percent: z.boolean(),
  absoluteAmount: z.boolean(),
  resetTime: z.boolean(),
  planName: z.boolean(),
  healthSignal: z.boolean()
});

export const quotaWindowSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  percent: z.number().min(0).max(100).nullable(),
  usedAmount: z.number().nonnegative().nullable(),
  totalAmount: z.number().positive().nullable(),
  unit: z.string().min(1).nullable(),
  resetAt: isoDateTime.nullable()
}).superRefine((value, ctx) => {
  const pair = [value.usedAmount, value.totalAmount];
  const bothNull = pair[0] === null && pair[1] === null;
  const bothPresent = pair[0] !== null && pair[1] !== null;

  if (!bothNull && !bothPresent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'usedAmount and totalAmount must both be null or both be present'
    });
  }
});

export const sourceSnapshotSchema = z.object({
  sourceId: z.string().min(1),
  vendorFamily: z.string().min(1),
  sourceKind: z.enum([
    'official_api',
    'official_cli_or_local_state',
    'custom_endpoint',
    'browser_automation'
  ]),
  accountLabel: z.string().min(1),
  planName: z.string().min(1).nullable(),
  usagePercent: z.number().min(0).max(100).nullable(),
  usedAmount: z.number().nonnegative().nullable(),
  totalAmount: z.number().positive().nullable(),
  amountUnit: z.string().min(1).nullable(),
  resetAt: isoDateTime.nullable(),
  refreshStatus: z.enum(['ok', 'stale', 'auth_invalid', 'source_broken']),
  lastSuccessAt: isoDateTime.nullable(),
  lastError: z.string().min(1).nullable(),
  alertKind: alertKindSchema.nullable(),
  capabilities: capabilitySchema,
  windows: z.array(quotaWindowSchema)
}).superRefine((value, ctx) => {
  const bothNull = value.usedAmount === null && value.totalAmount === null;
  const bothPresent = value.usedAmount !== null && value.totalAmount !== null;

  if (!bothNull && !bothPresent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'usedAmount and totalAmount must both be null or both be present'
    });
  }

  if (!value.capabilities.absoluteAmount && !bothNull) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'absolute amounts must be null when absoluteAmount capability is false'
    });
  }
});

export const materializedStateSchema = z.object({
  generatedAt: isoDateTime,
  sources: z.array(sourceSnapshotSchema)
});

export type AlertKind = z.infer<typeof alertKindSchema>;
export type CapabilitySet = z.infer<typeof capabilitySchema>;
export type QuotaWindow = z.infer<typeof quotaWindowSchema>;
export type SourceSnapshot = z.infer<typeof sourceSnapshotSchema>;
export type MaterializedState = z.infer<typeof materializedStateSchema>;
```

```ts
export {
  alertKindSchema,
  capabilitySchema,
  materializedStateSchema,
  quotaWindowSchema,
  sourceSnapshotSchema
} from './schema';

export type {
  AlertKind,
  CapabilitySet,
  MaterializedState,
  QuotaWindow,
  SourceSnapshot
} from './schema';
```

- [ ] **Step 6: Run the shared tests and commit the bootstrap**

Run:

```bash
corepack pnpm --filter @vibe-monitor/shared test
git add .gitignore package.json pnpm-workspace.yaml tsconfig.base.json pnpm-lock.yaml packages/shared
git commit -m "chore: bootstrap workspace and shared snapshot schema"
```

Expected: PASS with both schema tests green and the first commit created.

### Task 2: Build SQLite Storage And Materialized Snapshot Output

**Files:**
- Create: `apps/usage-daemon/package.json`
- Create: `apps/usage-daemon/tsconfig.json`
- Create: `apps/usage-daemon/src/config.ts`
- Create: `apps/usage-daemon/src/storage/db.ts`
- Create: `apps/usage-daemon/src/storage/materializedState.ts`
- Create: `apps/usage-daemon/tests/storage.test.ts`

- [ ] **Step 1: Add the daemon package and a failing storage test**

Write:

```json
{
  "name": "@vibe-monitor/usage-daemon",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@vibe-monitor/shared": "workspace:*"
  }
}
```

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": [
    "src",
    "tests"
  ]
}
```

```ts
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { openStorage, persistCurrentSnapshots, readCurrentSnapshots } from '../src/storage/db';
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
```

- [ ] **Step 2: Install daemon storage dependencies**

Run:

```bash
corepack pnpm add --filter @vibe-monitor/usage-daemon better-sqlite3
```

Expected: the daemon package resolves `better-sqlite3` successfully.

- [ ] **Step 3: Run the daemon storage test to verify it fails**

Run:

```bash
corepack pnpm --filter @vibe-monitor/usage-daemon test
```

Expected: FAIL because the storage modules do not exist yet.

- [ ] **Step 4: Implement runtime config, SQLite storage, and materialized snapshot writing**

Write:

```ts
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function resolveRuntimeDir(cwd: string = process.cwd()): string {
  const dir = resolve(cwd, 'var');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function resolveDataFile(cwd: string = process.cwd()): string {
  return join(resolveRuntimeDir(cwd), 'usage-monitor.sqlite');
}
```

```ts
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

export function persistCurrentSnapshots(storage: Storage, snapshots: SourceSnapshot[]): void {
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
```

```ts
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
```

- [ ] **Step 5: Run the daemon storage test and commit**

Run:

```bash
corepack pnpm --filter @vibe-monitor/usage-daemon test
git add pnpm-lock.yaml apps/usage-daemon
git commit -m "feat: add daemon storage and materialized snapshot output"
```

Expected: PASS with the storage test green and a second commit created.

### Task 3: Add The Refresh Loop, Adapter Contract, And Alert Classifier

**Files:**
- Create: `apps/usage-daemon/src/adapters/types.ts`
- Create: `apps/usage-daemon/src/alerts/classify.ts`
- Create: `apps/usage-daemon/src/refreshLoop.ts`
- Create: `apps/usage-daemon/tests/refreshLoop.test.ts`

- [ ] **Step 1: Write a failing refresh-loop test for last-good preservation and alert classification**

Write:

```ts
import { describe, expect, it } from 'vitest';
import type { SourceAdapter } from '../src/adapters/types';
import { runRefreshCycle } from '../src/refreshLoop';

describe('runRefreshCycle', () => {
  it('keeps the last good snapshot when a source later fails', async () => {
    let callCount = 0;

    const adapter: SourceAdapter = {
      sourceId: 'claude-code-official',
      sourceKind: 'official_api',
      vendorFamily: 'Anthropic',
      async refresh() {
        callCount += 1;

        if (callCount === 1) {
          return {
            ok: true,
            snapshot: {
              sourceId: 'claude-code-official',
              vendorFamily: 'Anthropic',
              sourceKind: 'official_api',
              accountLabel: 'Personal',
              planName: 'Pro',
              usagePercent: 82,
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
          };
        }

        return {
          ok: false,
          sourceId: 'claude-code-official',
          refreshStatus: 'source_broken',
          errorText: 'selector missing'
        };
      }
    };

    const first = await runRefreshCycle([adapter], new Map(), {
      now: () => new Date('2026-04-09T12:00:00.000Z')
    });
    const second = await runRefreshCycle([adapter], first.currentBySource, {
      now: () => new Date('2026-04-09T12:05:00.000Z')
    });

    expect(first.snapshots[0].alertKind).toBe('quota_low');
    expect(second.snapshots[0].usagePercent).toBe(82);
    expect(second.snapshots[0].refreshStatus).toBe('source_broken');
    expect(second.snapshots[0].lastError).toBe('selector missing');
  });
});
```

- [ ] **Step 2: Run the refresh-loop test to verify it fails**

Run:

```bash
corepack pnpm --filter @vibe-monitor/usage-daemon test
```

Expected: FAIL because the adapter types, classifier, and refresh loop modules do not exist.

- [ ] **Step 3: Implement the adapter contract**

Write:

```ts
import type { SourceSnapshot } from '@vibe-monitor/shared';

export type AdapterFailure = {
  ok: false;
  sourceId: string;
  refreshStatus: 'auth_invalid' | 'source_broken';
  errorText: string;
};

export type AdapterSuccess = {
  ok: true;
  snapshot: SourceSnapshot;
};

export type AdapterResult = AdapterFailure | AdapterSuccess;

export type SourceAdapter = {
  sourceId: string;
  sourceKind: SourceSnapshot['sourceKind'];
  vendorFamily: SourceSnapshot['vendorFamily'];
  refresh: () => Promise<AdapterResult>;
};
```

- [ ] **Step 4: Implement alert classification and refresh-cycle behavior**

Write:

```ts
import type { AlertKind, SourceSnapshot } from '@vibe-monitor/shared';

export function classifyAlert(snapshot: SourceSnapshot, staleAfterMs: number, now: Date): AlertKind | null {
  if (snapshot.refreshStatus === 'auth_invalid') {
    return 'auth_invalid';
  }

  if (snapshot.refreshStatus === 'source_broken') {
    return 'source_broken';
  }

  if (snapshot.lastSuccessAt) {
    const ageMs = now.getTime() - new Date(snapshot.lastSuccessAt).getTime();
    if (ageMs > staleAfterMs) {
      return 'refresh_stale';
    }
  }

  if (snapshot.usagePercent !== null && snapshot.usagePercent >= 80) {
    return 'quota_low';
  }

  return null;
}
```

```ts
import type { SourceSnapshot } from '@vibe-monitor/shared';
import { classifyAlert } from './alerts/classify';
import type { SourceAdapter } from './adapters/types';

export async function runRefreshCycle(
  adapters: SourceAdapter[],
  currentBySource: Map<string, SourceSnapshot>,
  deps: {
    now?: () => Date;
    staleAfterMs?: number;
  } = {}
): Promise<{
  snapshots: SourceSnapshot[];
  currentBySource: Map<string, SourceSnapshot>;
}> {
  const now = deps.now?.() ?? new Date();
  const staleAfterMs = deps.staleAfterMs ?? 15 * 60_000;
  const next = new Map(currentBySource);

  for (const adapter of adapters) {
    const result = await adapter.refresh();

    if (result.ok) {
      const snapshot = {
        ...result.snapshot,
        alertKind: classifyAlert(result.snapshot, staleAfterMs, now)
      };
      next.set(adapter.sourceId, snapshot);
      continue;
    }

    const lastGood = next.get(adapter.sourceId);
    if (!lastGood) {
      continue;
    }

    const merged: SourceSnapshot = {
      ...lastGood,
      refreshStatus: result.refreshStatus,
      lastError: result.errorText
    };

    merged.alertKind = classifyAlert(merged, staleAfterMs, now);
    next.set(adapter.sourceId, merged);
  }

  return {
    snapshots: Array.from(next.values()),
    currentBySource: next
  };
}
```

- [ ] **Step 5: Run the refresh-loop test and commit**

Run:

```bash
corepack pnpm --filter @vibe-monitor/usage-daemon test
git add apps/usage-daemon/src/adapters apps/usage-daemon/src/alerts apps/usage-daemon/src/refreshLoop.ts apps/usage-daemon/tests/refreshLoop.test.ts
git commit -m "feat: add refresh loop and alert classification"
```

Expected: PASS with the refresh-loop test green and a third commit created.

### Task 4: Build The Floating Renderer With Calm, Expanded, And Alert States

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/vite.config.ts`
- Create: `apps/desktop/src/main.tsx`
- Create: `apps/desktop/src/App.tsx`
- Create: `apps/desktop/src/app.css`
- Create: `apps/desktop/src/api/client.ts`
- Create: `apps/desktop/src/hooks/useSnapshots.ts`
- Create: `apps/desktop/src/components/CalmPanel.tsx`
- Create: `apps/desktop/src/components/ExpandedPanel.tsx`
- Create: `apps/desktop/src/components/AlertStrip.tsx`
- Create: `apps/desktop/src/App.test.tsx`

- [ ] **Step 1: Add the desktop package and a failing renderer test**

Write:

```json
{
  "name": "@vibe-monitor/desktop",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "test": "vitest run --environment jsdom"
  },
  "dependencies": {
    "@vibe-monitor/shared": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist"
  },
  "include": [
    "src",
    "vite.config.ts"
  ]
}
```

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vibe Usage Monitor</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()]
});
```

```ts
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the calm grouped summary and alert emphasis', () => {
    render(
      <App
        initialState={{
          generatedAt: '2026-04-09T12:00:00.000Z',
          sources: [
            {
              sourceId: 'claude-code-official',
              vendorFamily: 'Anthropic',
              sourceKind: 'official_api',
              accountLabel: 'Personal',
              planName: 'Pro',
              usagePercent: 87,
              usedAmount: null,
              totalAmount: null,
              amountUnit: null,
              resetAt: '2026-04-09T14:00:00.000Z',
              refreshStatus: 'ok',
              lastSuccessAt: '2026-04-09T11:55:00.000Z',
              lastError: null,
              alertKind: 'quota_low',
              capabilities: {
                percent: true,
                absoluteAmount: false,
                resetTime: true,
                planName: true,
                healthSignal: true
              },
              windows: []
            }
          ]
        }}
      />
    );

    expect(screen.getByText('Anthropic')).toBeTruthy();
    expect(screen.getByText('Attention Needed')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Install renderer dependencies**

Run:

```bash
corepack pnpm add --filter @vibe-monitor/desktop react react-dom @tauri-apps/api
corepack pnpm add -D --filter @vibe-monitor/desktop vite @vitejs/plugin-react @testing-library/react jsdom @tauri-apps/cli
```

Expected: the desktop package installs both runtime and test dependencies.

- [ ] **Step 3: Run the renderer test to verify it fails**

Run:

```bash
corepack pnpm --filter @vibe-monitor/desktop test
```

Expected: FAIL because `App`, `client`, and the renderer components do not exist.

- [ ] **Step 4: Implement the floating renderer**

Write:

```ts
import { invoke } from '@tauri-apps/api/core';
import type { MaterializedState } from '@vibe-monitor/shared';

export async function loadMaterializedState(): Promise<MaterializedState> {
  return invoke<MaterializedState>('read_materialized_state');
}
```

```ts
import { useEffect, useState } from 'react';
import type { MaterializedState } from '@vibe-monitor/shared';
import { loadMaterializedState } from '../api/client';

export function useSnapshots(initialState?: MaterializedState) {
  const [state, setState] = useState<MaterializedState | null>(initialState ?? null);

  useEffect(() => {
    if (initialState) {
      return;
    }

    void loadMaterializedState().then(setState);
    const id = window.setInterval(() => {
      void loadMaterializedState().then(setState);
    }, 5000);

    return () => window.clearInterval(id);
  }, [initialState]);

  return state;
}
```

```tsx
import type { MaterializedState } from '@vibe-monitor/shared';

export function CalmPanel({ state }: { state: MaterializedState }) {
  const groups = Array.from(
    state.sources.reduce((map, source) => {
      const list = map.get(source.vendorFamily) ?? [];
      list.push(source);
      map.set(source.vendorFamily, list);
      return map;
    }, new Map<string, typeof state.sources>())
  );

  return (
    <div className="panel calm">
      {groups.map(([vendor, sources]) => (
        <section key={vendor} className="group">
          <h2>{vendor}</h2>
          <p>{sources.length} source{sources.length === 1 ? '' : 's'}</p>
        </section>
      ))}
    </div>
  );
}
```

```tsx
import type { MaterializedState } from '@vibe-monitor/shared';

export function ExpandedPanel({ state }: { state: MaterializedState }) {
  return (
    <div className="panel expanded">
      {state.sources.map((source) => (
        <article key={source.sourceId} className="source-card">
          <header>
            <strong>{source.sourceId}</strong>
            <span>{source.usagePercent === null ? '--' : `${source.usagePercent}%`}</span>
          </header>
          <p>{source.planName ?? 'Unknown plan'}</p>
          <p>
            {source.usedAmount === null || source.totalAmount === null
              ? 'absolute quota unavailable'
              : `${source.usedAmount} / ${source.totalAmount} ${source.amountUnit ?? ''}`.trim()}
          </p>
        </article>
      ))}
    </div>
  );
}
```

```tsx
import type { MaterializedState } from '@vibe-monitor/shared';

export function AlertStrip({ state }: { state: MaterializedState }) {
  const alerting = state.sources.filter((source) => source.alertKind !== null);

  if (alerting.length === 0) {
    return null;
  }

  return (
    <div className="alert-strip">
      <span>Attention Needed</span>
      <span>{alerting.map((source) => source.sourceId).join(', ')}</span>
    </div>
  );
}
```

```tsx
import { useState } from 'react';
import './app.css';
import type { MaterializedState } from '@vibe-monitor/shared';
import { useSnapshots } from './hooks/useSnapshots';
import { CalmPanel } from './components/CalmPanel';
import { ExpandedPanel } from './components/ExpandedPanel';
import { AlertStrip } from './components/AlertStrip';

type AppProps = {
  initialState?: MaterializedState;
};

export default function App({ initialState }: AppProps) {
  const state = useSnapshots(initialState);
  const [expanded, setExpanded] = useState(false);

  if (!state) {
    return <div className="panel calm">Loading…</div>;
  }

  return (
    <main
      className="shell"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <AlertStrip state={state} />
      <CalmPanel state={state} />
      {expanded ? <ExpandedPanel state={state} /> : null}
    </main>
  );
}
```

```css
:root {
  color: #1f2937;
  font-family: "SF Pro Text", "Helvetica Neue", sans-serif;
}

body {
  margin: 0;
  background: transparent;
}

.shell {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.panel {
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(18px);
  padding: 14px;
}

.alert-strip {
  border-radius: 16px;
  background: rgba(255, 228, 220, 0.92);
  color: #9a3412;
  display: flex;
  justify-content: space-between;
  padding: 10px 14px;
}

.source-card {
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  padding-top: 10px;
}
```

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: Run the renderer tests and commit**

Run:

```bash
corepack pnpm --filter @vibe-monitor/desktop test
git add pnpm-lock.yaml apps/desktop
git commit -m "feat: add floating renderer states"
```

Expected: PASS with the UI test green and a fourth commit created.

### Task 5: Add The Tauri Floating Shell

**Files:**
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/src/main.rs`
- Create: `apps/desktop/src-tauri/src/lib.rs`
- Create: `apps/desktop/src-tauri/src/state_file.rs`

- [ ] **Step 1: Write a failing Rust unit test for the materialized state path**

Write:

```rust
#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use crate::state_file::materialized_state_path;

    #[test]
    fn resolves_current_snapshot_path_under_var() {
        let base = PathBuf::from("/tmp/vibe-monitor");
        let path = materialized_state_path(&base);
        assert_eq!(path, PathBuf::from("/tmp/vibe-monitor/var/current-snapshots.json"));
    }
}
```

- [ ] **Step 2: Add the Tauri shell files and command wiring**

Write:

```toml
[package]
name = "vibe-monitor-shell"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri = { version = "2", features = [] }
```

```json
{
  "productName": "Vibe Usage Monitor",
  "version": "0.1.0",
  "identifier": "com.brding.vibe-usage-monitor",
  "build": {
    "beforeDevCommand": "corepack pnpm --filter @vibe-monitor/desktop dev",
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173"
  },
  "app": {
    "windows": [
      {
        "title": "Vibe Usage Monitor",
        "width": 320,
        "height": 420,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "resizable": false,
        "skipTaskbar": true
      }
    ]
  }
}
```

```rust
mod state_file;

use tauri::Manager;

#[tauri::command]
fn read_materialized_state(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    state_file::read_materialized_state(app.path().app_data_dir().map_err(|e| e.to_string())?)
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_materialized_state])
        .run(tauri::generate_context!())
        .expect("failed to run tauri app");
}
```

```rust
fn main() {
    vibe_monitor_shell::run();
}
```

```rust
use std::fs;
use std::path::{Path, PathBuf};

pub fn materialized_state_path(base_dir: &Path) -> PathBuf {
    base_dir.join("var").join("current-snapshots.json")
}

pub fn read_materialized_state(base_dir: PathBuf) -> Result<serde_json::Value, String> {
    let path = materialized_state_path(&base_dir);
    if !path.exists() {
      return Ok(serde_json::json!({
        "generatedAt": "1970-01-01T00:00:00.000Z",
        "sources": []
      }));
    }

    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}
```

- [ ] **Step 3: Run the Rust tests**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

Expected: PASS with the state-path unit test green.

- [ ] **Step 4: Launch the shell manually and verify the floating window**

Run:

```bash
corepack pnpm --filter @vibe-monitor/desktop tauri dev
```

Expected: the floating shell launches with a transparent frameless window and the React renderer visible inside it.

- [ ] **Step 5: Commit the shell**

Run:

```bash
git add apps/desktop/src-tauri
git commit -m "feat: add tauri floating shell"
```

Expected: the shell files are committed cleanly.

### Task 6: Add Credential Resolution And The Browser Worker Scaffold

**Files:**
- Create: `apps/browser-worker/package.json`
- Create: `apps/browser-worker/tsconfig.json`
- Create: `apps/browser-worker/src/index.ts`
- Create: `apps/browser-worker/src/profileRegistry.ts`
- Create: `apps/usage-daemon/src/auth/credentialStore.ts`
- Create: `apps/usage-daemon/src/browser/workerClient.ts`
- Create: `apps/usage-daemon/tests/credentialStore.test.ts`

- [ ] **Step 1: Add a failing test for credential precedence and profile isolation**

Write:

```json
{
  "name": "@vibe-monitor/browser-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts",
    "test": "vitest run"
  }
}
```

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": [
    "src",
    "tests"
  ]
}
```

```ts
import { describe, expect, it } from 'vitest';
import { resolveCredentialValue, resolveBrowserProfileDir } from '../src/auth/credentialStore';

describe('credentialStore', () => {
  it('prefers env over config over local state', () => {
    const resolved = resolveCredentialValue(
      'CLAUDE_TOKEN',
      {
        CLAUDE_TOKEN: 'env-token'
      },
      {
        CLAUDE_TOKEN: 'config-token'
      },
      {
        CLAUDE_TOKEN: 'local-token'
      }
    );

    expect(resolved).toBe('env-token');
  });

  it('creates isolated profile directories per source', () => {
    expect(resolveBrowserProfileDir('/tmp/vibe', 'codex-official')).toBe('/tmp/vibe/browser-profiles/codex-official');
    expect(resolveBrowserProfileDir('/tmp/vibe', 'claude-web')).toBe('/tmp/vibe/browser-profiles/claude-web');
  });
});
```

- [ ] **Step 2: Install browser-worker dependencies**

Run:

```bash
corepack pnpm add --filter @vibe-monitor/usage-daemon keytar
corepack pnpm add --filter @vibe-monitor/browser-worker playwright
```

Expected: both packages install cleanly.

- [ ] **Step 3: Run the credential test to verify it fails**

Run:

```bash
corepack pnpm --filter @vibe-monitor/usage-daemon test
```

Expected: FAIL because the credential store and worker modules do not exist.

- [ ] **Step 4: Implement the credential store and browser-worker scaffold**

Write:

```ts
export function resolveCredentialValue(
  key: string,
  env: Record<string, string | undefined>,
  config: Record<string, string | undefined>,
  localState: Record<string, string | undefined>
): string | null {
  return env[key] ?? config[key] ?? localState[key] ?? null;
}

export function resolveBrowserProfileDir(runtimeDir: string, sourceId: string): string {
  return `${runtimeDir}/browser-profiles/${sourceId}`;
}
```

```ts
import { spawn } from 'node:child_process';

export async function runBrowserJob(job: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn('corepack', ['pnpm', '--filter', '@vibe-monitor/browser-worker', 'start'], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`browser worker exited with ${code}`));
        return;
      }
      resolve(JSON.parse(stdout));
    });

    child.stdin.write(JSON.stringify(job));
    child.stdin.end();
  });
}
```

```ts
export function resolveProfilePath(runtimeDir: string, sourceId: string): string {
  return `${runtimeDir}/browser-profiles/${sourceId}`;
}
```

```ts
import process from 'node:process';

let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) {
  raw += chunk;
}

const job = raw.trim() ? JSON.parse(raw) : {};

console.log(
  JSON.stringify({
    ok: false,
    error: 'unsupported_source',
    job
  })
);
```

- [ ] **Step 5: Run the tests and commit**

Run:

```bash
corepack pnpm --filter @vibe-monitor/usage-daemon test
git add pnpm-lock.yaml apps/browser-worker apps/usage-daemon/src/auth apps/usage-daemon/src/browser apps/usage-daemon/tests/credentialStore.test.ts
git commit -m "feat: add credential resolution and browser worker scaffold"
```

Expected: PASS with the credential test green and a sixth commit created.

### Task 7: Implement The Official Claude Adapter

**Files:**
- Create: `apps/usage-daemon/src/adapters/claudeCodeOfficial.ts`
- Create: `apps/usage-daemon/tests/fixtures/claude-official-usage.json`
- Create: `apps/usage-daemon/tests/claudeCodeOfficial.test.ts`

- [ ] **Step 1: Add the failing official Claude adapter test and fixture**

Write:

```json
{
  "five_hour": {
    "utilization": 68,
    "resets_at": "2026-04-09T14:00:00.000Z"
  },
  "seven_day": {
    "utilization": 22,
    "resets_at": "2026-04-15T00:00:00.000Z"
  }
}
```

```ts
import { describe, expect, it } from 'vitest';
import fixture from './fixtures/claude-official-usage.json';
import { normalizeClaudeOfficialUsage } from '../src/adapters/claudeCodeOfficial';

describe('normalizeClaudeOfficialUsage', () => {
  it('maps multi-window official Claude usage into one normalized snapshot', () => {
    const snapshot = normalizeClaudeOfficialUsage(fixture, {
      sourceId: 'claude-code-official',
      accountLabel: 'Personal',
      planName: 'Pro'
    });

    expect(snapshot.planName).toBe('Pro');
    expect(snapshot.usagePercent).toBe(68);
    expect(snapshot.capabilities.absoluteAmount).toBe(false);
    expect(snapshot.windows).toHaveLength(2);
    expect(snapshot.windows[0].label).toBe('5h');
  });
});
```

- [ ] **Step 2: Run the official Claude adapter test to verify it fails**

Run:

```bash
corepack pnpm --filter @vibe-monitor/usage-daemon test
```

Expected: FAIL because the adapter module does not exist.

- [ ] **Step 3: Implement the official Claude adapter**

Write:

```ts
import type { SourceSnapshot } from '@vibe-monitor/shared';

type ClaudeUsagePayload = {
  five_hour?: {
    utilization?: number;
    resets_at?: string;
  };
  seven_day?: {
    utilization?: number;
    resets_at?: string;
  };
};

export function normalizeClaudeOfficialUsage(
  payload: ClaudeUsagePayload,
  meta: {
    sourceId: string;
    accountLabel: string;
    planName: string | null;
  }
): SourceSnapshot {
  const windows = [
    {
      key: 'five_hour',
      label: '5h',
      percent: payload.five_hour?.utilization ?? null,
      usedAmount: null,
      totalAmount: null,
      unit: null,
      resetAt: payload.five_hour?.resets_at ?? null
    },
    {
      key: 'seven_day',
      label: '7d',
      percent: payload.seven_day?.utilization ?? null,
      usedAmount: null,
      totalAmount: null,
      unit: null,
      resetAt: payload.seven_day?.resets_at ?? null
    }
  ];

  const primary = windows
    .filter((window) => window.percent !== null)
    .sort((left, right) => (right.percent ?? 0) - (left.percent ?? 0))[0] ?? windows[0];

  return {
    sourceId: meta.sourceId,
    vendorFamily: 'Anthropic',
    sourceKind: 'official_api',
    accountLabel: meta.accountLabel,
    planName: meta.planName,
    usagePercent: primary.percent,
    usedAmount: null,
    totalAmount: null,
    amountUnit: null,
    resetAt: primary.resetAt,
    refreshStatus: 'ok',
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
    alertKind: null,
    capabilities: {
      percent: true,
      absoluteAmount: false,
      resetTime: true,
      planName: meta.planName !== null,
      healthSignal: true
    },
    windows
  };
}

export async function fetchClaudeOfficialUsage(accessToken: string): Promise<ClaudeUsagePayload> {
  const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'anthropic-beta': 'oauth-2025-04-20',
      'user-agent': 'vibe-usage-monitor/0.1'
    }
  });

  if (!response.ok) {
    throw new Error(`claude-official-http-${response.status}`);
  }

  return response.json() as Promise<ClaudeUsagePayload>;
}
```

- [ ] **Step 4: Run the official Claude adapter test and commit**

Run:

```bash
corepack pnpm --filter @vibe-monitor/usage-daemon test
git add apps/usage-daemon/src/adapters/claudeCodeOfficial.ts apps/usage-daemon/tests/fixtures/claude-official-usage.json apps/usage-daemon/tests/claudeCodeOfficial.test.ts
git commit -m "feat: add official claude adapter"
```

Expected: PASS with the official Claude adapter test green and a seventh commit created.

### Task 8: Implement The Config-Driven Custom Endpoint Adapter

**Files:**
- Create: `config/sources.custom.json`
- Create: `apps/usage-daemon/src/adapters/customEndpoint.ts`
- Create: `apps/usage-daemon/tests/fixtures/custom-endpoint-usage.json`
- Create: `apps/usage-daemon/tests/customEndpoint.test.ts`

- [ ] **Step 1: Add the failing custom-endpoint test and source config**

Write:

```json
[
  {
    "sourceId": "claude-code-custom-local",
    "vendorFamily": "Anthropic",
    "accountLabel": "Local Gateway",
    "baseUrl": "https://llm-gateway.example.com",
    "usagePath": "/usage",
    "planNamePath": "plan.name",
    "percentPath": "usage.percent",
    "usedPath": "usage.used",
    "totalPath": "usage.total",
    "unitPath": "usage.unit",
    "resetAtPath": "usage.resetAt"
  }
]
```

```json
{
  "plan": {
    "name": "Max"
  },
  "usage": {
    "percent": 54,
    "used": 270,
    "total": 500,
    "unit": "requests",
    "resetAt": "2026-04-10T00:00:00.000Z"
  }
}
```

```ts
import { describe, expect, it } from 'vitest';
import config from '../../../config/sources.custom.json';
import fixture from './fixtures/custom-endpoint-usage.json';
import { normalizeCustomEndpointUsage } from '../src/adapters/customEndpoint';

describe('normalizeCustomEndpointUsage', () => {
  it('maps the declarative field paths into a normalized snapshot', () => {
    const snapshot = normalizeCustomEndpointUsage(config[0], fixture);

    expect(snapshot.sourceId).toBe('claude-code-custom-local');
    expect(snapshot.planName).toBe('Max');
    expect(snapshot.usedAmount).toBe(270);
    expect(snapshot.totalAmount).toBe(500);
    expect(snapshot.amountUnit).toBe('requests');
  });
});
```

- [ ] **Step 2: Run the custom-endpoint test to verify it fails**

Run:

```bash
corepack pnpm --filter @vibe-monitor/usage-daemon test
```

Expected: FAIL because the custom endpoint adapter does not exist.

- [ ] **Step 3: Implement the config-driven adapter**

Write:

```ts
import type { SourceSnapshot } from '@vibe-monitor/shared';

type SourceConfig = {
  sourceId: string;
  vendorFamily: string;
  accountLabel: string;
  baseUrl: string;
  usagePath: string;
  planNamePath: string;
  percentPath: string;
  usedPath: string;
  totalPath: string;
  unitPath: string;
  resetAtPath: string;
};

function pickPath(input: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (value && typeof value === 'object' && segment in value) {
      return (value as Record<string, unknown>)[segment];
    }
    return undefined;
  }, input);
}

export function normalizeCustomEndpointUsage(config: SourceConfig, payload: unknown): SourceSnapshot {
  const planName = pickPath(payload, config.planNamePath);
  const amountUnit = pickPath(payload, config.unitPath);
  const resetAt = pickPath(payload, config.resetAtPath);
  const usedAmount = Number(pickPath(payload, config.usedPath));
  const totalAmount = Number(pickPath(payload, config.totalPath));

  return {
    sourceId: config.sourceId,
    vendorFamily: config.vendorFamily,
    sourceKind: 'custom_endpoint',
    accountLabel: config.accountLabel,
    planName: typeof planName === 'string' && planName.length > 0 ? planName : null,
    usagePercent: Number(pickPath(payload, config.percentPath)),
    usedAmount,
    totalAmount,
    amountUnit: typeof amountUnit === 'string' && amountUnit.length > 0 ? amountUnit : null,
    resetAt: typeof resetAt === 'string' && resetAt.length > 0 ? resetAt : null,
    refreshStatus: 'ok',
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
    alertKind: null,
    capabilities: {
      percent: true,
      absoluteAmount: true,
      resetTime: true,
      planName: true,
      healthSignal: true
    },
    windows: []
  };
}
```

- [ ] **Step 4: Run the custom-endpoint test and commit**

Run:

```bash
corepack pnpm --filter @vibe-monitor/usage-daemon test
git add config/sources.custom.json apps/usage-daemon/src/adapters/customEndpoint.ts apps/usage-daemon/tests/fixtures/custom-endpoint-usage.json apps/usage-daemon/tests/customEndpoint.test.ts
git commit -m "feat: add config-driven custom endpoint adapter"
```

Expected: PASS with the custom-endpoint test green and an eighth commit created.

### Task 9: Implement The Codex Official Adapter With Browser Fallback

**Files:**
- Create: `apps/browser-worker/src/providers/codexChatgptUsage.ts`
- Create: `apps/browser-worker/tests/fixtures/codex-usage.html`
- Create: `apps/browser-worker/tests/codexChatgptUsage.test.ts`
- Create: `apps/usage-daemon/src/adapters/codexOfficial.ts`
- Create: `apps/usage-daemon/tests/fixtures/codex-browser-result.json`
- Create: `apps/usage-daemon/tests/codexOfficial.test.ts`

- [ ] **Step 1: Add failing browser-provider and daemon-adapter tests**

Write:

```html
<main>
  <section data-test-id="codex-usage">
    <div data-test-id="plan">Plus</div>
    <div data-test-id="usage-percent">37%</div>
    <div data-test-id="reset-at">Resets 2026-04-10T00:00:00.000Z</div>
  </section>
</main>
```

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCodexUsageHtml } from '../src/providers/codexChatgptUsage';

describe('parseCodexUsageHtml', () => {
  it('extracts plan, percent, and reset time from the codex usage page', () => {
    const html = readFileSync(join(process.cwd(), 'tests/fixtures/codex-usage.html'), 'utf8');
    const parsed = parseCodexUsageHtml(html);

    expect(parsed.planName).toBe('Plus');
    expect(parsed.usagePercent).toBe(37);
    expect(parsed.resetAt).toBe('2026-04-10T00:00:00.000Z');
  });
});
```

```json
{
  "planName": "Plus",
  "usagePercent": 37,
  "resetAt": "2026-04-10T00:00:00.000Z"
}
```

```ts
import { describe, expect, it } from 'vitest';
import fixture from './fixtures/codex-browser-result.json';
import { normalizeCodexOfficialUsage } from '../src/adapters/codexOfficial';

describe('normalizeCodexOfficialUsage', () => {
  it('merges local auth metadata with the browser-worker result', () => {
    const snapshot = normalizeCodexOfficialUsage(
      {
        sourceId: 'codex-official',
        accountLabel: 'ChatGPT Personal',
        planName: 'Plus'
      },
      fixture
    );

    expect(snapshot.sourceId).toBe('codex-official');
    expect(snapshot.planName).toBe('Plus');
    expect(snapshot.usagePercent).toBe(37);
    expect(snapshot.capabilities.absoluteAmount).toBe(false);
  });
});
```

- [ ] **Step 2: Run the browser-worker and daemon tests to verify they fail**

Run:

```bash
corepack pnpm --filter @vibe-monitor/browser-worker test
corepack pnpm --filter @vibe-monitor/usage-daemon test
```

Expected: FAIL because the provider and Codex adapter do not exist.

- [ ] **Step 3: Implement the Codex browser provider and worker dispatch**

Write:

```ts
export function parseCodexUsageHtml(html: string): {
  planName: string | null;
  usagePercent: number | null;
  resetAt: string | null;
} {
  const planMatch = html.match(/data-test-id="plan">([^<]+)</);
  const usageMatch = html.match(/data-test-id="usage-percent">(\d+)%</);
  const resetMatch = html.match(/data-test-id="reset-at">Resets ([^<]+)</);

  return {
    planName: planMatch?.[1] ?? null,
    usagePercent: usageMatch ? Number(usageMatch[1]) : null,
    resetAt: resetMatch?.[1] ?? null
  };
}
```

```ts
import process from 'node:process';
import { parseCodexUsageHtml } from './providers/codexChatgptUsage';

let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) {
  raw += chunk;
}

const job = raw.trim() ? JSON.parse(raw) : {};

if (job.provider === 'codex-chatgpt-usage' && typeof job.html === 'string') {
  console.log(JSON.stringify({ ok: true, data: parseCodexUsageHtml(job.html) }));
} else {
  console.log(JSON.stringify({ ok: false, error: 'unsupported_source', job }));
}
```

- [ ] **Step 4: Implement the Codex adapter**

Write:

```ts
import type { SourceSnapshot } from '@vibe-monitor/shared';

export function normalizeCodexOfficialUsage(
  meta: {
    sourceId: string;
    accountLabel: string;
    planName: string | null;
  },
  workerResult: {
    planName: string | null;
    usagePercent: number | null;
    resetAt: string | null;
  }
): SourceSnapshot {
  return {
    sourceId: meta.sourceId,
    vendorFamily: 'OpenAI',
    sourceKind: 'browser_automation',
    accountLabel: meta.accountLabel,
    planName: workerResult.planName ?? meta.planName,
    usagePercent: workerResult.usagePercent,
    usedAmount: null,
    totalAmount: null,
    amountUnit: null,
    resetAt: workerResult.resetAt,
    refreshStatus: 'ok',
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
    alertKind: null,
    capabilities: {
      percent: workerResult.usagePercent !== null,
      absoluteAmount: false,
      resetTime: workerResult.resetAt !== null,
      planName: (workerResult.planName ?? meta.planName) !== null,
      healthSignal: true
    },
    windows: []
  };
}
```

- [ ] **Step 5: Run both test suites and commit**

Run:

```bash
corepack pnpm --filter @vibe-monitor/browser-worker test
corepack pnpm --filter @vibe-monitor/usage-daemon test
git add apps/browser-worker apps/usage-daemon/src/adapters/codexOfficial.ts apps/usage-daemon/tests/fixtures/codex-browser-result.json apps/usage-daemon/tests/codexOfficial.test.ts
git commit -m "feat: add codex official adapter via browser fallback"
```

Expected: PASS with both the browser-worker provider test and the Codex adapter test green, plus a ninth commit.

### Task 10: Wire The Daemon Entrypoint, End-To-End Snapshot Flow, And Developer README

**Files:**
- Create: `apps/usage-daemon/src/index.ts`
- Create: `apps/usage-daemon/tests/e2e.test.ts`
- Create: `README.md`
- Modify: `apps/usage-daemon/package.json`
- Modify: `apps/browser-worker/package.json`
- Modify: `package.json`

- [ ] **Step 1: Add a failing end-to-end daemon test**

Write:

```ts
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import type { SourceAdapter } from '../src/adapters/types';
import { runOnce } from '../src/index';

describe('daemon end-to-end', () => {
  it('writes a materialized state file from a refresh cycle', async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'vibe-e2e-'));
    const adapters: SourceAdapter[] = [
      {
        sourceId: 'claude-code-official',
        sourceKind: 'official_api',
        vendorFamily: 'Anthropic',
        async refresh() {
          return {
            ok: true,
            snapshot: {
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
          };
        }
      }
    ];

    await runOnce(runtimeDir, adapters, () => new Date('2026-04-09T12:00:00.000Z'));

    const materialized = JSON.parse(
      readFileSync(join(runtimeDir, 'var/current-snapshots.json'), 'utf8')
    );

    expect(materialized).toHaveProperty('generatedAt');
    expect(materialized.sources[0].sourceId).toBe('claude-code-official');
  });
});
```

- [ ] **Step 2: Run the daemon tests to verify the new end-to-end test fails**

Run:

```bash
corepack pnpm --filter @vibe-monitor/usage-daemon test
```

Expected: FAIL because `../src/index` does not exist yet.

- [ ] **Step 3: Implement the daemon entrypoint and package scripts**

Write:

```json
{
  "name": "@vibe-monitor/usage-daemon",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@vibe-monitor/shared": "workspace:*",
    "better-sqlite3": "^11.7.0",
    "keytar": "^7.9.0"
  }
}
```

```json
{
  "name": "@vibe-monitor/browser-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "playwright": "^1.52.0"
  }
}
```

```json
{
  "name": "vibe-usage-monitor",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:desktop": "corepack pnpm --filter @vibe-monitor/desktop dev",
    "dev:shell": "corepack pnpm --filter @vibe-monitor/desktop tauri dev",
    "dev:daemon": "corepack pnpm --filter @vibe-monitor/usage-daemon dev",
    "test": "corepack pnpm -r test",
    "test:desktop": "corepack pnpm --filter @vibe-monitor/desktop test",
    "test:daemon": "corepack pnpm --filter @vibe-monitor/usage-daemon test",
    "test:browser-worker": "corepack pnpm --filter @vibe-monitor/browser-worker test"
  }
}
```

```ts
import type { SourceAdapter } from './adapters/types';
import { openStorage, persistCurrentSnapshots, readCurrentSnapshots } from './storage/db';
import { writeMaterializedState } from './storage/materializedState';
import { runRefreshCycle } from './refreshLoop';

export async function runOnce(
  runtimeDir: string,
  adapters: SourceAdapter[],
  now: () => Date = () => new Date()
) {
  const storage = openStorage(runtimeDir);
  const current = new Map(
    readCurrentSnapshots(storage).map((snapshot) => [snapshot.sourceId, snapshot])
  );
  const result = await runRefreshCycle(adapters, current, { now });

  persistCurrentSnapshots(storage, result.snapshots);
  writeMaterializedState(`${runtimeDir}/var`, result.snapshots, now().toISOString());
  return result.snapshots;
}

async function main() {
  const runtimeDir = process.cwd();
  const adapters: SourceAdapter[] = [];

  await runOnce(runtimeDir, adapters);
  setInterval(() => {
    void runOnce(runtimeDir, adapters);
  }, 5 * 60_000);
}

void main();
```

````md
# Vibe Usage Monitor

## Development

Run the renderer:

```bash
corepack pnpm dev:desktop
```

Run the floating shell:

```bash
corepack pnpm dev:shell
```

Run the daemon:

```bash
corepack pnpm dev:daemon
```

Run all tests:

```bash
corepack pnpm test
```

## Runtime Output

- SQLite database: `var/usage-monitor.sqlite`
- Materialized state: `var/current-snapshots.json`
- Browser profiles: `var/browser-profiles/<source-id>/`
````

- [ ] **Step 4: Run the full test suite and commit**

Run:

```bash
corepack pnpm test
git add package.json pnpm-lock.yaml apps/usage-daemon apps/browser-worker README.md
git commit -m "feat: wire daemon entrypoint and end-to-end snapshot flow"
```

Expected: PASS with all workspace tests green and a final commit created.

- [ ] **Step 5: Smoke-test the local development flow**

Run:

```bash
corepack pnpm dev:daemon
```

Expected: the daemon creates `var/current-snapshots.json`.

Run:

```bash
corepack pnpm dev:shell
```

Expected: the desktop shell reads the materialized snapshot file and renders the floating panel without blocking on any external source.
