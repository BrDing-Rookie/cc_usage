use std::collections::HashMap;

use super::adapters::{self, AdapterError, Credentials};
use super::config::{AppConfig, GatewayId};
use super::{Capabilities, SourceSnapshot};

const STALE_AFTER_MS: u128 = 15 * 60 * 1000;

pub async fn run_refresh_cycle(
    config: &AppConfig,
    previous: &HashMap<String, SourceSnapshot>,
    client: &reqwest::Client,
) -> Vec<SourceSnapshot> {
    let mut next: HashMap<String, SourceSnapshot> = previous.clone();

    let api_key = match config.active_gateway {
        GatewayId::LlmGateway => config.llm_gateway_key.as_deref(),
        GatewayId::Vibe => config.vibe_key.as_deref(),
    };

    let Some(key) = api_key else {
        return vec![];
    };

    let preset = config.active_gateway.preset();
    let creds = Credentials {
        base_url: preset.base_url.to_owned(),
        api_key: key.to_owned(),
    };

    let source_id = match config.active_gateway {
        GatewayId::LlmGateway => "llm-gateway",
        GatewayId::Vibe => "vibe",
    };

    let result: Result<SourceSnapshot, AdapterError> = match config.active_gateway {
        GatewayId::LlmGateway => adapters::fetch_mininglamp(client, &creds).await,
        GatewayId::Vibe => adapters::fetch_litellm(client, &creds).await,
    };

    match result {
        Ok(mut snapshot) => {
            snapshot.alert_kind = classify_alert(&snapshot);
            next.insert(source_id.to_owned(), snapshot);
        }
        Err(err) => {
            let refresh_status = if err.is_auth {
                "auth_invalid"
            } else {
                "source_broken"
            };

            if let Some(last_good) = next.get(source_id) {
                let mut merged = last_good.clone();
                merged.refresh_status = refresh_status.to_owned();
                merged.last_error = Some(err.message);
                merged.alert_kind = classify_alert(&merged);
                next.insert(source_id.to_owned(), merged);
            } else {
                let snapshot = error_snapshot(source_id, refresh_status, &err.message);
                next.insert(source_id.to_owned(), snapshot);
            }
        }
    }

    next.into_values().collect()
}

fn classify_alert(snapshot: &SourceSnapshot) -> Option<String> {
    if snapshot.refresh_status == "auth_invalid" {
        return Some("auth_invalid".into());
    }
    if snapshot.refresh_status == "source_broken" {
        return Some("source_broken".into());
    }

    if let Some(ref last) = snapshot.last_success_at {
        if let Ok(age) = parse_age_ms(last) {
            if age > STALE_AFTER_MS {
                return Some("refresh_stale".into());
            }
        }
    }

    if let Some(pct) = snapshot.usage_percent {
        if pct >= 80.0 {
            return Some("quota_low".into());
        }
    }

    None
}

fn parse_age_ms(iso: &str) -> Result<u128, ()> {
    // Simple ISO 8601 parse: extract enough to compute milliseconds since epoch
    // Format: "2026-04-15T09:30:22.044Z"
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| ())?;
    let now_ms = now.as_millis();

    let parts: Vec<&str> = iso.split('T').collect();
    if parts.len() != 2 {
        return Err(());
    }
    let date_parts: Vec<u64> = parts[0].split('-').filter_map(|s| s.parse().ok()).collect();
    let time_str = parts[1].trim_end_matches('Z');
    let time_parts: Vec<&str> = time_str.split(':').collect();
    if date_parts.len() != 3 || time_parts.len() < 3 {
        return Err(());
    }

    let y = date_parts[0] as i64;
    let m = date_parts[1] as i64;
    let d = date_parts[2] as i64;
    let h: u64 = time_parts[0].parse().map_err(|_| ())?;
    let min: u64 = time_parts[1].parse().map_err(|_| ())?;

    let sec_parts: Vec<&str> = time_parts[2].split('.').collect();
    let s: u64 = sec_parts[0].parse().map_err(|_| ())?;
    let ms: u64 = if sec_parts.len() > 1 {
        let frac = sec_parts[1];
        let padded = format!("{:0<3}", &frac[..frac.len().min(3)]);
        padded.parse().unwrap_or(0)
    } else {
        0
    };

    let days = ymd_to_days(y, m, d);
    let epoch_ms = (days as u128) * 86_400_000
        + (h as u128) * 3_600_000
        + (min as u128) * 60_000
        + (s as u128) * 1_000
        + ms as u128;

    Ok(now_ms.saturating_sub(epoch_ms))
}

fn ymd_to_days(y: i64, m: i64, d: i64) -> i64 {
    let mut days = 0i64;
    for yr in 1970..y {
        days += if super::is_leap(yr) { 366 } else { 365 };
    }
    let month_days = if super::is_leap(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    for i in 0..((m - 1) as usize).min(12) {
        days += month_days[i];
    }
    days + d - 1
}

fn error_snapshot(source_id: &str, refresh_status: &str, error_text: &str) -> SourceSnapshot {
    let mut snapshot = SourceSnapshot {
        source_id: source_id.to_owned(),
        vendor_family: source_id.to_owned(),
        source_kind: "custom_endpoint".to_owned(),
        account_label: source_id.to_owned(),
        plan_name: None,
        usage_percent: None,
        used_amount: None,
        total_amount: None,
        amount_unit: None,
        reset_at: None,
        refresh_status: refresh_status.to_owned(),
        last_success_at: None,
        last_error: Some(error_text.to_owned()),
        alert_kind: None,
        capabilities: Capabilities {
            percent: false,
            absolute_amount: false,
            reset_time: false,
            plan_name: false,
            health_signal: true,
        },
        windows: vec![],
    };
    snapshot.alert_kind = classify_alert(&snapshot);
    snapshot
}
