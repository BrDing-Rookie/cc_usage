# 扩展 materialized history 契约

> 模块: `shared`
> 创建日期: 2026-04-10
> 状态: 已完成
> 关联计划: `docs/superpowers/plans/2026-04-10-three-source-click-expand-usage-monitor-implementation.md`

## 目标

为三来源点击展开监控器补齐共享数据契约，使 renderer 能读取 `last_5_hours` 的历史序列，而不需要自己查 SQLite。

## 涉及文件

- `.worktrees/vibe-monitor/packages/shared/src/schema.ts` — 新增历史点与历史窗口结构
- `.worktrees/vibe-monitor/packages/shared/src/index.ts` — 导出新增 schema 和类型
- `.worktrees/vibe-monitor/packages/shared/tests/schema.test.ts` — 为扩展后的 materialized state 加测试

## 方案

- 在现有 `materializedStateSchema` 上新增 `historyWindow` 和 `history`
- 为历史序列定义统一的点结构：`recordedAt`、`value`、`kind`
- `kind` 固定为 `percent` 或 `usd`
- 当前只支持 `last_5_hours`

## 验收标准

- [x] `materializedStateSchema` 支持携带 `last_5_hours` 历史数据
- [x] `shared` 包导出了新增 schema 和类型
- [x] `packages/shared/tests/schema.test.ts` 覆盖历史序列解析

## 开发记录

### 2026-04-10

- 创建开发任务文档
- 实施完成（commit: `2072178`）
