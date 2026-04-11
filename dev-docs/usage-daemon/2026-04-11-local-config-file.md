# 本地配置文件机制

- **状态**: 进行中
- **模块**: shared, usage-daemon
- **创建日期**: 2026-04-11

## 目标

为项目添加本地 `config.json` 配置文件支持，允许用户通过配置文件（而非仅环境变量）设置来源凭证。

## 涉及文件

### shared 包
- `packages/shared/src/schema.ts` — 新增 `appConfigSchema` 和 `AppConfig` 类型
- `packages/shared/src/index.ts` — 导出新增的 schema 和类型

### usage-daemon
- `apps/usage-daemon/src/config.ts`（新建）— `loadConfig(runtimeDir)` 读取配置文件
- `apps/usage-daemon/src/defaultAdapters.ts` — 集成配置文件，优先级：环境变量 > config.json
- `apps/usage-daemon/tests/config.test.ts`（新建）— 配置加载测试
- `apps/usage-daemon/tests/defaultAdapters.test.ts` — 适配新的配置机制

## 方案

### 1. shared schema 扩展

新增 `appConfigSchema`，包含可选的 `mininglamp` 配置块（`baseUrl` + `apiKey`）。

### 2. daemon 配置读取

`loadConfig(runtimeDir)` 从 `{runtimeDir}/config.json` 读取配置：
- 文件不存在 → 返回 `{}`
- 文件格式错误 → stderr warning，返回 `{}`
- 使用 `appConfigSchema.safeParse()` 校验

### 3. defaultAdapters 集成

`buildDefaultAdapters` 内部调用 `loadConfig`，环境变量优先于配置文件。

## 验收标准

- [ ] `appConfigSchema` 正确校验合法/非法配置
- [ ] `loadConfig` 文件缺失时 graceful 返回空对象
- [ ] `loadConfig` 文件格式错误时 log warning 并返回空对象
- [ ] 环境变量覆盖配置文件中的值
- [ ] 所有测试通过
