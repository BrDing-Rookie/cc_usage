# Dual-Gateway Multi-Account Monitor Design

## Overview

This design revises the current single-gateway monitor into a fixed dual-gateway product.

The product scope is limited to:

- `llm-gateway`
- `vibe`

Each gateway can contain multiple API keys. Each key is treated as an independent monitored account.

The product goal is:

- show both gateways together in the default overview
- allow expanding one gateway to inspect its accounts
- keep the design minimal and specific to the current product

This is not a generic provider framework.

## Confirmed Product Model

The top-level product structure is fixed:

- two gateway groups only
- multiple accounts under each gateway
- one account equals one key
- one account produces one refresh result

The renderer should not treat a gateway itself as the refresh unit.

## Interaction Model

The interaction model is fixed as follows:

- The default view shows both gateway summaries at the same time.
- Clicking a gateway opens its detail view.
- The detail view shows the accounts under that gateway only.
- Closing the detail view returns to the two-gateway overview.

The first iteration does not include:

- history charts
- trend views
- cross-gateway totals
- custom grouping

## Configuration Model

The current `activeGateway` single-select model should be removed.

The config should store accounts under each fixed gateway:

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

Required fields per account:

- `accountId`
- `label`
- `apiKey`
- `enabled`

`accountId` is a local stable id. It must not depend on the raw API key value.

## Data Model

The materialized state should expose two layers only:

- `gateways`
- `accounts`

Recommended shape:

```ts
type MaterializedState = {
  generatedAt: string;
  gateways: GatewaySummary[];
  accounts: AccountSnapshot[];
};
```

`AccountSnapshot` extends the current snapshot shape with:

- `gatewayId`
- `accountId`

`sourceId` should be stable per account, for example:

- `llm-gateway:prod`
- `vibe:main`

`GatewaySummary` is a daemon-generated aggregate for one fixed gateway.

It should contain only the minimum overview fields:

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

## Refresh And Aggregation Rules

The daemon should refresh by account, not by gateway.

The refresh flow is:

```text
config accounts
  -> refresh each account
  -> produce account snapshots
  -> aggregate per gateway
  -> write materialized state
```

Rules:

- refresh failures are isolated per account
- last-good data is retained per account
- one broken account must not block other accounts in the same gateway
- gateway summary is derived only from its account snapshots

Aggregation should stay strict:

- if account values can be honestly summed, the gateway summary may show aggregated `usedAmount` and `totalAmount`
- if the values are incomplete or incompatible, the gateway summary should omit aggregate quota values instead of estimating
- health counts should always be available

## UI Composition

### Overview

The default overview contains exactly two gateway cards:

1. `llm-gateway`
2. `vibe`

Each card shows only:

- gateway label
- healthy account count
- broken account count
- primary usage value when available
- refresh state

### Gateway Detail

The gateway detail view shows the accounts for the selected gateway.

Each account row or card shows only:

- account label
- used amount
- total amount
- percent
- refresh status
- last error when not healthy

The detail view does not need charts or secondary analytics in the first iteration.

## Settings Changes

The settings UI should support:

- selecting a fixed gateway section
- adding multiple accounts under that gateway
- editing label and API key
- enabling or disabling an account
- removing an account

Verification should run against the saved account entries rather than a single active gateway.

## Migration

Existing config should migrate automatically:

- current `llm-gateway.apiKey` becomes one `llm-gateway` account
- current `vibe.apiKey` becomes one `vibe` account
- `activeGateway` is discarded

Default migrated labels can be:

- `Default`

## Acceptance Criteria

- The product shows `llm-gateway` and `vibe` together in the default overview.
- A gateway can contain multiple keys.
- Each key refreshes independently.
- One key failure does not block other keys.
- The detail view shows the accounts under one selected gateway.
- The renderer consumes daemon-produced gateway summaries and account snapshots.
- No quota values are estimated when honest aggregation is not possible.

## Out Of Scope

- generic provider plugins
- support for gateways other than `llm-gateway` and `vibe`
- historical charts
- trend analysis
- custom dashboard layouts
- cross-gateway merged totals
