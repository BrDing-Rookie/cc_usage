# Dual-Gateway Multi-Account Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single-active-gateway flow with a status-bar-first dual-gateway, multi-account monitor that pins one account to the tray icon and shows gateway/account detail inside the popover.

**Architecture:** Extend the shared contract to model `gateways + accounts + multi-account config`, then update the Tauri Rust runtime to refresh per account and aggregate per gateway. Keep the status-bar shell minimal: the tray icon reads only the pinned account plus a red overflow `!`, while the React popover handles the two-gateway overview and gateway-detail drill-in.

**Tech Stack:** TypeScript, React 19, Vitest, Zod, Tauri 2, Rust, reqwest

---

## File Structure

### Process And Tracking

`dev-docs/desktop/2026-04-18-dual-gateway-multi-account-monitor.md`  
Purpose: Required implementation doc for this non-trivial change before code edits begin.

`dev-docs/BACKLOG.md`  
Purpose: Track the work item while implementation is in progress.

`dev-docs/DONE.md`  
Purpose: Record the completed work item after code and verification finish.

### Shared Contract

`packages/shared/src/schema.ts`  
Purpose: Define `GatewaySummary`, `AccountSnapshot`, and multi-account `AppConfig`.

`packages/shared/src/index.ts`  
Purpose: Export the new schemas and types.

`packages/shared/tests/schema.test.ts`  
Purpose: Lock the new materialized state and config shape with parser tests.

### Tauri Backend

`apps/desktop/src-tauri/src/usage/config.rs`  
Purpose: Parse and migrate the new multi-account config format, including `statusBar.pinnedAccountId`.

`apps/desktop/src-tauri/src/usage/mod.rs`  
Purpose: Hold the in-memory Rust shape for `MaterializedState`, `GatewaySummary`, and `AccountSnapshot`.

`apps/desktop/src-tauri/src/usage/refresh.rs`  
Purpose: Refresh enabled accounts independently and aggregate gateway summaries.

`apps/desktop/src-tauri/src/usage/adapters.rs`  
Purpose: Parameterize adapter output by account metadata instead of hard-coded single-gateway ids.

`apps/desktop/src-tauri/src/lib.rs`  
Purpose: Manage typed config state, expose config/materialized-state commands, and remove hover-only popover commands.

### Tray Shell

`apps/desktop/src-tauri/src/ring_icon.rs`  
Purpose: Draw the pinned-account ring plus optional center red `!`.

`apps/desktop/src-tauri/src/tray.rs`  
Purpose: Toggle the popover on click, resolve the pinned-account display, and ignore non-pinned account errors in the tray icon.

### Desktop Renderer

`apps/desktop/src/App.tsx`  
Purpose: Load materialized state and render the popover without hover callbacks.

`apps/desktop/src/App.test.tsx`  
Purpose: Verify overview/detail rendering against the new materialized shape.

`apps/desktop/src/components/PopoverContent.tsx`  
Purpose: Render two-gateway overview cards and the gateway-detail list.

`apps/desktop/src/components/monitorUtils.ts`  
Purpose: Format USD, percentages, and compact status labels for overview/detail cards.

`apps/desktop/src/app.css`  
Purpose: Style the overview and detail states within the existing popover shell.

`apps/desktop/src/api/client.ts`  
Purpose: Keep only the Tauri commands still used by the React app after hover behavior is removed.

### Settings

`apps/desktop/src/components/SettingsWindow.tsx`  
Purpose: Manage multiple accounts per gateway and the pinned status-bar account.

`apps/desktop/src/components/SettingsWindow.test.tsx`  
Purpose: Verify config editing, save payload shape, and pinned-account selection.

### Project Docs

`project-docs/desktop.md`  
Purpose: Document the tray/popup interaction and pinned-account tray behavior.

`project-docs/shared.md`  
Purpose: Document the `gateways + accounts` shared contract.

`project-docs/usage-daemon.md`  
Purpose: Document account-level refresh and gateway-level aggregation in the current runtime.

## Task 1: Register The Work In Dev Docs

**Files:**
- Create: `dev-docs/desktop/2026-04-18-dual-gateway-multi-account-monitor.md`
- Modify: `dev-docs/BACKLOG.md`

