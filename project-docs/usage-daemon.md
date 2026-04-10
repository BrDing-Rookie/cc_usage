# Usage Daemon

## 功能概述

usage daemon 是本地协调进程，负责刷新 provider 用量、归一化原始响应、保留 last-good 状态，并输出 renderer 可消费的 materialized view。

## 核心能力

- **刷新调度**：按计划执行采集
- **归一化**：把异构 provider 响应映射成统一结构
- **持久化**：写入当前状态和刷新历史，供后续展示与分析使用

## 使用方式

daemon 是以下内容的事实来源：

- current source snapshots
- refresh health
- short-window history for charts

当前已支持三来源：

- `claude-code-official` (official API)
- `codex-official` (browser worker, Codex Cloud usage page)
- `mininglamp` (custom endpoint, USD quota/usage)

`mininglamp` 需要环境变量：

- `MININGLAMP_BASE_URL`
- `MININGLAMP_API_KEY`

## 当前限制

- 并不是所有 provider 都能提供精确绝对值
- 浏览器型采集仍依赖单独的 worker 支持，且需要用户先完成一次登录态准备

## 相关模块

- 依赖：`shared`、`browser-worker`
- 被依赖：`desktop`
