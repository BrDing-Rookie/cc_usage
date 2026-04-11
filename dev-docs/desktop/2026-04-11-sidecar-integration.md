# Sidecar 合并为单程序包

- **状态**: 已完成
- **模块**: desktop, usage-daemon
- **创建日期**: 2026-04-11

## 目标

将 usage-daemon 作为 Tauri sidecar 打包，用户只需启动一个 `.app` 即可同时运行桌面界面和后台数据采集。

## 背景

当前 desktop 和 usage-daemon 是两个独立进程：
- desktop 通过 `dev:shell` 脚本启动 Tauri
- daemon 通过 `dev:daemon` 脚本单独启动
- 两者通过 `var/current-snapshots.json` 文件通信

用户需要分别启动两个进程才能正常使用，体验不佳。

## 涉及文件

### daemon 构建
- `apps/usage-daemon/package.json` — 添加 build 脚本（bun compile 或 esbuild bundle）
- `apps/usage-daemon/build.ts`（新建）— 构建脚本，将 daemon 编译为独立二进制或单文件 bundle

### Tauri 配置
- `apps/desktop/src-tauri/tauri.conf.json` — 添加 `bundle.externalBin` 配置
- `apps/desktop/src-tauri/Cargo.toml` — 添加 `tauri-plugin-shell` 依赖

### Rust 生命周期
- `apps/desktop/src-tauri/src/lib.rs` — 添加 sidecar 启动/关闭逻辑
- `apps/desktop/src-tauri/capabilities/default.json` — 添加 shell:allow-execute 权限

### 根配置
- `package.json` — 更新 dev/build 脚本

## 方案

### 1. Daemon 编译为独立二进制

使用 `bun build --compile` 将 daemon 编译为独立可执行文件：

```bash
bun build apps/usage-daemon/src/index.ts --compile --outfile apps/desktop/src-tauri/binaries/usage-daemon-aarch64-apple-darwin
```

二进制文件按 Tauri sidecar 约定放置在 `src-tauri/binaries/` 目录，带目标三元组后缀。

> 注意：若 `keytar`（native module）不兼容 bun compile，需改用 esbuild bundle + Node.js 运行时方案。

### 2. Tauri Sidecar 配置

```json
// tauri.conf.json
{
  "bundle": {
    "externalBin": ["binaries/usage-daemon"]
  }
}
```

添加 `tauri-plugin-shell` 到 Cargo.toml：
```toml
tauri-plugin-shell = "2"
```

### 3. Rust 生命周期管理

在 `lib.rs` 的 `setup` hook 中：
1. 设置 `VIBE_MONITOR_RUNTIME_DIR` 环境变量为 app data dir
2. 使用 `app.shell().sidecar("usage-daemon")` 启动 daemon
3. 在 app exit 时终止 daemon 进程

```rust
use tauri_plugin_shell::ShellExt;

.setup(|app| {
    let data_dir = app.path().app_data_dir()?;
    let (mut rx, child) = app.shell()
        .sidecar("usage-daemon")
        .env("VIBE_MONITOR_RUNTIME_DIR", data_dir.to_str().unwrap())
        .spawn()?;
    // store child handle for cleanup
    tray::setup_tray(app)?;
    Ok(())
})
```

### 4. 权限配置

更新 `capabilities/default.json`：
```json
{
  "permissions": [
    "core:default",
    "shell:allow-execute",
    "shell:allow-spawn"
  ]
}
```

## 验收标准

- [ ] `tauri build` 生成的 .app 包含 daemon sidecar 二进制
- [ ] 启动 .app 后 daemon 自动启动采集数据
- [ ] 退出 .app 后 daemon 进程自动终止
- [ ] `var/current-snapshots.json` 正确写入并可被 desktop 读取
- [ ] 不再需要手动启动 daemon