- [ ] **Step 1: Create the required development doc before code changes**

```md
# 双网关多账户监控实现

- **状态**: 进行中
- **模块**: desktop, shared, usage-daemon
- **创建日期**: 2026-04-18

## 目标

将当前单网关、单 key 的监控器升级为双 gateway、多 account 模式，并允许在状态栏固定展示一个 account。

## 涉及文件

- `packages/shared/src/schema.ts` — 新的 `gateways + accounts` 契约
- `apps/desktop/src-tauri/src/usage/` — 多 account 刷新与 gateway 汇总
- `apps/desktop/src-tauri/src/tray.rs` — pinned account 状态栏逻辑
- `apps/desktop/src/components/PopoverContent.tsx` — 双 gateway 概览和详情
- `apps/desktop/src/components/SettingsWindow.tsx` — 多 account 配置与 pinned account 选择

## 方案

- 配置模型改为固定双 gateway 下的 `accounts[]`
- daemon 按 account 刷新，按 gateway 汇总
- 状态栏只显示 pinned account，其他 account 仅在 `usagePercent >= 80%` 时触发中心红色 `!`

## 验收标准

- 默认 popover 概览同时展示 `llm-gateway` 和 `vibe`
- 同一 gateway 可配置多个 account
- 状态栏只展示一个 pinned account
- 其他 account 仅在高占用时触发中心红色 `!`
```

- [ ] **Step 2: Add the in-progress entry to `dev-docs/BACKLOG.md`**

```md
| 模块 | 文档 | 状态 | 创建日期 |
|------|------|------|------|
| desktop | [双网关多账户监控实现](./desktop/2026-04-18-dual-gateway-multi-account-monitor.md) | 进行中 | 2026-04-18 |
```

- [ ] **Step 3: Commit the tracking docs**

```bash
git add dev-docs/desktop/2026-04-18-dual-gateway-multi-account-monitor.md dev-docs/BACKLOG.md
git commit -m "docs: add dual-gateway monitor dev doc"
```

## Task 2: Extend The Shared Contract For Gateways, Accounts, And Config

**Files:**
- Modify: `packages/shared/src/schema.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/tests/schema.test.ts`

- [ ] **Step 1: Write the failing schema tests for the new materialized state and config**

```ts
it('accepts gateway summaries plus account snapshots', () => {
  const parsed = materializedStateSchema.parse({
    generatedAt: '2026-04-18T10:00:00.000Z',
    gateways: [
      {
        gatewayId: 'vibe',
        accountCount: 2,
        healthyCount: 2,
        brokenCount: 0,
        usagePercent: 35,
        usedAmount: 70,
        totalAmount: 200,
        amountUnit: 'USD',
        topAlertKind: null,
        lastSuccessAt: '2026-04-18T09:59:00.000Z'
      }
    ],
    accounts: [
      {
        sourceId: 'vibe:main',
        gatewayId: 'vibe',
        accountId: 'main',
        vendorFamily: 'vibe',
        sourceKind: 'custom_endpoint',
        accountLabel: 'Main',
        planName: null,
        usagePercent: 35,
        usedAmount: 70,
        totalAmount: 200,
        amountUnit: 'USD',
        resetAt: null,
        refreshStatus: 'ok',
        lastSuccessAt: '2026-04-18T09:59:00.000Z',
        lastError: null,
        alertKind: null,
        capabilities: {
          percent: true,
          absoluteAmount: true,
          resetTime: false,
          planName: false,
          healthSignal: true
        },
        windows: []
      }
    ]
  });

  expect(parsed.gateways[0].gatewayId).toBe('vibe');
  expect(parsed.accounts[0].sourceId).toBe('vibe:main');
});

it('accepts the multi-account app config with a pinned status-bar account', () => {
  const parsed = appConfigSchema.parse({
    statusBar: { pinnedAccountId: 'vibe:main' },
    gateways: [
      {
        gatewayId: 'vibe',
        accounts: [
          { accountId: 'main', label: 'Main', apiKey: 'sk-1', enabled: true }
        ]
      }
    ]
  });

  expect(parsed.statusBar.pinnedAccountId).toBe('vibe:main');
});
```

