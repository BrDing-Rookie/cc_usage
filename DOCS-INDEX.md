# Vibe Usage Monitor 文档导航

> 本项目采用三层文档树，方便不同读者快速定位合适层级的信息。

## 文档树

```text
cc_usage/
├── README.md
├── CLAUDE.md
├── AGENTS.md
├── DOCS-INDEX.md
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── development.md
│   ├── plan-three-source-click-expand-usage-monitor.md
│   └── archive/
│       └── README.md
│
├── project-docs/
│   ├── README.md
│   ├── desktop.md
│   ├── usage-daemon.md
│   ├── browser-worker.md
│   └── shared.md
│
├── dev-docs/
│   ├── README.md
│   ├── BACKLOG.md
│   ├── DONE.md
│   ├── desktop/
│   │   └── README.md
│   ├── usage-daemon/
│   │   └── README.md
│   ├── browser-worker/
│   │   └── README.md
│   └── shared/
│       └── README.md
│
└── schemas/
    └── README.md
```

## 各层定位

| 层级 | 目录 | 读者 | 内容 |
|------|------|------|------|
| 入口 | `README.md` / `CLAUDE.md` | 所有人 | 项目概览与工作流 |
| 设计文档 | `docs/` | 架构师、核心开发者 | 架构、接口、开发规则、当前计划 |
| 模块说明 | `project-docs/` | 开发者、使用者 | 模块职责、能力与限制 |
| 开发文档 | `dev-docs/` | 开发者 | 任务跟踪与实施记录 |
| 数据契约 | `schemas/` | 开发者、集成方 | 数据结构说明与 schema 入口 |

## 快速链接

### 我想看当前确认的产品方向

→ [docs/plan-three-source-click-expand-usage-monitor.md](/Users/brding/projects/LLMProjects/cc_usage/docs/plan-three-source-click-expand-usage-monitor.md)

### 我想看系统架构

→ [docs/architecture.md](/Users/brding/projects/LLMProjects/cc_usage/docs/architecture.md)

### 我想看接口和数据契约

→ [docs/api.md](/Users/brding/projects/LLMProjects/cc_usage/docs/api.md)

### 我想看开发环境和规则

→ [docs/development.md](/Users/brding/projects/LLMProjects/cc_usage/docs/development.md)

### 我想看模块说明

→ [project-docs/README.md](/Users/brding/projects/LLMProjects/cc_usage/project-docs/README.md)

### 我想开始或跟踪开发任务

→ [dev-docs/README.md](/Users/brding/projects/LLMProjects/cc_usage/dev-docs/README.md)

### 我想看历史设计资料

→ [docs/archive/README.md](/Users/brding/projects/LLMProjects/cc_usage/docs/archive/README.md)
