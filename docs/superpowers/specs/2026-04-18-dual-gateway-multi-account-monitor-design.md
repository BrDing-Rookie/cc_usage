# 双网关多账户监控设计

## 概述

本设计将当前的单网关监控器调整为固定双网关产品。

本次范围只包含：

- `llm-gateway`
- `vibe`

每个 gateway 下可以配置多个 API Key。每个 key 都被视为一个独立的被监控账户。

产品目标如下：

- 默认概览同时展示两个 gateway
- 点击某个 gateway 后查看该 gateway 下的账户详情
- 设计保持精简，只覆盖当前产品所需能力

这不是一个通用 provider 框架。

## 已确认的产品模型

顶层产品结构固定如下：

- 顶层只有两个 gateway 分组
- 每个 gateway 下可以有多个账户
- 一个账户对应一个 key
- 一个账户产生一条独立的刷新结果

renderer 不应把 gateway 本身作为刷新单位。

## 交互模型

交互方式固定如下：

- 默认视图同时展示两个 gateway 的概览卡片
- 点击某个 gateway 进入该 gateway 的详情视图
- 详情视图只显示该 gateway 下的账户
- 关闭详情视图后回到双 gateway 概览

第一阶段不包含：

- 历史图表
- 趋势视图
- 跨 gateway 汇总总值
- 自定义分组

## 配置模型

当前 `activeGateway` 的单选模型应被移除。

配置文件改为在固定 gateway 下保存账户列表：

```json
{
  "gateways": [
    {
      "gatewayId": "llm-gateway",
      "accounts": [
        {
          "accountId": "prod",
          "label": "Prod",
          "apiKey": "sk-xxx",
          "enabled": true
        }
      ]
    },
    {
      "gatewayId": "vibe",
      "accounts": [
        {
          "accountId": "main",
          "label": "Main",
          "apiKey": "sk-yyy",
          "enabled": true
        }
      ]
    }
  ]
}
```

每个账户的必要字段为：

- `accountId`
- `label`
- `apiKey`
- `enabled`

`accountId` 是本地稳定 id，不应依赖原始 API Key 值。

## 数据模型

materialized state 只暴露两层：

- `gateways`
- `accounts`

推荐结构：

```ts
type MaterializedState = {
  generatedAt: string;
  gateways: GatewaySummary[];
  accounts: AccountSnapshot[];
};
```

`AccountSnapshot` 在当前 snapshot 基础上增加：

- `gatewayId`
- `accountId`

`sourceId` 应对每个账户保持稳定，例如：

- `llm-gateway:prod`
- `vibe:main`

`GatewaySummary` 是 daemon 为固定 gateway 生成的汇总对象。

它只保留最小概览字段：

- `gatewayId`
- `accountCount`
- `healthyCount`
- `brokenCount`
- `usagePercent`
- `usedAmount`
- `totalAmount`
- `amountUnit`
- `topAlertKind`
- `lastSuccessAt`

## 刷新与汇总规则

daemon 的刷新单位应是账户，而不是 gateway。

刷新流程为：

```text
config accounts
  -> refresh each account
  -> produce account snapshots
  -> aggregate per gateway
  -> write materialized state
```

规则如下：

- 刷新失败按账户隔离
- last-good 数据按账户保留
- 某个账户失败不能阻塞同 gateway 下的其他账户
- gateway summary 只能由该 gateway 下的账户快照推导

汇总必须保持严格：

- 如果账户额度值可以诚实相加，则 gateway summary 可以输出聚合后的 `usedAmount` 和 `totalAmount`
- 如果额度值不完整或不兼容，则 gateway summary 不输出聚合额度，不能估算
- 健康数量统计始终可用

## UI 组成

### 概览

默认概览只包含两个 gateway 卡片：

1. `llm-gateway`
2. `vibe`

每张卡片只显示：

- gateway 名称
- 正常账户数
- 异常账户数
- 可用时的主额度值
- 刷新状态

### Gateway 详情

gateway 详情视图展示所选 gateway 下的账户列表。

每个账户行或卡片只显示：

- 账户标签
- 已使用额度
- 总额度
- 百分比
- 刷新状态
- 非健康状态下的最后错误

第一阶段不需要图表和二级分析信息。

## 设置页调整

设置页需要支持：

- 在固定 gateway 分组下管理账户
- 为同一 gateway 新增多个账户
- 编辑账户标签和 API Key
- 启用或停用账户
- 删除账户

验证逻辑应针对保存后的账户项执行，而不是针对单个 active gateway。

## 迁移

现有配置应自动迁移：

- 当前 `llm-gateway.apiKey` 迁移为一个 `llm-gateway` 账户
- 当前 `vibe.apiKey` 迁移为一个 `vibe` 账户
- `activeGateway` 被丢弃

迁移后的默认标签可以是：

- `Default`

## 验收标准

- 默认概览同时展示 `llm-gateway` 和 `vibe`
- 一个 gateway 下可以配置多个 key
- 每个 key 独立刷新
- 一个 key 失败不会阻塞其他 key
- 详情视图显示所选 gateway 下的账户
- renderer 只消费 daemon 产出的 gateway summaries 和 account snapshots
- 无法诚实汇总时，不估算额度值

## 不在本次范围内

- 通用 provider 插件体系
- 支持 `llm-gateway` 和 `vibe` 之外的 gateway
- 历史图表
- 趋势分析
- 自定义 dashboard 布局
- 跨 gateway 合并总值