- [ ] **Step 2: Run the shared tests to verify they fail**

Run: `corepack pnpm --filter @vibe-monitor/shared test -- tests/schema.test.ts`
Expected: FAIL because `materializedStateSchema` still expects `sources`, and `appConfigSchema` still expects `activeGateway` with one key per gateway.

- [ ] **Step 3: Implement the new schemas**

```ts
export const gatewaySummarySchema = z.object({
  gatewayId: gatewayIdSchema,
  accountCount: z.number().int().nonnegative(),
  healthyCount: z.number().int().nonnegative(),
  brokenCount: z.number().int().nonnegative(),
  usagePercent: z.number().min(0).max(100).nullable(),
  usedAmount: z.number().nonnegative().nullable(),
  totalAmount: z.number().positive().nullable(),
  amountUnit: z.string().min(1).nullable(),
  topAlertKind: alertKindSchema.nullable(),
  lastSuccessAt: isoDateTime.nullable()
});

export const accountSnapshotSchema = sourceSnapshotSchema.extend({
  gatewayId: gatewayIdSchema,
  accountId: z.string().min(1)
});

export const accountConfigSchema = z.object({
  accountId: z.string().min(1),
  label: z.string().min(1),
  apiKey: z.string().min(1),
  enabled: z.boolean().default(true)
});

export const appConfigSchema = z.object({
  statusBar: z.object({
    pinnedAccountId: z.string().min(1).nullable().default(null)
  }).default({ pinnedAccountId: null }),
  gateways: z.array(z.object({
    gatewayId: gatewayIdSchema,
    accounts: z.array(accountConfigSchema)
  }))
});

export const materializedStateSchema = z.object({
  generatedAt: isoDateTime,
  gateways: z.array(gatewaySummarySchema),
  accounts: z.array(accountSnapshotSchema)
});
```

- [ ] **Step 4: Export the new shared types**

```ts
export {
  accountConfigSchema,
  accountSnapshotSchema,
  gatewaySummarySchema,
  materializedStateSchema
} from './schema';

export type {
  AccountConfig,
  AccountSnapshot,
  GatewaySummary,
  MaterializedState
} from './schema';
```

- [ ] **Step 5: Run the shared tests again**

Run: `corepack pnpm --filter @vibe-monitor/shared test -- tests/schema.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/schema.ts packages/shared/src/index.ts packages/shared/tests/schema.test.ts
git commit -m "feat: add dual-gateway shared contracts"
```

## Task 3: Move The Tauri Runtime To Multi-Account Refresh And Gateway Aggregation

**Files:**
- Modify: `apps/desktop/src-tauri/src/usage/config.rs`
- Modify: `apps/desktop/src-tauri/src/usage/mod.rs`
- Modify: `apps/desktop/src-tauri/src/usage/refresh.rs`
- Modify: `apps/desktop/src-tauri/src/usage/adapters.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing Rust tests for config migration and gateway aggregation**

```rust
fn fixture_account(
    gateway: &str,
    account: &str,
    percent: Option<f64>,
    used: Option<f64>,
    total: Option<f64>,
) -> AccountSnapshot {
    AccountSnapshot {
        source_id: format!("{gateway}:{account}"),
        gateway_id: match gateway {
            "vibe" => GatewayId::Vibe,
            _ => GatewayId::LlmGateway,
        },
        account_id: account.to_owned(),
        vendor_family: gateway.to_owned(),
        source_kind: "custom_endpoint".to_owned(),
        account_label: account.to_owned(),
        plan_name: None,
        usage_percent: percent,
        used_amount: used,
        total_amount: total,
        amount_unit: Some("USD".to_owned()),
        reset_at: None,
        refresh_status: "ok".to_owned(),
        last_success_at: Some("2026-04-18T09:59:00.000Z".to_owned()),
        last_error: None,
        alert_kind: None,
        capabilities: Capabilities {
            percent: true,
            absolute_amount: used.is_some() && total.is_some(),
            reset_time: false,
            plan_name: false,
            health_signal: true,
        },
        windows: vec![],
    }
}

