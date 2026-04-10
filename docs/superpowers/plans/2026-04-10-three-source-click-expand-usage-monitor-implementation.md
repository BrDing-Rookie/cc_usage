# Three-Source Click-Expand Usage Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved three-source `Claude Code` + `OpenAI Codex` + `mininglamp` monitor in `.worktrees/vibe-monitor`, including click-expand UI, `mininglamp` USD integration, and renderer-ready `last_5_hours` history.

**Architecture:** Extend the shared materialized-state contract to carry compact source history, teach the usage daemon to fetch `mininglamp` and materialize recent history from SQLite, then rebuild the desktop renderer around a fixed three-tile compact strip and a click-expanded detail panel. Keep the renderer read-only and keep all provider fetching and history shaping in the daemon.

**Tech Stack:** TypeScript, Zod, Vitest, better-sqlite3, React, Tauri, Vite

---

## File Structure

### Shared Contract

`.worktrees/vibe-monitor/packages/shared/src/schema.ts`
Purpose: Add history-point and history-window contracts to materialized state.

`.worktrees/vibe-monitor/packages/shared/src/index.ts`
Purpose: Export the new shared types and schemas.

`.worktrees/vibe-monitor/packages/shared/tests/schema.test.ts`
Purpose: Lock the extended materialized state shape with history.

### Usage Daemon

`.worktrees/vibe-monitor/apps/usage-daemon/src/adapters/mininglamp.ts`
Purpose: Fetch `subscription` and `usage`, normalize USD quota values, and sanitize `MININGLAMP_BASE_URL`.

`.worktrees/vibe-monitor/apps/usage-daemon/src/defaultAdapters.ts`
Purpose: Replace the `micc-api` placeholder path with the real `mininglamp` adapter registration.

`.worktrees/vibe-monitor/apps/usage-daemon/src/storage/db.ts`
Purpose: Read recent refresh history rows for chart generation.

`.worktrees/vibe-monitor/apps/usage-daemon/src/storage/materializedState.ts`
Purpose: Write expanded materialized state with `last_5_hours` history series.

`.worktrees/vibe-monitor/apps/usage-daemon/tests/defaultAdapters.test.ts`
Purpose: Verify adapter registration changes and removal of `micc-api`.

`.worktrees/vibe-monitor/apps/usage-daemon/tests/storage.test.ts`
Purpose: Verify materialized JSON includes recent history.

`.worktrees/vibe-monitor/apps/usage-daemon/tests/mininglamp.test.ts`
Purpose: Verify URL normalization, USD mapping, and failure handling.

### Desktop

`.worktrees/vibe-monitor/apps/desktop/src/App.tsx`
Purpose: Replace hover expansion with click expansion.

`.worktrees/vibe-monitor/apps/desktop/src/App.test.tsx`
Purpose: Verify the fixed three-source compact strip and expanded panel.

`.worktrees/vibe-monitor/apps/desktop/src/components/CompactStrip.tsx`
Purpose: Render the top three-tile compact summary strip.

`.worktrees/vibe-monitor/apps/desktop/src/components/ExpandedMonitor.tsx`
Purpose: Render the expanded panel header and fixed three source cards.

`.worktrees/vibe-monitor/apps/desktop/src/components/charts/Sparkline.tsx`
Purpose: Render the lightweight trend line and bar charts from materialized history.

`.worktrees/vibe-monitor/apps/desktop/src/components/monitorUtils.ts`
Purpose: Format provider-specific labels, percentages, USD values, and history values.

`.worktrees/vibe-monitor/apps/desktop/src/app.css`
Purpose: Replace the current list-based layout with the approved reference-driven composition.

## Task 1: Extend The Shared Materialized Contract

**Files:**
- Modify: `.worktrees/vibe-monitor/packages/shared/src/schema.ts`
- Modify: `.worktrees/vibe-monitor/packages/shared/src/index.ts`
- Test: `.worktrees/vibe-monitor/packages/shared/tests/schema.test.ts`

- [ ] **Step 1: Write the failing schema test for history-aware materialized state**

```ts
it('accepts materialized history for the last five hours window', () => {
  const parsed = materializedStateSchema.parse({
    generatedAt: '2026-04-10T10:00:00.000Z',
    historyWindow: 'last_5_hours',
    sources: [],
    history: {
      'claude-code-official': [
        {
          recordedAt: '2026-04-10T09:00:00.000Z',
          value: 68,
          kind: 'percent'
        }
      ]
    }
  });

  expect(parsed.history['claude-code-official'][0].kind).toBe('percent');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --dir .worktrees/vibe-monitor --filter @vibe-monitor/shared test -- schema.test.ts`
