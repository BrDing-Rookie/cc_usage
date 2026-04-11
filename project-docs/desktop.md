# Desktop

## 功能概述

desktop 模块是监控器的展示层，以 macOS 状态栏 tray icon + popover 的形式提供轻量化实时用量监控。应用以 `LSUIElement` 模式运行，不在程序坞（Dock）显示图标。

## 核心能力

- **状态栏 Tray Icon**：显示动态环形用量图标，颜色随用量变化（蓝色 ≤80%，红色 >80%）
- **Popover 展示**：hover/click 展示实时用量详情，支持固定（pin）模式
- **Sidecar 集成**：通过 `tauri-plugin-shell` 自动管理 usage-daemon 生命周期，启动时 spawn、退出时 kill，用户只需打开一个 `.app`
- **状态消费**：读取 daemon 产出的 `current-snapshots.json` 实时快照，不承担 provider 抓取逻辑
- **无 Dock 图标**：通过 `LSUIElement = true` 隐藏程序坞图标，仅保留状态栏入口

## 使用方式

当前主要设计参考：

- [docs/plan-three-source-click-expand-usage-monitor.md](/Users/brding/projects/LLMProjects/cc_usage/docs/plan-three-source-click-expand-usage-monitor.md)

## 当前限制

- 该模块依赖 daemon 产出的实时快照
- `codex-official` 数据取决于浏览器型采集是否成功

## 相关模块

- 依赖：`usage-daemon`、`shared`
- 面向：最终使用监控器的用户