#[test]
fn migrate_legacy_single_key_sections_into_accounts() {
    let raw = serde_json::json!({
        "activeGateway": "vibe",
        "llm-gateway": { "apiKey": "sk-llm" },
        "vibe": { "apiKey": "sk-vibe" }
    });

    let cfg = parse_config_value(raw);
    assert_eq!(cfg.status_bar.pinned_account_id.as_deref(), Some("vibe:default"));
    assert_eq!(cfg.gateways.len(), 2);
    assert_eq!(cfg.gateways[1].accounts[0].account_id, "default");
}

#[test]
fn aggregate_gateway_summary_omits_partial_totals() {
    let accounts = vec![
        fixture_account("vibe", "main", Some(40.0), Some(20.0), Some(50.0)),
        fixture_account("vibe", "backup", Some(55.0), None, None),
    ];

    let summaries = aggregate_gateway_summaries(&accounts);
    assert_eq!(summaries[0].gateway_id, GatewayId::Vibe);
    assert_eq!(summaries[0].used_amount, None);
    assert_eq!(summaries[0].total_amount, None);
}
```

- [ ] **Step 2: Run the Rust tests to verify they fail**

Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml usage:: -- --nocapture`
Expected: FAIL because the Rust config model is still `active_gateway + single key`, and the refresh layer still returns only `sources`.

