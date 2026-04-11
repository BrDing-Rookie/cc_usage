# Vibe Usage Monitor

macOS 状态栏用量监控工具，实时追踪 vibe coding 来源的额度与用量。以 tray icon + popover 形式运行，不在程序坞显示图标，单个 `.app` 即包含完整功能。

## 特性

- **状态栏常驻**：动态环形图标显示用量百分比（蓝色 ≤80%，红色 >80%）
- **Popover 展示**：hover/click 查看实时用量详情，支持固定模式
- **无 Dock 图标**：以 macOS Accessory 模式运行，仅状态栏可见
- **单程序包**：daemon 作为 sidecar 自动随应用启动/退出，无需手动管理
- **纯内存存储**：无 SQLite 依赖，轻量快速

## 仓库结构

项目采用 pnpm monorepo 结构：

- `apps/desktop`：Tauri 2 桌面端（Rust 后端 + React 前端）
- `apps/usage-daemon`：数据采集 daemon（定时刷新、归一化、输出实时快照）
- `apps/browser-worker`：为需要会话型采集的来源提供隔离浏览器能力
- `packages/shared`：统一的 Zod Schema 与共享类型

## 快速开始

安装依赖：

```bash
corepack pnpm install
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `MININGLAMP_BASE_URL` | 是 | Mininglamp API 基础地址（如 `https://api.example.com`） |
| `MININGLAMP_API_KEY` | 是 | Mininglamp API 密钥 |
| `VIBE_MONITOR_RUNTIME_DIR` | 否 | 运行时目录（默认当前工作目录，打包后为 app data dir） |

daemon 在启动时检测环境变量，仅当 `MININGLAMP_BASE_URL` 和 `MININGLAMP_API_KEY` 都存在时才注册 mininglamp 适配器。缺失时 daemon 正常运行但不采集数据。

开发模式下可创建 `.env` 文件或在命令前设置：

```bash
MININGLAMP_BASE_URL=https://api.example.com MININGLAMP_API_KEY=your-key corepack pnpm dev:shell
```

## 打包与运行

一条命令打包为 macOS `.app`：

```bash
corepack pnpm build
```

产物位于 `apps/desktop/src-tauri/target/release/bundle/macos/Vibe Usage Monitor.app`。

打包流程自动执行：
1. `bun build --compile` 编译 daemon 为独立二进制（sidecar）
2. `vite build` 构建前端静态资源
3. `tauri build --bundles app` 编译 Rust + 打包为 `.app`

## 开发

启动开发模式（带热更新）：

```bash
corepack pnpm dev:shell
```

单独启动 daemon（调试用）：

```bash
corepack pnpm dev:daemon
```

运行测试：

```bash
corepack pnpm test
```

## 数据流

```
adapter.refresh() → Map<sourceId, SourceSnapshot> → current-snapshots.json → Tauri 读取渲染
```

- daemon 每 5 分钟刷新一次，结果保存在内存 Map 中
- 同时写入 `var/current-snapshots.json` 供 desktop 端轮询
- tray icon 每 5 秒读取 JSON 更新环形图标和 tooltip

## 运行时产物

通过 `VIBE_MONITOR_RUNTIME_DIR` 环境变量指定运行时目录（默认当前目录）：

- `var/current-snapshots.json`：实时快照状态文件
- `browser-profiles/<source-id>/`：浏览器采集 profile

## 文档

- [DOCS-INDEX.md](DOCS-INDEX.md) — 文档导航页
- [docs/](docs) — 架构与设计文档
- [project-docs/](project-docs) — 模块说明文档
- [dev-docs/](dev-docs) — 开发任务跟踪
