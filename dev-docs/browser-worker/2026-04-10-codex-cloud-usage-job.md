# Codex Cloud usage 抓取 job

> 模块: `browser-worker`
> 创建日期: 2026-04-10
> 状态: 已完成
> 关联计划: `docs/plan-three-source-click-expand-usage-monitor.md`

## 目标

为 `codex-official` 提供基于持久浏览器 profile 的抓取能力：导航到 Codex Cloud 用量页面并提取 `planName`、`usagePercent`、`resetAt`。

页面路径以 `chatgpt.com/codex/cloud/settings/usage` 为主。

## 涉及文件

- `.worktrees/vibe-monitor/apps/browser-worker/src/index.ts` — 支持 `codex-chatgpt-usage` provider 的真实浏览器抓取
- `.worktrees/vibe-monitor/apps/browser-worker/src/profileRegistry.ts` — 复用 profile 路径规则
- `.worktrees/vibe-monitor/apps/browser-worker/src/providers/codexChatgptUsage.ts` — 复用 HTML 解析逻辑

## 方案

- 输入 job：
  - `provider: "codex-chatgpt-usage"`
  - `runtimeDir`
  - `sourceId` (固定 `codex-official`)
  - `url` (默认 `https://chatgpt.com/codex/cloud/settings/usage`)
- 使用 Playwright `chromium.launchPersistentContext(profilePath, ...)` 打开持久 profile
- 访问 `url`，等待页面关键节点出现后读取 HTML
- 解析 HTML 并输出结构化结果

## 验收标准

- [x] 传入带 `runtimeDir` 的 job 时，能使用持久 profile 访问用量页面
- [x] 输出包含 `planName`、`usagePercent`、`resetAt`
- [x] 导航失败或解析失败时返回可诊断错误

## 开发记录

### 2026-04-10

- 创建开发任务文档
- 实施完成（commit: `3bdb3b9`）
