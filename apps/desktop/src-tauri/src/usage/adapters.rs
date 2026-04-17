use std::time::Duration;

use reqwest::Client;

use super::config::GatewayId;
use super::AccountSnapshot;

pub struct Credentials {
    pub base_url: String,
    pub api_key: String,
}

pub fn build_client() -> Client {
    Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent("vibe-usage-monitor/0.1")
        .build()
        .unwrap_or_default()
}

pub async fn fetch_mininglamp(
    client: &Client,
    creds: &Credentials,
    gateway_id: GatewayId,
    account_id: &str,
    source_id: &str,
    account_label: &str,
) -> Result<AccountSnapshot, AdapterError> {
    let base = creds.base_url.trim_end_matches('/');

    let (sub_res, usage_res) = tokio::join!(
        client
            .get(format!("{base}/dashboard/billing/subscription"))
            .bearer_auth(&creds.api_key)
            .header("accept", "application/json")
            .send(),
        client
            .get(format!("{base}/dashboard/billing/usage"))
            .bearer_auth(&creds.api_key)
            .header("accept", "application/json")
            .send(),
    );

    let sub: serde_json::Value = check_response(sub_res?, "llm-gateway").await?;
    let usage: serde_json::Value = check_response(usage_res?, "llm-gateway").await?;

    let total_amount = sub["hard_limit_usd"].as_f64().filter(|v| v.is_finite() && *v > 0.0);
    let used_raw = usage["total_usage"]
        .as_f64()
        .filter(|v| v.is_finite() && *v >= 0.0);

    let used_amount = match (total_amount, used_raw) {
        (Some(_), Some(raw)) => Some(raw / 100.0),
        _ => None,
    };

    let usage_percent = match (total_amount, used_amount) {
        (Some(total), Some(used)) => Some((used / total * 100.0).clamp(0.0, 100.0)),
        _ => None,
    };

    let now = super::chrono_now();
    Ok(AccountSnapshot {
        source_id: source_id.into(),
        gateway_id,
        account_id: account_id.to_owned(),
        vendor_family: gateway_id.as_str().into(),
        source_kind: "custom_endpoint".into(),
        account_label: account_label.to_owned(),
        plan_name: None,
        usage_percent,
        used_amount,
        total_amount,
        amount_unit: total_amount.map(|_| "USD".into()),
        reset_at: None,
        refresh_status: "ok".into(),
        last_success_at: Some(now),
        last_error: None,
        alert_kind: None,
        capabilities: super::Capabilities {
            percent: usage_percent.is_some(),
            absolute_amount: total_amount.is_some(),
            reset_time: false,
            plan_name: false,
            health_signal: true,
        },
        windows: vec![],
    })
}

pub async fn fetch_litellm(
    client: &Client,
    creds: &Credentials,
    gateway_id: GatewayId,
    account_id: &str,
    source_id: &str,
    account_label: &str,
) -> Result<AccountSnapshot, AdapterError> {
    let base = creds.base_url.trim_end_matches('/');

    let res = client
        .get(format!("{base}/key/info"))
        .bearer_auth(&creds.api_key)
        .header("accept", "application/json")
        .send()
        .await?;

    let data: serde_json::Value = check_response(res, "litellm").await?;
    let info = &data["info"];

    let max_budget = info["max_budget"]
        .as_f64()
        .filter(|v| v.is_finite() && *v > 0.0);
    let spend = info["spend"]
        .as_f64()
        .filter(|v| v.is_finite() && *v >= 0.0);

    let total_amount = max_budget;
    let used_amount = match (max_budget, spend) {
        (Some(_), Some(s)) => Some(s),
        _ => None,
    };

    let usage_percent = match (total_amount, used_amount) {
        (Some(total), Some(used)) => Some((used / total * 100.0).clamp(0.0, 100.0)),
        _ => None,
    };

    let reset_at = info["budget_reset_at"]
        .as_str()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_owned());

    let has_reset_time = reset_at.is_some();
    let now = super::chrono_now();
    Ok(AccountSnapshot {
        source_id: source_id.into(),
        gateway_id,
        account_id: account_id.to_owned(),
        vendor_family: gateway_id.as_str().into(),
        source_kind: "custom_endpoint".into(),
        account_label: account_label.to_owned(),
        plan_name: None,
        usage_percent,
        used_amount,
        total_amount,
        amount_unit: total_amount.map(|_| "USD".into()),
        reset_at,
        refresh_status: "ok".into(),
        last_success_at: Some(now),
        last_error: None,
        alert_kind: None,
        capabilities: super::Capabilities {
            percent: usage_percent.is_some(),
            absolute_amount: total_amount.is_some(),
            reset_time: has_reset_time,
            plan_name: false,
            health_signal: true,
        },
        windows: vec![],
    })
}

#[derive(Debug)]
pub struct AdapterError {
    pub message: String,
    pub is_auth: bool,
}

impl From<reqwest::Error> for AdapterError {
    fn from(e: reqwest::Error) -> Self {
        Self {
            message: e.to_string(),
            is_auth: false,
        }
    }
}

async fn check_response(
    resp: reqwest::Response,
    prefix: &str,
) -> Result<serde_json::Value, AdapterError> {
    let status = resp.status();
    if !status.is_success() {
        return Err(AdapterError {
            message: format!("{prefix}-http-{}", status.as_u16()),
            is_auth: status.as_u16() == 401,
        });
    }
    resp.json().await.map_err(|e| AdapterError {
        message: e.to_string(),
        is_auth: false,
    })
}