- [ ] **Step 3: Implement the typed multi-account config and state**

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusBarConfig {
    pub pinned_account_id: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountConfig {
    pub account_id: String,
    pub label: String,
    pub api_key: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayConfig {
    pub gateway_id: GatewayId,
    pub accounts: Vec<AccountConfig>,
}

pub struct AppConfig {
    pub status_bar: StatusBarConfig,
    pub gateways: Vec<GatewayConfig>,
}

fn parse_config_value(raw: serde_json::Value) -> AppConfig {
    let migrated = migrate(raw);
    serde_json::from_value(migrated).unwrap_or_default()
}
```

- [ ] **Step 4: Migrate legacy config and refresh per enabled account**

```rust
fn aggregate_gateway_summaries(accounts: &[AccountSnapshot]) -> Vec<GatewaySummary> {
    let mut grouped = BTreeMap::<GatewayId, Vec<&AccountSnapshot>>::new();
    for account in accounts {
        grouped.entry(account.gateway_id).or_default().push(account);
    }

    grouped
        .into_iter()
        .map(|(gateway_id, items)| {
            let account_count = items.len();
            let healthy_count = items.iter().filter(|item| item.refresh_status == "ok").count();
            let broken_count = account_count - healthy_count;
            let all_absolute = items.iter().all(|item| item.used_amount.is_some() && item.total_amount.is_some());
            let used_amount = all_absolute.then(|| items.iter().map(|item| item.used_amount.unwrap()).sum::<f64>());
            let total_amount = all_absolute.then(|| items.iter().map(|item| item.total_amount.unwrap()).sum::<f64>());

            GatewaySummary {
                gateway_id,
                account_count,
                healthy_count,
                broken_count,
                usage_percent: match (used_amount, total_amount) {
                    (Some(used), Some(total)) if total > 0.0 => Some((used / total * 100.0).clamp(0.0, 100.0)),
                    _ => None,
                },
                used_amount,
                total_amount,
                amount_unit: all_absolute.then_some("USD".to_owned()),
                top_alert_kind: items.iter().find_map(|item| item.alert_kind.clone()),
                last_success_at: items.iter().filter_map(|item| item.last_success_at.clone()).max(),
            }
        })
        .collect()
}

fn merge_account_result(
    next_accounts: &mut HashMap<String, AccountSnapshot>,
    gateway_id: GatewayId,
    account: &AccountConfig,
    result: Result<AccountSnapshot, AdapterError>,
) {
    let source_id = format!("{}:{}", gateway_id.as_str(), account.account_id);
    match result {
        Ok(mut snapshot) => {
            snapshot.source_id = source_id.clone();
            snapshot.gateway_id = gateway_id;
            snapshot.account_id = account.account_id.clone();
            snapshot.account_label = account.label.clone();
            next_accounts.insert(source_id, snapshot);
        }
        Err(error) => {
            if let Some(previous) = next_accounts.get(&source_id).cloned() {
                let mut stale = previous;
                stale.refresh_status = if error.is_auth { "auth_invalid".into() } else { "source_broken".into() };
                stale.last_error = Some(error.message);
                next_accounts.insert(source_id, stale);
            }
        }
    }
}

for gateway in &config.gateways {
    for account in gateway.accounts.iter().filter(|account| account.enabled) {
        let source_id = format!("{}:{}", gateway.gateway_id.as_str(), account.account_id);
        let creds = Credentials {
            base_url: gateway.gateway_id.preset().base_url.to_owned(),
            api_key: account.api_key.clone(),
        };

        let result = match gateway.gateway_id {
            GatewayId::LlmGateway => adapters::fetch_mininglamp(client, &creds, &source_id, &account.label).await,
            GatewayId::Vibe => adapters::fetch_litellm(client, &creds, &source_id, &account.label).await,
        };

        merge_account_result(&mut next_accounts, gateway.gateway_id, account, result);
    }
}

let mut accounts = next_accounts.into_values().collect::<Vec<_>>();
accounts.sort_by(|left, right| left.source_id.cmp(&right.source_id));
let gateways = aggregate_gateway_summaries(&accounts);
```

- [ ] **Step 5: Update the in-memory materialized state and typed config state**

```rust
pub struct MaterializedState {
    pub generated_at: String,
    pub gateways: Vec<GatewaySummary>,
    pub accounts: Vec<AccountSnapshot>,
}

struct AppConfigState(pub Arc<RwLock<AppConfig>>);

#[tauri::command]
fn write_app_config(
    app: tauri::AppHandle,
    config: serde_json::Value,
    config_state: tauri::State<'_, AppConfigState>,
) -> Result<(), String> {
    let parsed = parse_config_value(config);
    write_config_file(&app, &parsed)?;
    *config_state.0.blocking_write() = parsed;
    Ok(())
}

fn write_config_file(app: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let base_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let pretty = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&base_dir).map_err(|e| e.to_string())?;
    std::fs::write(base_dir.join("config.json"), pretty).map_err(|e| e.to_string())
}
```

- [ ] **Step 6: Run the Rust tests again**

Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml usage:: -- --nocapture`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src-tauri/src/usage/config.rs apps/desktop/src-tauri/src/usage/mod.rs apps/desktop/src-tauri/src/usage/refresh.rs apps/desktop/src-tauri/src/usage/adapters.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: refresh gateway accounts independently"
```

## Task 4: Update The Tray Shell For Pinned-Account Display

**Files:**
- Modify: `apps/desktop/src-tauri/src/ring_icon.rs`
- Modify: `apps/desktop/src-tauri/src/tray.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing tray and icon tests**

```rust
fn fixture_config(pinned: Option<&str>) -> AppConfig {
    AppConfig {
        status_bar: StatusBarConfig {
            pinned_account_id: pinned.map(str::to_owned),
        },
        gateways: vec![],
    }
}

fn fixture_account(
    gateway: &str,
    account: &str,
    percent: Option<f64>,
    used: Option<f64>,
    total: Option<f64>,
) -> AccountSnapshot {
    AccountSnapshot {
        source_id: format!("{gateway}:{account}"),
        gateway_id: match gateway {
            "vibe" => GatewayId::Vibe,
            _ => GatewayId::LlmGateway,
        },
        account_id: account.to_owned(),
        vendor_family: gateway.to_owned(),
        source_kind: "custom_endpoint".to_owned(),
        account_label: account.to_owned(),
        plan_name: None,
        usage_percent: percent,
        used_amount: used,
        total_amount: total,
        amount_unit: Some("USD".to_owned()),
        reset_at: None,
        refresh_status: "ok".to_owned(),
        last_success_at: Some("2026-04-18T09:59:00.000Z".to_owned()),
        last_error: None,
        alert_kind: None,
        capabilities: Capabilities {
            percent: true,
            absolute_amount: used.is_some() && total.is_some(),
            reset_time: false,
            plan_name: false,
            health_signal: true,
        },
        windows: vec![],
    }
}

#[test]
fn resolve_tray_display_uses_pinned_account_and_warns_on_other_high_usage() {
    let config = fixture_config(Some("vibe:main"));
    let accounts = vec![
        fixture_account("vibe", "main", Some(42.0), Some(84.0), Some(200.0)),
        fixture_account("llm-gateway", "prod", Some(91.0), Some(455.0), Some(500.0)),
    ];

    let display = resolve_tray_display(&config, &accounts);
    assert_eq!(display.label, "Main");
    assert_eq!(display.percent, 42.0);
    assert!(display.show_overflow_warning);
}

#[test]
fn warning_overlay_draws_center_pixels() {
    let img = image::load_from_memory(&generate_ring_png(42.0, true)).unwrap().to_rgba8();
    assert!(img.get_pixel(22, 22).0[3] > 0);
}
```

- [ ] **Step 2: Run the tray/icon tests to verify they fail**

Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml -- --nocapture`
Expected: FAIL because the tray still picks the max-usage source, the popover still opens on hover, and `generate_ring_png` has no overflow-warning marker.

- [ ] **Step 3: Implement the tray-display resolver and click-only popover**

```rust
struct TrayDisplay {
    label: String,
    percent: f64,
    show_overflow_warning: bool,
}

fn resolve_tray_display(config: &AppConfig, accounts: &[AccountSnapshot]) -> TrayDisplay {
    let pinned_id = config.status_bar.pinned_account_id.as_deref();
    let pinned = accounts.iter().find(|account| Some(account.source_id.as_str()) == pinned_id);
    let show_overflow_warning = accounts.iter().any(|account| {
        Some(account.source_id.as_str()) != pinned_id && account.usage_percent.unwrap_or(0.0) >= 80.0
    });

    match pinned {
        Some(account) => TrayDisplay {
            label: account.account_label.clone(),
            percent: account.usage_percent.unwrap_or(0.0),
            show_overflow_warning,
        },
        None => TrayDisplay {
            label: "no data".to_owned(),
            percent: 0.0,
            show_overflow_warning: false,
        },
    }
}
```

- [ ] **Step 4: Draw the center red `!` and remove hover commands**

```rust
pub fn generate_ring_png(percent: f64, show_warning: bool) -> Vec<u8> {
    let mut img = build_ring(percent);
    if show_warning {
        draw_warning_marker(&mut img);
    }
    encode_png(img)
}

let _tray = TrayIconBuilder::with_id("main")
    .on_tray_icon_event(move |_tray, event| match event {
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            rect,
            ..
        } => {
            if shared_click.pinned.load(Ordering::SeqCst) {
                shared_click.pinned.store(false, Ordering::SeqCst);
                let _ = popover_click.hide();
            } else {
                shared_click.pinned.store(true, Ordering::SeqCst);
                position_popover(&popover_click, &rect, 320.0);
                let _ = popover_click.show();
                let _ = popover_click.set_focus();
            }
        },
        _ => {}
    })
    .build(app)?;
