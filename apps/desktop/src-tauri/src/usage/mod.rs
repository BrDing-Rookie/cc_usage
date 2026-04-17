pub mod adapters;
pub mod config;
pub mod refresh;

use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

use crate::usage::config::AppConfig;
use crate::usage::refresh::run_refresh_cycle;

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MaterializedState {
    pub generated_at: String,
    pub gateways: Vec<GatewaySummary>,
    pub accounts: Vec<AccountSnapshot>,
    #[serde(skip_serializing)]
    pub sources: Vec<AccountSnapshot>,
}

impl Default for MaterializedState {
    fn default() -> Self {
        Self {
            generated_at: "1970-01-01T00:00:00.000Z".to_owned(),
            gateways: default_gateway_summaries(),
            accounts: vec![],
            sources: vec![],
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GatewaySummary {
    pub gateway_id: config::GatewayId,
    pub account_count: usize,
    pub healthy_count: usize,
    pub broken_count: usize,
    pub usage_percent: Option<f64>,
    pub used_amount: Option<f64>,
    pub total_amount: Option<f64>,
    pub amount_unit: Option<String>,
    pub top_alert_kind: Option<String>,
    pub last_success_at: Option<String>,
}

fn default_gateway_summaries() -> Vec<GatewaySummary> {
    config::GatewayId::ALL
        .into_iter()
        .map(|gateway_id| GatewaySummary {
            gateway_id,
            account_count: 0,
            healthy_count: 0,
            broken_count: 0,
            usage_percent: None,
            used_amount: None,
            total_amount: None,
            amount_unit: None,
            top_alert_kind: None,
            last_success_at: None,
        })
        .collect()
}

#[derive(serde::Serialize, serde::Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AccountSnapshot {
    pub source_id: String,
    pub gateway_id: config::GatewayId,
    pub account_id: String,
    pub vendor_family: String,
    pub source_kind: String,
    pub account_label: String,
    pub plan_name: Option<String>,
    pub usage_percent: Option<f64>,
    pub used_amount: Option<f64>,
    pub total_amount: Option<f64>,
    pub amount_unit: Option<String>,
    pub reset_at: Option<String>,
    pub refresh_status: String,
    pub last_success_at: Option<String>,
    pub last_error: Option<String>,
    pub alert_kind: Option<String>,
    pub capabilities: Capabilities,
    pub windows: Vec<serde_json::Value>,
}

pub type SourceSnapshot = AccountSnapshot;

#[derive(serde::Serialize, serde::Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub percent: bool,
    pub absolute_amount: bool,
    pub reset_time: bool,
    pub plan_name: bool,
    pub health_signal: bool,
}

pub struct UsageState(pub Arc<RwLock<MaterializedState>>);

impl Default for UsageState {
    fn default() -> Self {
        Self(Arc::new(RwLock::new(MaterializedState::default())))
    }
}

pub struct AppConfigState(pub Arc<RwLock<AppConfig>>);

impl Default for AppConfigState {
    fn default() -> Self {
        Self(Arc::new(RwLock::new(AppConfig::default())))
    }
}

pub struct RefreshHandle {
    token: Option<CancellationToken>,
}

impl RefreshHandle {
    pub fn new(token: CancellationToken) -> Self {
        Self {
            token: Some(token),
        }
    }
}

impl Default for RefreshHandle {
    fn default() -> Self {
        Self { token: None }
    }
}

pub fn spawn_refresh_loop(
    state: Arc<RwLock<MaterializedState>>,
    config_state: Arc<RwLock<AppConfig>>,
) -> CancellationToken {
    let token = CancellationToken::new();
    let child = token.child_token();

    tauri::async_runtime::spawn(async move {
        let client = crate::usage::adapters::build_client();
        let mut previous: HashMap<String, AccountSnapshot> = HashMap::new();

        loop {
            let config = config_state.read().await.clone();
            let (gateways, accounts) = run_refresh_cycle(&config, &previous, &client).await;
            previous = accounts
                .iter()
                .cloned()
                .map(|account| (account.source_id.clone(), account))
                .collect();

            let now = chrono_now();
            {
                let mut guard = state.write().await;
                *guard = MaterializedState {
                    generated_at: now,
                    gateways,
                    sources: accounts.clone(),
                    accounts,
                };
            }

            tokio::select! {
                _ = tokio::time::sleep(std::time::Duration::from_secs(300)) => {}
                _ = child.cancelled() => break,
            }
        }
    });

    token
}

pub fn restart_refresh(
    handle: &mut RefreshHandle,
    state: Arc<RwLock<MaterializedState>>,
    config_state: Arc<RwLock<AppConfig>>,
) {
    if let Some(token) = handle.token.take() {
        token.cancel();
    }

    handle.token = Some(spawn_refresh_loop(state, config_state));
}

fn chrono_now() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    let millis = now.as_millis() % 1000;

    let ts = secs as i64;
    let days = ts / 86400;
    let time_of_day = ts % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    let (y, m, d) = days_to_ymd(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        y, m, d, hours, minutes, seconds, millis
    )
}

fn days_to_ymd(mut days: i64) -> (i64, i64, i64) {
    let mut year = 1970i64;
    loop {
        let days_in_year = if is_leap(year) { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }
    let month_days = if is_leap(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut month = 1i64;
    for md in month_days {
        if days < md {
            break;
        }
        days -= md;
        month += 1;
    }
    (year, month, days + 1)
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_materialized_state_serializes_fixed_gateway_summaries() {
        let value = serde_json::to_value(MaterializedState::default()).expect("serialize default");

        assert_eq!(value["generatedAt"], "1970-01-01T00:00:00.000Z");
        assert_eq!(value["accounts"], serde_json::json!([]));
        let gateways = value["gateways"]
            .as_array()
            .expect("gateways should serialize as an array");
        assert_eq!(gateways.len(), 2);

        assert_eq!(gateways[0]["gatewayId"], "llm-gateway");
        assert_eq!(gateways[0]["accountCount"], 0);
        assert_eq!(gateways[0]["healthyCount"], 0);
        assert_eq!(gateways[0]["brokenCount"], 0);
        assert!(gateways[0]["usagePercent"].is_null());
        assert!(gateways[0]["usedAmount"].is_null());
        assert!(gateways[0]["totalAmount"].is_null());
        assert!(gateways[0]["amountUnit"].is_null());
        assert!(gateways[0]["topAlertKind"].is_null());
        assert!(gateways[0]["lastSuccessAt"].is_null());

        assert_eq!(gateways[1]["gatewayId"], "vibe");
        assert_eq!(gateways[1]["accountCount"], 0);
        assert_eq!(gateways[1]["healthyCount"], 0);
        assert_eq!(gateways[1]["brokenCount"], 0);
        assert!(gateways[1]["usagePercent"].is_null());
        assert!(gateways[1]["usedAmount"].is_null());
        assert!(gateways[1]["totalAmount"].is_null());
        assert!(gateways[1]["amountUnit"].is_null());
        assert!(gateways[1]["topAlertKind"].is_null());
        assert!(gateways[1]["lastSuccessAt"].is_null());

        assert!(value.get("sources").is_none());
    }
}
