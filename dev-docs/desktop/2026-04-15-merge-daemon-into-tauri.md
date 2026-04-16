# 合并 usage-daemon 到 Tauri 进程

- **状态**: 已完成
- **模块**: desktop, usage-daemon
- **创建日期**: 2026-04-15

## 目标

将 usage-daemon 的刷新逻辑从独立 Node.js sidecar 进程迁移到 Tauri Rust 进程内，消除多进程竞争问题。

## 涉及文件

- `apps/desktop/src-tauri/src/usage/` — 新建 Rust 模块（adapters, refresh, config, types）
- `apps/desktop/src-tauri/src/lib.rs` — 移除 sidecar，集成内存 state
- `apps/desktop/src-tauri/src/tray.rs` — 从内存读 state
- `apps/desktop/src-tauri/Cargo.toml` — 添加 reqwest, tokio-util
- `apps/desktop/src-tauri/tauri.conf.json` — 移除 sidecar 配置

## 验收标准

- 单进程运行，无 sidecar
- tray 正确显示用量
- Settings 切换网关后正确刷新
- cargo check + pnpm test 通过
