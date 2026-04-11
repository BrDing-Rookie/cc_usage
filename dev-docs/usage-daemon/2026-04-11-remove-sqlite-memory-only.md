# 去掉 SQLite，改为纯内存存储

- **状态**: 已完成
- **模块**: usage-daemon, shared
- **创建日期**: 2026-04-11

## 目标

移除 `better-sqlite3` 依赖和 `refresh_history` 表，去掉 5 小时历史窗口，改为纯内存 `Map<string, SourceSnapshot>` 存储实时快照，仅展示实时状态。

## 背景

当前 daemon 使用 SQLite (`better-sqlite3`) 持久化两张表：
- `current_sources`：当前各来源最新快照
- `refresh_history`：刷新历史记录

`materializedState.ts` 从 `refresh_history` 查询最近 5 小时数据，构建历史时间线写入 `current-snapshots.json`。

本次重构将这套持久化+历史机制全部移除，改为纯内存实时快照。

## 涉及文件

### shared 包（schema 变更）
- `packages/shared/src/schema.ts` — 移除 `materializedHistoryPointSchema`、`historyWindow` 字段、`history` 字段；`materializedStateSchema` 简化为只含 `generatedAt` + `sources`
- `packages/shared/src/index.ts` — 更新导出

### usage-daemon
- `apps/usage-daemon/src/storage/db.ts` — 整个文件重写：移除 SQLite，改为内存 Map
- `apps/usage-daemon/src/storage/materializedState.ts` — 简化：不再查询历史，直接写 sources JSON
- `apps/usage-daemon/src/config.ts` — 移除 `resolveDataFile`（SQLite 路径函数）
- `apps/usage-daemon/src/index.ts` — 移除 `openStorage`/`close`，使用内存 Map
- `apps/usage-daemon/package.json` — 移除 `better-sqlite3` 依赖

### desktop（适配新 schema）
- `apps/desktop/src-tauri/src/state_file.rs` — 更新默认空状态（移除 `historyWindow`、`history` 字段）

### 测试
- `apps/usage-daemon/tests/storage.test.ts` — 重写为内存存储测试
- `apps/usage-daemon/tests/e2e.test.ts` — 更新断言（不再校验 historyWindow/history）

## 方案

### 1. 简化 shared schema

```typescript
// materializedStateSchema 简化为：
export const materializedStateSchema = z.object({
  generatedAt: isoDateTime,
  sources: z.array(sourceSnapshotSchema),
});
```

移除 `materializedHistoryPointSchema` 和相关类型导出。

### 2. 替换 db.ts 为内存存储

```typescript
export type Storage = {
  snapshots: Map<string, SourceSnapshot>;
};

export function createStorage(): Storage {
  return { snapshots: new Map() };
}

export function persistCurrentSnapshots(storage: Storage, snapshots: SourceSnapshot[]): void {
  for (const s of snapshots) {
    storage.snapshots.set(s.sourceId, s);
  }
}

export function readCurrentSnapshots(storage: Storage): SourceSnapshot[] {
  return Array.from(storage.snapshots.values());
}
```

### 3. 简化 materializedState.ts

```typescript
export function writeMaterializedState(
  dataDir: string,
  snapshots: SourceSnapshot[],
  generatedAt: string = new Date().toISOString()
): void {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    join(dataDir, 'current-snapshots.json'),
    JSON.stringify({ generatedAt, sources: snapshots }, null, 2),
    'utf8'
  );
}
```

### 4. 更新 index.ts

- 在 `main()` 中创建一次 `Storage`，跨 interval 复用
- `runOnce` 不再 open/close SQLite

### 5. 更新 state_file.rs 默认状态

```rust
Ok(serde_json::json!({
    "generatedAt": "1970-01-01T00:00:00.000Z",
    "sources": []
}))
```

## 验收标准

- [ ] `better-sqlite3` 从 package.json 移除
- [ ] `var/usage-monitor.sqlite` 不再创建
- [ ] `current-snapshots.json` 只包含 `generatedAt` + `sources`，不含 `historyWindow`/`history`
- [ ] 所有 daemon 测试通过 (`corepack pnpm test:daemon`)
- [ ] desktop Rust 测试通过 (`cargo test` in src-tauri)
