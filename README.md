# Vibe Usage Monitor

这是一个本地优先的桌面用量监控项目，用于追踪多种 vibe coding 来源的额度、用量与刷新健康状态。

## 仓库内容

项目采用 monorepo 结构，围绕 4 个核心模块组织：

- `desktop`：macOS 悬浮壳层与渲染界面
- `usage-daemon`：本地刷新进程，负责抓取、归一化与持久化状态
- `browser-worker`：为缺少稳定 API 的来源提供隔离的浏览器采集能力
- `shared`：统一的快照 Schema 与共享类型

当前主分支主要包含共享契约包与标准化文档树。系统架构和当前产品方向可从 [DOCS-INDEX.md](/Users/brding/projects/LLMProjects/cc_usage/DOCS-INDEX.md) 进入。

## 快速开始

安装依赖：

```bash
corepack pnpm install
```

运行当前测试：

```bash
corepack pnpm test
```

## 目录说明

- [docs/](/Users/brding/projects/LLMProjects/cc_usage/docs) — 架构、接口、开发说明、当前计划和历史归档
- [project-docs/](/Users/brding/projects/LLMProjects/cc_usage/project-docs) — 模块说明文档
- [dev-docs/](/Users/brding/projects/LLMProjects/cc_usage/dev-docs) — 开发任务跟踪文档
- [packages/shared/](/Users/brding/projects/LLMProjects/cc_usage/packages/shared) — 共享 Zod Schema 与类型
- [schemas/](/Users/brding/projects/LLMProjects/cc_usage/schemas) — 数据契约导出位置与说明

## 当前关注方向

当前已确认的产品方向是“三数据源、点击展开”的监控器改版，固定跟踪：

- `claude-code-official`
- `codex-official`
- `mininglamp`

详见 [docs/plan-three-source-click-expand-usage-monitor.md](/Users/brding/projects/LLMProjects/cc_usage/docs/plan-three-source-click-expand-usage-monitor.md)。
