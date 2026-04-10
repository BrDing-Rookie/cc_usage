# 计划：三来源点击展开用量监控器

## 目标

将监控器演进为一个固定三来源的产品，顶部为紧凑摘要条，点击后展开详细面板。

跟踪来源：

- `claude-code-official`
- `codex-official`
- `mininglamp`

## 已确认范围

- 紧凑条始终可见
- 展开由点击触发，不再使用 hover
- 展开面板固定渲染 3 张来源卡片
- `Claude Code` 与 `OpenAI Codex` 采用以百分比优先的展示逻辑
- `mininglamp` 采用美元格式展示额度与用量
- 当前激活视图的历史数据来自本地 `refresh_history`

## mininglamp 接入

- 环境变量：
  - `MININGLAMP_BASE_URL`
  - `MININGLAMP_API_KEY`
- 对 `MININGLAMP_BASE_URL` 去尾斜杠
- 请求：
  - `/dashboard/billing/subscription`
  - `/dashboard/billing/usage`
- 映射：
  - `hard_limit_usd` -> 总额度
  - `total_usage / 100` -> 已使用美元
  - `remaining = total - used`
  - `usagePercent = used / total * 100`

## UI 方向

### 紧凑条

- 固定 3 个 tile
- 每个 tile 显示来源图标、名称、主数值、进度线和百分比

### 展开面板

- 顶部包含标题、live 指示器、时间范围控件和关闭动作
- 为 `Claude Code`、`OpenAI Codex`、`mininglamp` 渲染纵向堆叠卡片
- `Claude Code` 与 `OpenAI Codex` 显示历史图表
- 本轮 `mininglamp` 不显示历史图表

## 数据与历史

materialized state 需要从仅包含当前快照，扩展为同时包含 `last_5_hours` 的轻量来源历史序列。

主历史指标：

- `Claude Code`：最适合作为主值的窗口百分比
- `OpenAI Codex`：可用时使用 usage percent
- `mininglamp`：已使用美元值

## 验收标准

- renderer 只展示这 3 个已确认来源
- 展开行为基于点击
- `mininglamp` 显示美元格式数值
- 历史数据来自本地，而不是伪造
- 来源刷新失败时保留 last-good 状态

## 资料来源

这份计划把最新确认的 redesign spec 纳入标准文档树。更早的设计与实施资料继续通过 [docs/archive/README.md](/Users/brding/projects/LLMProjects/cc_usage/docs/archive/README.md) 归档索引。
