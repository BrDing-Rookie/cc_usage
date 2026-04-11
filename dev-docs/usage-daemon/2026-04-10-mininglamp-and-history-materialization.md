# 接入 mininglamp 与最近历史物化

> 模块: `usage-daemon`
> 创建日期: 2026-04-10
> 状态: 已完成
> 关联计划: `docs/superpowers/plans/2026-04-10-three-source-click-expand-usage-monitor-implementation.md`

## 目标

将当前第三来源从占位的 `micc-api` 替换为真实的 `mininglamp`，并让 daemon 为桌面端产出 `last_5_hours` 历史序列。

## 涉及文件

- `.worktrees/vibe-monitor/apps/usage-daemon/src/adapters/mininglamp.ts` — 新建真实的 `mininglamp` adapter
- `.worktrees/vibe-monitor/apps/usage-daemon/src/defaultAdapters.ts` — 更新默认来源注册逻辑
- `.worktrees/vibe-monitor/apps/usage-daemon/src/storage/db.ts` — 读取最近刷新历史
- `.worktrees/vibe-monitor/apps/usage-daemon/src/storage/materializedState.ts` — 输出历史序列
- `.worktrees/vibe-monitor/apps/usage-daemon/tests/defaultAdapters.test.ts` — 更新来源列表断言
- `.worktrees/vibe-monitor/apps/usage-daemon/tests/storage.test.ts` — 增加 materialized history 断言
- `.worktrees/vibe-monitor/apps/usage-daemon/tests/mininglamp.test.ts` — 覆盖 URL 规范化和 USD 映射

## 方案

- 从 `MININGLAMP_BASE_URL` 和 `MININGLAMP_API_KEY` 读取配置
- 对 `MININGLAMP_BASE_URL` 去尾斜杠，避免 `//dashboard/...`
- 调用：
  - `/dashboard/billing/subscription`
  - `/dashboard/billing/usage`
- 将 `hard_limit_usd` 映射为总额度
- 将 `total_usage / 100` 映射为已用美元
- 从 `refresh_history` 读取最近 5 小时记录并压缩为 renderer 直接可用的序列

## 验收标准

- [x] 默认来源列表只包含 `claude-code-official`、`codex-official`、`mininglamp`
- [x] `mininglamp` 以美元数值写入快照
- [x] `MININGLAMP_BASE_URL` 末尾带 `/` 时仍能正确访问接口
- [x] materialized state 含 `last_5_hours` 历史序列
- [x] 失败时保留 last-good 状态

## 开发记录

### 2026-04-10

- 创建开发任务文档
- 完成 `mininglamp` adapter 与默认来源注册（commit: `abce2df`）
- 完成 `last_5_hours` 历史物化输出（commit: `9e91c32`）