```

- [ ] **Step 5: Run the tray/icon tests again**

Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml -- --nocapture`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src-tauri/src/ring_icon.rs apps/desktop/src-tauri/src/tray.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: pin tray display to one account"
```

## Task 5: Rebuild The Popover Around Gateway Overview And Detail

**Files:**
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/App.test.tsx`
- Modify: `apps/desktop/src/components/PopoverContent.tsx`
- Modify: `apps/desktop/src/components/monitorUtils.ts`
- Modify: `apps/desktop/src/app.css`
- Modify: `apps/desktop/src/api/client.ts`

- [ ] **Step 1: Write the failing popover tests for overview and detail drill-in**

```tsx
it('renders both gateway overview cards and drills into one gateway', () => {
  render(<App initialState={fixtureState} />);

  expect(screen.getByRole('button', { name: /llm-gateway/i })).toBeTruthy();
  expect(screen.getByRole('button', { name: /vibe/i })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: /vibe/i }));

  expect(screen.getByText('Main')).toBeTruthy();
  expect(screen.getByText('Backup')).toBeTruthy();
  expect(screen.getByRole('button', { name: /back/i })).toBeTruthy();
});
```

- [ ] **Step 2: Run the desktop tests to verify they fail**

Run: `corepack pnpm --filter @vibe-monitor/desktop test -- src/App.test.tsx`
Expected: FAIL because `App` still passes only `state.sources[0]`, and `PopoverContent` still renders a single snapshot card.