Expected: FAIL because `historyWindow` and `history` are not in the schema yet.

- [ ] **Step 3: Implement the minimal schema additions**

```ts
export const materializedHistoryPointSchema = z.object({
  recordedAt: isoDateTime,
  value: z.number(),
  kind: z.enum(['percent', 'usd'])
});

export const materializedStateSchema = z.object({
  generatedAt: isoDateTime,
  historyWindow: z.enum(['last_5_hours']),
  sources: z.array(sourceSnapshotSchema),
  history: z.record(z.string(), z.array(materializedHistoryPointSchema))
});
```

- [ ] **Step 4: Export the new shared types**

```ts
export {
  materializedHistoryPointSchema,
  materializedStateSchema
} from './schema';

export type {
  MaterializedHistoryPoint,
  MaterializedState
} from './schema';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `corepack pnpm --dir .worktrees/vibe-monitor --filter @vibe-monitor/shared test -- schema.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git -C .worktrees/vibe-monitor add packages/shared/src/schema.ts packages/shared/src/index.ts packages/shared/tests/schema.test.ts
git -C .worktrees/vibe-monitor commit -m "feat: extend materialized state with history"
```

## Task 2: Replace The Placeholder Custom Source With mininglamp

**Files:**
- Create: `.worktrees/vibe-monitor/apps/usage-daemon/src/adapters/mininglamp.ts`
- Modify: `.worktrees/vibe-monitor/apps/usage-daemon/src/defaultAdapters.ts`
- Test: `.worktrees/vibe-monitor/apps/usage-daemon/tests/defaultAdapters.test.ts`
- Test: `.worktrees/vibe-monitor/apps/usage-daemon/tests/mininglamp.test.ts`

- [ ] **Step 1: Write the failing mininglamp adapter tests**

```ts
it('normalizes trailing slashes and maps USD quota fields', async () => {
  const snapshot = await fetchMininglampUsage(
    {
      baseUrl: 'https://llm-gateway.mlamp.cn/',
      apiKey: 'sk-test'
    },
    fakeFetch
  );

  expect(snapshot.sourceId).toBe('mininglamp');
  expect(snapshot.usedAmount).toBeCloseTo(59.81, 2);
  expect(snapshot.totalAmount).toBe(500);
  expect(snapshot.usagePercent).toBeCloseTo(11.96, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --dir .worktrees/vibe-monitor --filter @vibe-monitor/usage-daemon test -- mininglamp.test.ts defaultAdapters.test.ts`
Expected: FAIL because `mininglamp.ts` does not exist and the old adapter list still registers `micc-api`.

- [ ] **Step 3: Implement the adapter**

```ts
const normalizedBaseUrl = credentials.baseUrl.replace(/\/+$/, '');
const [subscription, usage] = await Promise.all([
  fetchJson(`${normalizedBaseUrl}/dashboard/billing/subscription`, credentials.apiKey, fetchImpl),
  fetchJson(`${normalizedBaseUrl}/dashboard/billing/usage`, credentials.apiKey, fetchImpl)
]);

const totalAmount = Number(subscription.hard_limit_usd ?? 0);
const usedAmount = Number(usage.total_usage ?? 0) / 100;
```

- [ ] **Step 4: Replace `micc-api` registration in `defaultAdapters.ts`**

```ts
if (mininglampBase && mininglampKey) {
  adapters.push(buildMininglampAdapter({
    baseUrl: mininglampBase,
    apiKey: mininglampKey
  }));
}
```

- [ ] **Step 5: Update the default adapter expectations**

```ts
expect(adapters.map((adapter) => adapter.sourceId)).toEqual([
  'claude-code-official',
  'codex-official',
  'mininglamp'
]);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `corepack pnpm --dir .worktrees/vibe-monitor --filter @vibe-monitor/usage-daemon test -- mininglamp.test.ts defaultAdapters.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git -C .worktrees/vibe-monitor add apps/usage-daemon/src/adapters/mininglamp.ts apps/usage-daemon/src/defaultAdapters.ts apps/usage-daemon/tests/mininglamp.test.ts apps/usage-daemon/tests/defaultAdapters.test.ts
git -C .worktrees/vibe-monitor commit -m "feat: add mininglamp source adapter"
```

## Task 3: Materialize Last-Five-Hours History For The Renderer

**Files:**
- Modify: `.worktrees/vibe-monitor/apps/usage-daemon/src/storage/db.ts`
- Modify: `.worktrees/vibe-monitor/apps/usage-daemon/src/storage/materializedState.ts`
- Test: `.worktrees/vibe-monitor/apps/usage-daemon/tests/storage.test.ts`

- [ ] **Step 1: Write the failing storage test for history output**

```ts
expect(materialized.historyWindow).toBe('last_5_hours');
expect(materialized.history['claude-code-official']).toHaveLength(2);
expect(materialized.history['mininglamp'][0].kind).toBe('usd');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --dir .worktrees/vibe-monitor --filter @vibe-monitor/usage-daemon test -- storage.test.ts`
Expected: FAIL because materialized state currently writes only `generatedAt` and `sources`.

- [ ] **Step 3: Add a DB reader for recent refresh history**

```ts
export function readRecentHistory(storage: Storage, sinceIso: string): Array<{
  sourceId: string;
  recordedAt: string;
  snapshot: SourceSnapshot;
}> {
  const rows = storage.db
    .prepare(`SELECT source_id, recorded_at, snapshot_json FROM refresh_history WHERE recorded_at >= ? ORDER BY recorded_at ASC`)
    .all(sinceIso) as Array<{ source_id: string; recorded_at: string; snapshot_json: string }>;

  return rows.map((row) => ({
    sourceId: row.source_id,
    recordedAt: row.recorded_at,
    snapshot: JSON.parse(row.snapshot_json) as SourceSnapshot
  }));
}
```

- [ ] **Step 4: Write history into `materializedState`**

```ts
writeMaterializedState(dataDir, snapshots, {
  generatedAt,
  historyWindow: 'last_5_hours',
  history
});
```

- [ ] **Step 5: Build source-specific history values**

```ts
const value = sourceId === 'mininglamp'
  ? snapshot.usedAmount ?? 0
  : snapshot.usagePercent ?? 0;

const kind = sourceId === 'mininglamp' ? 'usd' : 'percent';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `corepack pnpm --dir .worktrees/vibe-monitor --filter @vibe-monitor/usage-daemon test -- storage.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git -C .worktrees/vibe-monitor add apps/usage-daemon/src/storage/db.ts apps/usage-daemon/src/storage/materializedState.ts apps/usage-daemon/tests/storage.test.ts
git -C .worktrees/vibe-monitor commit -m "feat: materialize recent source history"
```

## Task 4: Lock The Desktop Interaction With Failing Tests

**Files:**
- Modify: `.worktrees/vibe-monitor/apps/desktop/src/App.test.tsx`

- [ ] **Step 1: Replace the current hover/list fixture with a three-source fixed fixture**

```ts
expect(screen.getByText('Claude Code')).toBeTruthy();
expect(screen.getByText('OpenAI Codex')).toBeTruthy();
expect(screen.getByText('mininglamp')).toBeTruthy();
expect(screen.getByText('$59.81')).toBeTruthy();
```

- [ ] **Step 2: Add a click-expand test**

```ts
fireEvent.click(screen.getByRole('button', { name: /usage monitor/i }));
expect(screen.getByText('Last 5 hours')).toBeTruthy();
expect(screen.getByText('Today usage')).toBeTruthy();
```

- [ ] **Step 3: Run test to verify it fails**

Run: `corepack pnpm --dir .worktrees/vibe-monitor --filter @vibe-monitor/desktop test -- App.test.tsx`
Expected: FAIL because the current UI still renders a generic list and expands on hover.

- [ ] **Step 4: Commit the red test only**

```bash
git -C .worktrees/vibe-monitor add apps/desktop/src/App.test.tsx
git -C .worktrees/vibe-monitor commit -m "test: lock three-source click-expand monitor"
```

## Task 5: Rebuild The Desktop Renderer Around The Approved Layout

**Files:**
- Create: `.worktrees/vibe-monitor/apps/desktop/src/components/CompactStrip.tsx`
- Create: `.worktrees/vibe-monitor/apps/desktop/src/components/ExpandedMonitor.tsx`
- Create: `.worktrees/vibe-monitor/apps/desktop/src/components/charts/Sparkline.tsx`
- Modify: `.worktrees/vibe-monitor/apps/desktop/src/App.tsx`
- Modify: `.worktrees/vibe-monitor/apps/desktop/src/app.css`
- Modify: `.worktrees/vibe-monitor/apps/desktop/src/components/monitorUtils.ts`

- [ ] **Step 1: Replace hover state with click state in `App.tsx`**

```tsx
const [expanded, setExpanded] = useState(false);

<button
  type="button"
  className="monitor-trigger"
  onClick={() => setExpanded((current) => !current)}
>
  <CompactStrip state={state} />
</button>
```

- [ ] **Step 2: Render the expanded monitor conditionally**

```tsx
{expanded ? <ExpandedMonitor state={state} onClose={() => setExpanded(false)} /> : null}
```

- [ ] **Step 3: Add source-specific formatting helpers**

```ts
export function formatUsd(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '$0.00';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}
```

- [ ] **Step 4: Implement compact-strip rendering for only three sources**

```tsx
const ordered = ['claude-code-official', 'codex-official', 'mininglamp']
  .map((id) => state.sources.find((source) => source.sourceId === id))
  .filter((source): source is SourceSnapshot => Boolean(source));
```

- [ ] **Step 5: Implement the expanded cards**

```tsx
<section className="monitor-card mininglamp-card">
  <header>
    <h2>mininglamp</h2>
    <strong>{formatPercent(source.usagePercent)}</strong>
  </header>
  <div className="metric-grid">
    <article><span>Today usage</span><strong>{formatUsd(source.usedAmount)}</strong></article>
    <article><span>Current quota</span><strong>{formatUsd(source.totalAmount)}</strong></article>
  </div>
</section>
```

- [ ] **Step 6: Implement lightweight chart rendering from materialized history**

```tsx
<Sparkline
  points={state.history['claude-code-official'] ?? []}
  kind="line"
/>
```

- [ ] **Step 7: Rewrite `app.css` to match the approved reference**

```css
.monitor-trigger {
  display: block;
  width: 100%;
  border: 0;
  background: transparent;
}

.compact-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `corepack pnpm --dir .worktrees/vibe-monitor --filter @vibe-monitor/desktop test -- App.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git -C .worktrees/vibe-monitor add apps/desktop/src/App.tsx apps/desktop/src/app.css apps/desktop/src/components/CompactStrip.tsx apps/desktop/src/components/ExpandedMonitor.tsx apps/desktop/src/components/charts/Sparkline.tsx apps/desktop/src/components/monitorUtils.ts
git -C .worktrees/vibe-monitor commit -m "feat: rebuild desktop monitor for three sources"
```

## Task 6: End-To-End Verification And Documentation Sync

**Files:**
- Modify: `dev-docs/BACKLOG.md`
- Modify: `dev-docs/DONE.md`
- Modify: `project-docs/desktop.md`
- Modify: `project-docs/usage-daemon.md`

- [ ] **Step 1: Run the shared, daemon, and desktop suites**

Run:

```bash
corepack pnpm --dir .worktrees/vibe-monitor --filter @vibe-monitor/shared test
corepack pnpm --dir .worktrees/vibe-monitor --filter @vibe-monitor/usage-daemon test
corepack pnpm --dir .worktrees/vibe-monitor --filter @vibe-monitor/desktop test
```

Expected: PASS in all three packages

- [ ] **Step 2: Start the daemon and shell for visual inspection**

Run:

```bash
cd .worktrees/vibe-monitor
VIBE_MONITOR_RUNTIME_DIR=$PWD corepack pnpm dev:daemon
PATH="$HOME/.cargo/bin:$PATH" VIBE_MONITOR_RUNTIME_DIR=$PWD corepack pnpm dev:shell
```

Expected: compact strip visible; click expands the approved three-card layout

- [ ] **Step 3: Move the active dev-doc entries from backlog to done**

```md
| shared | [扩展 materialized history 契约](./shared/2026-04-10-materialized-history-contract.md) | 2026-04-10 |
| usage-daemon | [接入 mininglamp 与最近历史物化](./usage-daemon/2026-04-10-mininglamp-and-history-materialization.md) | 2026-04-10 |
| desktop | [三来源点击展开监控器 UI 改造](./desktop/2026-04-10-three-source-click-expand-ui.md) | 2026-04-10 |
```

- [ ] **Step 4: Commit**

```bash
git add dev-docs/BACKLOG.md dev-docs/DONE.md project-docs/desktop.md project-docs/usage-daemon.md
git commit -m "docs: close out three-source monitor implementation"
```

## Self-Review

### Spec Coverage

- fixed three-source scope: covered by Tasks 2 and 5
- click-expand interaction: covered by Tasks 4 and 5
- `mininglamp` USD integration: covered by Task 2
- `last_5_hours` local history: covered by Tasks 1 and 3
- desktop chart usage: covered by Task 5
- failure handling and last-good preservation: covered by Tasks 2 and 3

### Placeholder Scan

- No `TBD`, `TODO`, or deferred “implement later” language in the task steps
- Every task references exact file paths and concrete commands

### Type Consistency

- `historyWindow` is fixed to `last_5_hours` across shared contract, daemon output, and desktop usage
- `mininglamp` is the canonical third source id in all tasks
- history points use `recordedAt`, `value`, and `kind` consistently
