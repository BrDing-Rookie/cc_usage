use std::collections::{BTreeMap, HashMap};

use super::adapters::{self, AdapterError, Credentials};
use super::config::{AccountConfig, AppConfig, GatewayId};
use super::{AccountSnapshot, Capabilities, GatewaySummary};

const STALE_AFTER_MS: u128 = 15 * 60 * 1000;

pub async fn run_refresh_cycle(
    config: &AppConfig,
    previous: &HashMap<String, AccountSnapshot>,
    client: &reqwest::Client,
) -> (Vec<GatewaySummary>, Vec<AccountSnapshot>) {
    let mut next: HashMap<String, AccountSnapshot> = HashMap::new();

    for gateway in &config.gateways {
        for account in gateway.accounts.iter().filter(|account| account.enabled) {
            let source_id = format!("{}:{}", gateway.gateway_id.as_str(), account.account_id);
            let creds = Credentials {
                base_url: gateway.gateway_id.preset().base_url.to_owned(),
                api_key: account.api_key.clone(),
            };

            let result = match gateway.gateway_id {
                GatewayId::LlmGateway => {
                    adapters::fetch_mininglamp(
                        client,
                        &creds,
                        gateway.gateway_id,
                        &account.account_id,
                        &source_id,
                        &account.label,
                    )
                    .await
                }
                GatewayId::Vibe => {
                    adapters::fetch_litellm(
                        client,
                        &creds,
                        gateway.gateway_id,
                        &account.account_id,
                        &source_id,
                        &account.label,
                    )
                    .await
                }
            };

            merge_account_result(
                &mut next,
                previous,
                gateway.gateway_id,
                account,
                source_id,
                result,
            );
        }
    }

    let mut accounts = next.into_values().collect::<Vec<_>>();
    accounts.sort_by(|left, right| left.source_id.cmp(&right.source_id));
    let gateways = aggregate_gateway_summaries(&accounts);
    (gateways, accounts)
}

pub fn aggregate_gateway_summaries(accounts: &[AccountSnapshot]) -> Vec<GatewaySummary> {
    let mut grouped = BTreeMap::<GatewayId, Vec<&AccountSnapshot>>::new();
    for account in accounts {
        grouped.entry(account.gateway_id).or_default().push(account);
    }

    GatewayId::ALL
        .into_iter()
        .map(|gateway_id| {
            let items = grouped.remove(&gateway_id).unwrap_or_default();
            let account_count = items.len();
            let healthy_count = items.iter().filter(|item| item.refresh_status == "ok").count();
            let broken_count = account_count.saturating_sub(healthy_count);

            let aggregate_amounts = compatible_absolute_amounts(&items);
            let used_amount = aggregate_amounts
                .as_ref()
                .map(|(unit, _)| {
                    let _ = unit;
                    items.iter().map(|item| item.used_amount.unwrap_or(0.0)).sum::<f64>()
                });
            let total_amount = aggregate_amounts
                .as_ref()
                .map(|(unit, _)| {
                    let _ = unit;
                    items.iter()
                        .map(|item| item.total_amount.unwrap_or(0.0))
                        .sum::<f64>()
                });
            let amount_unit = aggregate_amounts.map(|(unit, _)| unit);
            let usage_percent = match (used_amount, total_amount) {
                (Some(used), Some(total)) if total > 0.0 => Some((used / total * 100.0).clamp(0.0, 100.0)),
                _ => None,
            };

            GatewaySummary {
                gateway_id,
                account_count,
                healthy_count,
                broken_count,
                usage_percent,
                used_amount,
                total_amount,
                amount_unit,
                top_alert_kind: highest_alert(items.iter().filter_map(|item| item.alert_kind.as_deref())),
                last_success_at: items.iter().filter_map(|item| item.last_success_at.clone()).max(),
            }
        })
        .collect()
}

fn compatible_absolute_amounts(items: &[&AccountSnapshot]) -> Option<(String, ())> {
    if items.is_empty() {
        return None;
    }

    let mut unit: Option<String> = None;
    for item in items {
        let used = item.used_amount?;
        let total = item.total_amount?;
        if !used.is_finite() || !total.is_finite() || total <= 0.0 {
            return None;
        }

        let item_unit = item.amount_unit.as_ref()?.clone();
        match &unit {
            Some(existing) if existing != &item_unit => return None,
            None => unit = Some(item_unit),
            _ => {}
        }
    }

    unit.map(|unit| (unit, ()))
}

fn highest_alert<'a>(alerts: impl Iterator<Item = &'a str>) -> Option<String> {
    fn rank(alert: &str) -> usize {
        match alert {
            "auth_invalid" => 4,
            "source_broken" => 3,
            "refresh_stale" => 2,
            "quota_low" => 1,
            _ => 0,
        }
    }

    alerts
        .max_by_key(|alert| rank(alert))
        .map(|alert| alert.to_owned())
}