- [ ] **Step 3: Implement the overview/detail popover and remove hover callbacks**

```tsx
export default function App({ initialState }: AppProps) {
  if (isSettingsView) {
    return <SettingsWindow />;
  }

  const state = useSnapshots(initialState);

  return (
    <main className="popover">
      {!state ? <div className="popover-loading">Loading...</div> : <PopoverContent state={state} />}
    </main>
  );
}

export function PopoverContent({ state }: { state: MaterializedState }) {
  const [selectedGatewayId, setSelectedGatewayId] = useState<GatewayId | null>(null);

  if (!state.accounts.length) {
    return <div className="popover-empty">No data available</div>;
  }

  if (selectedGatewayId) {
    const accounts = state.accounts.filter((account) => account.gatewayId === selectedGatewayId);
    return <GatewayDetail gatewayId={selectedGatewayId} accounts={accounts} onBack={() => setSelectedGatewayId(null)} />;
  }

  return (
    <div className="popover-overview">
      {state.gateways.map((gateway) => (
        <button key={gateway.gatewayId} className="gateway-card" onClick={() => setSelectedGatewayId(gateway.gatewayId)}>
          <span>{gateway.gatewayId}</span>
          <strong>{formatPercent(gateway.usagePercent)}</strong>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Add formatting helpers and styles for overview/detail**

```ts
export function formatMetricPair(used: number | null, total: number | null, unit: string | null) {
  if (used === null || total === null || unit !== 'USD') {
    return '--';
  }

  return `${formatUsd(used)} / ${formatUsd(total)}`;
}

export function formatRefreshLabel(status: string) {
  return status === 'ok' ? 'Live' : status.replaceAll('_', ' ');
}
```

```css
.popover-overview {
  display: grid;
  gap: 10px;
}

.gateway-card {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid rgba(82, 97, 139, 0.16);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
}

.gateway-detail {
  display: grid;
  gap: 10px;
}
```

- [ ] **Step 5: Run the desktop tests again**

Run: `corepack pnpm --filter @vibe-monitor/desktop test -- src/App.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/App.tsx apps/desktop/src/App.test.tsx apps/desktop/src/components/PopoverContent.tsx apps/desktop/src/components/monitorUtils.ts apps/desktop/src/app.css apps/desktop/src/api/client.ts
git commit -m "feat: show gateway overview and detail in popover"
```

## Task 6: Replace The Single-Key Settings UI With Multi-Account Editing

**Files:**
- Modify: `apps/desktop/src/components/SettingsWindow.tsx`
- Create: `apps/desktop/src/components/SettingsWindow.test.tsx`
- Modify: `apps/desktop/src/app.css`

- [ ] **Step 1: Write the failing settings test for multi-account save payload**

```tsx
it('saves multiple accounts and the pinned status-bar account', async () => {
  render(<SettingsWindow />);

  await screen.findByDisplayValue('Main');
  fireEvent.click(screen.getByRole('button', { name: /add vibe account/i }));
  fireEvent.change(screen.getByLabelText('Account label 2'), { target: { value: 'Backup' } });
  fireEvent.change(screen.getByLabelText('API key 2'), { target: { value: 'sk-backup' } });
  fireEvent.click(screen.getByLabelText('Pin Main to status bar'));
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(writeAppConfig).toHaveBeenCalledWith({
    statusBar: { pinnedAccountId: 'vibe:main' },
    gateways: expect.any(Array)
  });
});
```

- [ ] **Step 2: Run the settings test to verify it fails**

Run: `corepack pnpm --filter @vibe-monitor/desktop test -- src/components/SettingsWindow.test.tsx`
Expected: FAIL because `SettingsWindow` still edits one `activeGateway` key and has no multi-account or pinned-account UI.

- [ ] **Step 3: Implement grouped account editing and pinned-account selection**

```tsx
{config.gateways.map((gateway) => (
  <section key={gateway.gatewayId} className="settings-group">
    <h3>{gateway.gatewayId}</h3>
    {gateway.accounts.map((account) => {
      const sourceId = `${gateway.gatewayId}:${account.accountId}`;
      return (
        <div key={sourceId} className="settings-account">
          <input value={account.label} onChange={(e) => updateAccount(gateway.gatewayId, account.accountId, 'label', e.target.value)} />
          <input type="password" value={account.apiKey} onChange={(e) => updateAccount(gateway.gatewayId, account.accountId, 'apiKey', e.target.value)} />
          <label><input type="checkbox" checked={account.enabled} onChange={() => toggleEnabled(gateway.gatewayId, account.accountId)} />Enabled</label>
          <label><input type="radio" checked={config.statusBar.pinnedAccountId === sourceId} onChange={() => pinAccount(sourceId)} />Pin to status bar</label>
          <button onClick={() => removeAccount(gateway.gatewayId, account.accountId)}>Remove</button>
        </div>
      );
    })}
    <button onClick={() => addAccount(gateway.gatewayId)}>Add account</button>
  </section>
))}
```

- [ ] **Step 4: Verify all enabled accounts after save instead of one active gateway**

```tsx
const expectedIds = new Set(
  config.gateways.flatMap((gateway) =>
    gateway.accounts.filter((account) => account.enabled).map((account) => `${gateway.gatewayId}:${account.accountId}`)
  )
);

