# Vibe Usage Monitor

macOS 状态栏用量监控工具，实时追踪 LLM 网关的额度与花费。以 tray icon + popover 形式运行，不在程序坞显示图标，单个 `.app` 即包含完整功能。

## 特性

- **双网关支持**：内置 LLM Gateway (`llm-gateway.mlamp.cn`) 和 Vibe (`vibe.deepminer.ai`) 两个预设网关，一键切换
- **状态栏常驻**：动态环形图标显示用量百分比（蓝色 ≤80%，红色 >80%）
- **Popover 展示**：hover/click 查看实时用量详情（已用 / 额度 / 百分比），支持固定模式
- **无 Dock 图标**：以 macOS Accessory 模式运行，仅状态栏可见
- **单程序包**：daemon 作为 sidecar 自动随应用启动/退出，无需手动管理
- **纯内存存储**：无 SQLite 依赖，轻量快速

## 支持的网关

| 网关 | 域名 | 采集方式 | 数据 |
|------|------|---------|------|
| LLM Gateway | `llm-gateway.mlamp.cn` | `/dashboard/billing/subscription` + `/usage` | 额度、已用 (USD) |
| Vibe | `vibe.deepminer.ai` | `/key/info` (LiteLLM) | 额度、已用、key 别名、重置时间 |

## 仓库结构

项目采用 pnpm monorepo 结构：

- `apps/desktop`：Tauri 2 桌面端（Rust 后端 + React 前端）
- `apps/usage-daemon`：数据采集 daemon（定时刷新、归一化、输出实时快照）
- `packages/shared`：Zod Schema、共享类型与网关预设常量

## 快速开始

安装依赖：

```bash
corepack pnpm install
```

## 配置

首次启动后，右键状态栏图标 → **Settings...** 打开设置窗口：

1. 选择网关（LLM Gateway / Vibe）
2. 填入对应的 API Key
3. 点击 Save，等待验证通过

两个网关的 API Key 均会持久化存储，切换网关时无需重新填写。仅当前选中的网关会被采集用量。

配置文件位置：`~/Library/Application Support/com.brding.vibe-usage-monitor/config.json`

## 打包与发布

```bash
# 1. 生产构建
corepack pnpm build

# 2. Ad-hoc 签名
codesign --force --deep --sign - "apps/desktop/src-tauri/target/release/bundle/macos/Vibe Usage Monitor.app"

# 3. 创建美化 DMG（需 brew install create-dmg）
create-dmg \
  --volname "Vibe Usage Monitor" \
  --window-pos 200 120 --window-size 660 400 \
  --icon-size 100 --icon "Vibe Usage Monitor.app" 180 190 \
  --app-drop-link 480 190 \
  --hide-extension "Vibe Usage Monitor.app" \
  Vibe-Usage-Monitor.dmg \
  "apps/desktop/src-tauri/target/release/bundle/macos/Vibe Usage Monitor.app"
```

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
config.json → buildDefaultAdapters(activeGateway) → adapter.refresh()
  → Map<sourceId, SourceSnapshot> → var/current-snapshots.json
  → Tauri IPC / Tray 轮询 → Popover 渲染
```

- daemon 每 **5 分钟**刷新一次，启动时立即执行首次采集
- HTTP 请求超时 8 秒，失败时保留 last-good 快照并标记错误状态
- tray icon 每 5 秒读取快照文件更新环形图标和 tooltip

## 文档

- [DOCS-INDEX.md](DOCS-INDEX.md) — 文档导航页
- [docs/](docs) — 架构与设计文档
- [project-docs/](project-docs) — 模块说明文档
- [dev-docs/](dev-docs) — 开发任务跟踪
