# 修复状态栏网关显示跳变 + PID 文件防护

- **状态**: 已完成
- **模块**: usage-daemon, desktop
- **创建日期**: 2026-04-15

## 目标

修复后台运行时状态栏在 mininglamp/litellm/llm-gateway 之间跳变的 bug，并从代码层面防止多 daemon 实例竞争写入。

## 问题分析

**根因**：3 个来自 `tauri dev` 的僵尸 debug daemon（4月13日启动）一直在后台运行，与生产 daemon 共用同一个数据目录。它们每 5 分钟各自刷新并全量覆盖 `current-snapshots.json`，导致状态栏跳变。

**附带修复**：移除了 `migrateConfig` 中 `activeGateway` 的自动推断逻辑（防止配置丢失时默认切到 vibe）。

## 涉及文件

- `apps/usage-daemon/src/pidGuard.ts` — 新建，PID 文件守护
- `apps/usage-daemon/src/index.ts` — 调用 PID guard
- `apps/usage-daemon/src/storage/materializedState.ts` — 原子写入
- `apps/usage-daemon/src/config.ts` — 移除推断逻辑（已完成）
- `apps/usage-daemon/tests/config.test.ts` — 更新测试（已完成）
- `apps/desktop/src-tauri/src/lib.rs` — restart_daemon 清理 PID 文件

## 验收标准

- daemon 启动时写入 PID 文件，检测到旧 daemon 存活则杀掉旧进程
- state 文件使用 atomic write（tmp + rename）
- 所有测试通过