while (Date.now() < deadline) {
  const state = await loadMaterializedState();
  const seenIds = new Set((state.accounts ?? []).map((account) => account.sourceId));

  if ([...expectedIds].every((id) => seenIds.has(id))) {
    await getCurrentWindow().close();
    return;
  }
}
```

- [ ] **Step 5: Run the settings test again**

Run: `corepack pnpm --filter @vibe-monitor/desktop test -- src/components/SettingsWindow.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/SettingsWindow.tsx apps/desktop/src/components/SettingsWindow.test.tsx apps/desktop/src/app.css
git commit -m "feat: support multi-account gateway settings"
```

## Task 7: Update Module Docs, Verify End-To-End, And Close The Dev Doc

**Files:**
- Modify: `project-docs/desktop.md`
- Modify: `project-docs/shared.md`
- Modify: `project-docs/usage-daemon.md`
- Modify: `dev-docs/desktop/2026-04-18-dual-gateway-multi-account-monitor.md`
- Modify: `dev-docs/BACKLOG.md`
- Modify: `dev-docs/DONE.md`

- [ ] **Step 1: Update the module docs and mark the dev doc complete**

```md
- **状态**: 已完成

## 核心能力

- 状态栏固定展示一个 pinned account
- 其他 account 仅在高占用时触发中心红色 `!`
- popover 默认展示双 gateway 概览，点击后进入 gateway 详情
```

```md
| desktop | [双网关多账户监控实现](./desktop/2026-04-18-dual-gateway-multi-account-monitor.md) | 2026-04-18 |
```

- [ ] **Step 2: Run the full automated verification**

Run: `corepack pnpm test`
Expected: PASS across `shared` and `desktop` package tests.

Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
Expected: PASS across the Rust runtime, tray, and icon tests.

- [ ] **Step 3: Run the manual desktop smoke test**

Run: `corepack pnpm dev:shell`
Expected: The Tauri app launches in the status bar, `Settings...` allows adding multiple accounts, choosing a pinned account updates the tray ring, a non-pinned account over 80% shows the center red `!`, and clicking the tray opens `popover overview -> gateway detail -> close`.

- [ ] **Step 4: Remove the BACKLOG row and move the entry to DONE**

```md
| desktop | [双网关多账户监控实现](./desktop/2026-04-18-dual-gateway-multi-account-monitor.md) | 2026-04-18 |
```

- [ ] **Step 5: Commit**

```bash
git add project-docs/desktop.md project-docs/shared.md project-docs/usage-daemon.md dev-docs/desktop/2026-04-18-dual-gateway-multi-account-monitor.md dev-docs/BACKLOG.md dev-docs/DONE.md
git commit -m "docs: finalize dual-gateway monitor rollout"
```
