# Desktop

## 功能概述

desktop 模块是监控器的展示层。它负责从本地 materialized state 中渲染悬浮壳层、顶部紧凑条和展开后的详细视图。

## 核心能力

- **悬浮展示**：提供轻量但始终可见的监控界面
- **详情展开**：在紧凑态与详细态之间切换
- **状态消费**：读取归一化后的本地状态，而不承担 provider 抓取逻辑

## 使用方式

当前主要设计参考：

- [docs/plan-three-source-click-expand-usage-monitor.md](/Users/brding/projects/LLMProjects/cc_usage/docs/plan-three-source-click-expand-usage-monitor.md)

## 当前限制

- 该模块依赖 daemon 产出的 materialized state（包含 `last_5_hours` history）
- `codex-official` 的历史图表取决于浏览器型采集是否成功

## 相关模块

- 依赖：`usage-daemon`、`shared`
- 面向：最终使用悬浮监控器的用户
