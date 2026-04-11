# 本地配置文件机制

- **状态**: 已完成
- **模块**: shared, usage-daemon, desktop
- **创建日期**: 2026-04-11

## 目标

为项目添加本地 `config.json` 配置文件支持，通过 Settings UI 配置来源凭证。

## 涉及文件

### shared 包
- `packages/shared/src/schema.ts` — 新增 `appConfigSchema` 和 `AppConfig` 类型
- `packages/shared/src/index.ts` — 导出新增的 schema 和类型

### usage-daemon
- `apps/usage-daemon/src/config.ts`（新建）— `loadConfig(runtimeDir)` 读取配置文件
- `apps/usage-daemon/src/defaultAdapters.ts` — 集成配置文件，优先级：config.json > 环境变量

### desktop
- `apps/desktop/src-tauri/src/lib.rs` — `read_app_config` / `write_app_config` / `restart_daemon` 命令
- `apps/desktop/src-tauri/src/tray.rs` — Settings 菜单项
- `apps/desktop/src/components/SettingsWindow.tsx`（新建）— 设置界面

## 验收标准

- [x] `appConfigSchema` 正确校验合法/非法配置
- [x] `loadConfig` 文件缺失时 graceful 返回空对象
- [x] `loadConfig` 文件格式错误时 log warning 并返回空对象
- [x] config.json 优先于环境变量
- [x] Settings UI 保存后自动重启 daemon
- [x] 所有测试通过
