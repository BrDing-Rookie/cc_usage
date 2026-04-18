# Desktop

## 功能概述

desktop 模块是监控器的展示层，以 macOS 状态栏 tray icon + popover 的形式提供轻量化实时用量监控。应用以 `LSUIElement` 模式运行，不在程序坞（Dock）显示图标。

## 核心能力

- **状态栏 Tray Icon**：固定展示一个 pinned account 的环形用量图标，其他 account 超过 80% 时在中心叠加红色 `!`
- **Popover 展示**：点击状态栏后打开双 gateway 概览，点击某个 gateway 进入该 gateway 下的 account 详情；popover 尺寸已扩展并支持滚动回退
- **设置页**：支持在 `llm-gateway` 与 `vibe` 下管理多个 account，并选择状态栏固定展示的 account
- **状态消费**：读取 daemon 产出的 `gateways + accounts` materialized state，不承担 provider 抓取逻辑
- **无 Dock 图标**：通过 `LSUIElement = true` 隐藏程序坞图标，仅保留状态栏入口

## 使用方式

当前主要设计参考：

- [docs/superpowers/specs/2026-04-18-dual-gateway-multi-account-monitor-design.md](/Users/brding/projects/LLMProjects/cc_usage/docs/superpowers/specs/2026-04-18-dual-gateway-multi-account-monitor-design.md)

## 当前限制

- 该模块依赖 daemon 产出的实时快照
- 状态栏只展示一个 pinned account，不显示跨 gateway 合并总值

## 相关模块

- 依赖：`usage-daemon`、`shared`
- 面向：最终使用监控器的用户
