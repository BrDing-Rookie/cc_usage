pub mod adapters;
pub mod config;
pub mod refresh;

use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

use crate::usage::config::load_config;
use crate::usage::refresh::run_refresh_cycle;

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MaterializedState {
    pub generated_at: String,
    pub sources: Vec<SourceSnapshot>,
}

impl Default for MaterializedState {
    fn default() -> Self {
        Self {
            generated_at: "1970-01-01T00:00:00.000Z".to_owned(),
            sources: vec![],
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SourceSnapshot {
    pub source_id: String,
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

#[derive(serde::Serialize, serde::Deserialize, Clone)]
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
    base_dir: std::path::PathBuf,
    state: Arc<RwLock<MaterializedState>>,
) -> CancellationToken {
    let token = CancellationToken::new();
    let child = token.child_token();

    tauri::async_runtime::spawn(async move {
        let config = load_config(&base_dir);
        let client = crate::usage::adapters::build_client();
        let mut previous: std::collections::HashMap<String, SourceSnapshot> =
            std::collections::HashMap::new();

        loop {
            let snapshots = run_refresh_cycle(&config, &previous, &client).await;
            for s in &snapshots {
                previous.insert(s.source_id.clone(), s.clone());
            }

            let now = chrono_now();
            {
                let mut guard = state.write().await;
                *guard = MaterializedState {
                    generated_at: now,
                    sources: snapshots,
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
    base_dir: std::path::PathBuf,
    state: Arc<RwLock<MaterializedState>>,
) {
    if let Some(token) = handle.token.take() {
        token.cancel();
    }

    handle.token = Some(spawn_refresh_loop(base_dir, state));
}

fn chrono_now() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    let millis = now.as_millis() % 1000;

    // Format as simplified ISO 8601
    let ts = secs as i64;
    let days = ts / 86400;
    let time_of_day = ts % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // Days since epoch to Y-M-D (simplified, handles leap years)
    let (y, m, d) = days_to_ymd(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        y, m, d, hours, minutes, seconds, millis
    )
}

fn days_to_ymd(mut days: i64) -> (i64, i64, i64) {
    // Epoch is 1970-01-01
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
