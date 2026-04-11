# Usage Daemon

## 功能概述

usage daemon 是本地协调进程，负责刷新 provider 用量、归一化原始响应、保留 last-good 状态，并输出实时快照供 desktop 消费。

## 核心能力

- **刷新调度**：每 5 分钟执行一轮采集
- **归一化**：把异构 provider 响应映射成统一 `SourceSnapshot` 结构
- **内存存储**：使用 `Map<string, SourceSnapshot>` 存储实时快照，无持久化依赖
- **Sidecar 部署**：通过 `bun build --compile` 编译为独立二进制，作为 Tauri sidecar 随 desktop 自动启动

## 使用方式

daemon 是以下内容的事实来源：

- current source snapshots
- refresh health

当前已支持来源：

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
