# 接入 Codex Cloud usage job

> 模块: `usage-daemon`
> 创建日期: 2026-04-10
> 状态: 已完成
> 关联计划: `docs/plan-three-source-click-expand-usage-monitor.md`

## 目标

把 `codex-official` 的采集策略明确为:

- 主路径: 通过 `browser-worker` 抓取 `https://chatgpt.com/codex/cloud/settings/usage`
- CLI `/status` 仅作为调试或手动兜底，不作为正式产品数据源

## 涉及文件

- `.worktrees/vibe-monitor/apps/usage-daemon/src/defaultAdapters.ts` — `codex-official` 刷新时调用 browser-worker
- `.worktrees/vibe-monitor/apps/usage-daemon/src/browser/workerClient.ts` — 复用现有 job runner
- `.worktrees/vibe-monitor/apps/usage-daemon/src/adapters/codexOfficial.ts` — 继续负责归一化输出
- `.worktrees/vibe-monitor/apps/usage-daemon/tests/defaultAdapters.test.ts` — 覆盖 job 调用路径

## 方案

- `buildCodexOfficialAdapter.refresh()` 内：
  - 读取 `~/.codex/auth.json` 作为账号/plan 元信息
  - 通过 `runBrowserJob` 发起 `codex-chatgpt-usage` job
  - 将 job 结果归一化为 `SourceSnapshot`
- 在测试里通过依赖注入 stub 掉 `runBrowserJob`，避免真实启动浏览器

## 验收标准

- [x] `codex-official` 快照优先使用 Codex Cloud usage 页面数据
- [x] 失败时走 `source_broken` 并保留 last-good (由 refreshLoop 实现)
- [x] 单测不依赖 Playwright 或真实网络

## 开发记录

### 2026-04-10

- 创建开发任务文档
- 实施完成（commit: `4913a1f`）
