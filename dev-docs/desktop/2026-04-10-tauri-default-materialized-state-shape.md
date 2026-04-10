# 修复 Tauri 默认 materialized state 形状

> 模块: `desktop`
> 创建日期: 2026-04-10
> 状态: 待开发

## 目标

当 `var/current-snapshots.json` 尚不存在时，Tauri 命令 `read_materialized_state` 返回的默认 JSON 需要与 `shared` 的 `MaterializedState` 契约一致（包含 `historyWindow` 与 `history`），避免 desktop 首次启动时出现 shape 不匹配。

## 涉及文件

- `apps/desktop/src-tauri/src/state_file.rs`

## 方案

- 默认返回值补齐：
  - `historyWindow: "last_5_hours"`
  - `history: {}`
- 增加 Rust 单测覆盖默认值包含新字段

## 验收标准

- [ ] 文件不存在时返回的 JSON 包含 `generatedAt`、`historyWindow`、`sources`、`history`
- [ ] Rust 单测覆盖默认返回值字段

## 开发记录

### 2026-04-10

- 创建开发任务文档，等待实施