fn merge_account_result(
    next: &mut HashMap<String, AccountSnapshot>,
    previous: &HashMap<String, AccountSnapshot>,
    gateway_id: GatewayId,
    account: &AccountConfig,
    source_id: String,
    result: Result<AccountSnapshot, AdapterError>,
) {
    match result {
        Ok(mut snapshot) => {
            snapshot.alert_kind = classify_alert(&snapshot);
            next.insert(source_id, snapshot);
        }
        Err(err) => {
            let refresh_status = if err.is_auth {
                "auth_invalid"
            } else {
                "source_broken"
            };

            let snapshot = if let Some(last_good) = previous.get(&source_id) {
                let mut merged = last_good.clone();
                merged.refresh_status = refresh_status.to_owned();
                merged.last_error = Some(err.message);
                merged.alert_kind = classify_alert(&merged);
                merged
            } else {
                error_snapshot(
                    gateway_id,
                    &account.account_id,
                    &source_id,
                    &account.label,
                    refresh_status,
                    &err.message,
                )
            };
            next.insert(source_id, snapshot);
        }
    }
}

fn classify_alert(snapshot: &AccountSnapshot) -> Option<String> {
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

fn error_snapshot(
    gateway_id: GatewayId,
    account_id: &str,
    source_id: &str,
    account_label: &str,
    refresh_status: &str,
    error_text: &str,
) -> AccountSnapshot {
    let mut snapshot = AccountSnapshot {
        source_id: source_id.to_owned(),
        gateway_id,
        account_id: account_id.to_owned(),
        vendor_family: gateway_id.as_str().to_owned(),
        source_kind: "custom_endpoint".to_owned(),
        account_label: account_label.to_owned(),
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

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_account(
        gateway: GatewayId,
        account: &str,
        percent: Option<f64>,
        used: Option<f64>,
        total: Option<f64>,
    ) -> AccountSnapshot {
        AccountSnapshot {
            source_id: format!("{}:{account}", gateway.as_str()),
            gateway_id: gateway,
            account_id: account.to_owned(),
            vendor_family: gateway.as_str().to_owned(),
            source_kind: "custom_endpoint".to_owned(),
            account_label: account.to_owned(),
            plan_name: None,
            usage_percent: percent,
            used_amount: used,
            total_amount: total,
            amount_unit: if used.is_some() && total.is_some() {
                Some("USD".to_owned())
            } else {
                None
            },
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
    fn aggregate_gateway_summary_omits_partial_totals() {
        let accounts = vec![
            fixture_account(GatewayId::Vibe, "main", Some(40.0), Some(20.0), Some(50.0)),
            fixture_account(GatewayId::Vibe, "backup", Some(55.0), None, None),
        ];

        let summaries = aggregate_gateway_summaries(&accounts);
        assert_eq!(summaries.len(), 2);
        assert_eq!(summaries[0].gateway_id, GatewayId::LlmGateway);
        assert_eq!(summaries[0].account_count, 0);
        assert_eq!(summaries[1].gateway_id, GatewayId::Vibe);
        assert_eq!(summaries[1].account_count, 2);
        assert_eq!(summaries[1].healthy_count, 2);
        assert_eq!(summaries[1].broken_count, 0);
        assert_eq!(summaries[1].used_amount, None);
        assert_eq!(summaries[1].total_amount, None);
        assert_eq!(summaries[1].amount_unit, None);
        assert_eq!(summaries[1].usage_percent, None);
    }

    #[test]
    fn aggregate_gateway_summaries_keeps_empty_fixed_gateways() {
        let accounts = vec![fixture_account(
            GatewayId::Vibe,
            "main",
            Some(40.0),
            Some(20.0),
            Some(50.0),
        )];

        let summaries = aggregate_gateway_summaries(&accounts);
        assert_eq!(summaries.len(), 2);
        assert_eq!(summaries[0].gateway_id, GatewayId::LlmGateway);
        assert_eq!(summaries[0].account_count, 0);
        assert_eq!(summaries[0].healthy_count, 0);
        assert_eq!(summaries[0].broken_count, 0);
        assert_eq!(summaries[0].usage_percent, None);
        assert_eq!(summaries[0].used_amount, None);
        assert_eq!(summaries[0].total_amount, None);
        assert_eq!(summaries[0].amount_unit, None);
        assert_eq!(summaries[0].top_alert_kind, None);
        assert_eq!(summaries[0].last_success_at, None);

        assert_eq!(summaries[1].gateway_id, GatewayId::Vibe);
        assert_eq!(summaries[1].account_count, 1);
    }
}
