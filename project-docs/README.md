# Vibe Usage Monitor 项目说明

这是一个本地优先的桌面监控项目，用于追踪多种 vibe coding 来源的用量与刷新健康状态。

## 核心流程

来源适配器抓取 provider 状态后，将其归一化为共享快照契约，写入本地持久化层，再产出 materialized view 供桌面 renderer 消费。

## 模块索引

| 模块 | 说明 | 文档 |
|------|------|------|
| desktop | 紧凑条和展开面板的桌面展示层 | [desktop.md](./desktop.md) |
| usage-daemon | 刷新调度、归一化、持久化与历史序列输出 | [usage-daemon.md](./usage-daemon.md) |
| browser-worker | 为缺少稳定 API 的来源提供隔离浏览器采集 | [browser-worker.md](./browser-worker.md) |
| shared | 共享快照 schema 与类型导出 | [shared.md](./shared.md) |
