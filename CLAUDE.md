# Vibe Usage Monitor Agent Guide

## 项目概述

`vibe-usage-monitor` 是一个面向 vibe coding 来源的本地优先用量监控项目。目标产品由以下部分组成：

- 悬浮桌面渲染层
- 本地 usage daemon
- 用于浏览器型采集的 browser worker
- 共享快照契约

当前确认的产品方向是固定三来源、点击展开的监控器，覆盖 `Claude Code`、`OpenAI Codex` 和 `mininglamp`。

## 常用命令

安装依赖：

```bash
corepack pnpm install
```

运行当前测试：

```bash
corepack pnpm test
```

## 架构摘要

- `desktop`：悬浮壳层与展示界面
- `usage-daemon`：刷新调度、归一化、持久化与 materialized state 输出
- `browser-worker`：为需要会话型采集的来源提供隔离浏览器能力
- `shared`：快照与 materialized state 的 Zod 契约

架构总览以 [docs/architecture.md](/Users/brding/projects/LLMProjects/cc_usage/docs/architecture.md) 为准。

## 模块结构

- [project-docs/desktop.md](/Users/brding/projects/LLMProjects/cc_usage/project-docs/desktop.md)
- [project-docs/usage-daemon.md](/Users/brding/projects/LLMProjects/cc_usage/project-docs/usage-daemon.md)
- [project-docs/browser-worker.md](/Users/brding/projects/LLMProjects/cc_usage/project-docs/browser-worker.md)
- [project-docs/shared.md](/Users/brding/projects/LLMProjects/cc_usage/project-docs/shared.md)

## 设计原则

- 优先使用明确、归一化的数据契约，而不是把 UI 写成 provider 特例集合
- 来源不提供绝对额度时，不允许估算
- renderer 保持只读；抓取和归一化属于 daemon 与 worker
- 文档是产品的一部分，不是附属物

## 技术栈

- TypeScript
- pnpm workspaces
- Zod
- Vitest
- 工作分支中的运行时栈：Tauri、React、Vite、better-sqlite3、Playwright、Rust

## 文档入口

- 根入口：[README.md](/Users/brding/projects/LLMProjects/cc_usage/README.md)
- 导航页：[DOCS-INDEX.md](/Users/brding/projects/LLMProjects/cc_usage/DOCS-INDEX.md)
- 设计文档：[docs/](/Users/brding/projects/LLMProjects/cc_usage/docs)
- 模块文档：[project-docs/](/Users/brding/projects/LLMProjects/cc_usage/project-docs)
- 开发流程文档：[dev-docs/](/Users/brding/projects/LLMProjects/cc_usage/dev-docs)

## Development Doc Workflow (MANDATORY)

### 编码前 — 必须先创建开发文档

在对源文件进行功能开发、Bug 修复、重构之前，必须：

1. 确定变更所属模块（见 `dev-docs/` 下的模块目录）
2. 在 `dev-docs/<module>/` 下创建开发文档，命名格式 `YYYY-MM-DD-<slug>.md`
3. 在 `dev-docs/BACKLOG.md` 中添加该文档的索引条目
4. 开发文档必须包含：目标、涉及文件、方案、验收标准

**违反此规则直接开始编码是不允许的。**

### 编码后 — 必须更新文档索引

开发完成（代码 + 测试通过）后，必须：

1. 将开发文档状态改为「已完成」
2. 从 `dev-docs/BACKLOG.md` 移除该条目，添加到 `dev-docs/DONE.md`
3. 根据实际变更更新 `project-docs/<module>.md` 的功能说明

### 不适用的场景

以下操作无需创建开发文档：

- 纯文档修改（不涉及代码变更）
- 格式化、typo 修复等微小改动
- 配置文件调整
