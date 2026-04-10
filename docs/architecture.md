# 架构设计

## 系统概览

Vibe Usage Monitor 是一个本地优先的桌面工具，用于采集并展示多个 provider 来源的用量与健康状态。目标运行时分为 4 个部分：

- `desktop`：悬浮壳层与渲染界面
- `usage-daemon`：定时刷新与归一化
- `browser-worker`：隔离的浏览器型采集层
- `shared`：统一快照与 materialized state 契约

## 核心流程

```text
source adapters
  -> normalization
  -> local persistence
  -> materialized state
  -> desktop renderer
```

## 模块概览

### Desktop

desktop 层负责展示紧凑条与点击展开的大面板。它只读取 materialized state，不直接承担 provider 抓取逻辑。

### Usage Daemon

daemon 是系统协调者，负责：

- 调度刷新
- 调用来源适配器
- 刷新失败时保留 last-good 状态
- 写入当前快照和历史数据

### Browser Worker

browser worker 用于那些无法仅靠稳定 API 或本地状态可靠采集的来源，并把浏览器会话与 daemon 隔离开。

### Shared Contract

shared 包定义：

- `source snapshots`
- `quota windows`
- `alert kinds`
- `materialized state` 结构

## 当前产品方向

当前确认的近期方向是“三来源、点击展开”的监控器：

- `claude-code-official`
- `codex-official`
- `mininglamp`

标准计划文档见：[plan-three-source-click-expand-usage-monitor.md](/Users/brding/projects/LLMProjects/cc_usage/docs/plan-three-source-click-expand-usage-monitor.md)

## 当前分支现状

当前仓库根目录主要暴露工作区骨架和共享 schema 包。部分运行时实现可能先在 feature branch 或 worktree 中推进，再回合并到 `main`。这里的文档描述的是目标架构，而不仅仅是当前分支已落地的文件集合。
