use std::path::Path;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StatusBarConfig {
    pub pinned_account_id: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccountConfig {
    pub account_id: String,
    pub label: String,
    pub api_key: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayConfig {
    pub gateway_id: GatewayId,
    #[serde(default)]
    pub accounts: Vec<AccountConfig>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default)]
    pub status_bar: StatusBarConfig,
    #[serde(default = "default_gateways")]
    pub gateways: Vec<GatewayConfig>,
}

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    Hash,
    PartialOrd,
    Ord,
    serde::Serialize,
    serde::Deserialize,
)]
#[serde(rename_all = "kebab-case")]
pub enum GatewayId {
    LlmGateway,
    Vibe,
}

pub struct GatewayPreset {
    pub base_url: &'static str,
}

impl GatewayId {
    pub const ALL: [GatewayId; 2] = [GatewayId::LlmGateway, GatewayId::Vibe];

    pub fn as_str(&self) -> &'static str {
        match self {
            GatewayId::LlmGateway => "llm-gateway",
            GatewayId::Vibe => "vibe",
        }
    }

    pub fn preset(&self) -> GatewayPreset {
        match self {
            GatewayId::LlmGateway => GatewayPreset {
                base_url: "https://llm-gateway.mlamp.cn",
            },
            GatewayId::Vibe => GatewayPreset {
                base_url: "https://vibe.deepminer.ai",
            },
        }
    }
}

pub fn load_config(base_dir: &Path) -> AppConfig {
    let path = base_dir.join("config.json");
    let raw = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return AppConfig::default(),
    };

    let parsed: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return AppConfig::default(),
    };

    parse_config_value(parsed)
}

pub fn write_config(base_dir: &Path, config: &AppConfig) -> Result<(), String> {
    std::fs::create_dir_all(base_dir).map_err(|e| e.to_string())?;
    let path = base_dir.join("config.json");
    let tmp_path = base_dir.join("config.json.tmp");
    let pretty = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;

    std::fs::write(&tmp_path, &pretty).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp_path, &path).map_err(|e| e.to_string())?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }

    Ok(())
}

pub fn parse_config_value(raw: serde_json::Value) -> AppConfig {
    let migrated = migrate(raw);
    serde_json::from_value(migrated).unwrap_or_default()
}

impl Default for StatusBarConfig {
    fn default() -> Self {
        Self {
            pinned_account_id: None,
        }
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            status_bar: StatusBarConfig::default(),
            gateways: default_gateways(),
        }
    }
}

fn default_enabled() -> bool {
    true
}

fn default_gateways() -> Vec<GatewayConfig> {
    GatewayId::ALL
        .into_iter()
        .map(|gateway_id| GatewayConfig {
            gateway_id,
            accounts: vec![],
        })
        .collect()
}

fn migrate(raw: serde_json::Value) -> serde_json::Value {
    let Some(obj) = raw.as_object() else {
        return serde_json::to_value(AppConfig::default()).unwrap_or(raw);
    };

    if obj.contains_key("gateways") {
        let mut normalized = obj.clone();
        let status_bar = normalized.remove("statusBar");
        normalized.insert("statusBar".to_owned(), normalize_status_bar(status_bar));
        let gateways = normalized.remove("gateways");
        normalized.insert(
            "gateways".to_owned(),
            normalize_gateway_array(gateways),
        );
        return serde_json::Value::Object(normalized);
    }

    let mut legacy = obj.clone();
    let renames = [("mininglamp", "llm-gateway"), ("litellm", "vibe")];
    for (old, new) in renames {
        if legacy.contains_key(old) && !legacy.contains_key(new) {
            if let Some(v) = legacy.remove(old) {
                legacy.insert(new.to_owned(), v);
            }
        }
    }

    if let Some(ag) = legacy.get("activeGateway").and_then(|v| v.as_str()) {
        for (old, new) in renames {
            if ag == old {
                legacy.insert(
                    "activeGateway".to_owned(),
                    serde_json::Value::String(new.to_owned()),
                );
                break;
            }
        }
    }

    let active_gateway = legacy
        .get("activeGateway")
        .and_then(|v| v.as_str())
        .and_then(GatewayId::from_str);

    let mut gateways = vec![];
    for gateway_id in GatewayId::ALL {
        let section = legacy
            .get(gateway_id.as_str())
            .and_then(|value| value.as_object())
            .cloned()
            .unwrap_or_default();

        let api_key = section
            .get("apiKey")
            .and_then(|value| value.as_str())
            .filter(|value| !value.is_empty())
            .map(|value| value.to_owned());

        let mut accounts = vec![];
        if let Some(api_key) = api_key {
            accounts.push(serde_json::json!({
                "accountId": "default",
                "label": "Default",
                "apiKey": api_key,
                "enabled": true
            }));
        }

        gateways.push(serde_json::json!({
            "gatewayId": gateway_id.as_str(),
            "accounts": accounts
        }));
    }

    let pinned_account_id = active_gateway
        .and_then(|gateway_id| {
            gateways.iter().find_map(|gateway| {
                let gateway_id_matches =
                    gateway["gatewayId"].as_str() == Some(gateway_id.as_str());
                let has_account = gateway["accounts"]
                    .as_array()
                    .map(|accounts| !accounts.is_empty())
                    .unwrap_or(false);
                if gateway_id_matches && has_account {
                    Some(format!("{}:default", gateway_id.as_str()))
                } else {
                    None
                }
            })
        })
        .or_else(|| {
            gateways.iter().find_map(|gateway| {
                let gateway_id = gateway["gatewayId"].as_str()?;
                let account_id = gateway["accounts"].as_array()?.first()?["accountId"].as_str()?;
                Some(format!("{gateway_id}:{account_id}"))
            })
        });

    serde_json::json!({
        "statusBar": {
            "pinnedAccountId": pinned_account_id
        },
        "gateways": gateways
    })
}

fn normalize_gateway_array(raw: Option<serde_json::Value>) -> serde_json::Value {
    let mut by_id = std::collections::BTreeMap::<GatewayId, serde_json::Value>::new();

    if let Some(items) = raw.and_then(|value| value.as_array().cloned()) {
        for item in items {
            let gateway_id = item
                .get("gatewayId")
                .and_then(|value| value.as_str())
                .and_then(GatewayId::from_str);
            if let Some(gateway_id) = gateway_id {
                by_id.insert(
                    gateway_id,
                    serde_json::json!({
                        "gatewayId": gateway_id.as_str(),
                        "accounts": normalize_accounts(item.get("accounts"))
                    }),
                );
            }
        }
    }

    serde_json::Value::Array(
        GatewayId::ALL
            .into_iter()
            .map(|gateway_id| {
                by_id.remove(&gateway_id).unwrap_or_else(|| {
                    serde_json::json!({
                        "gatewayId": gateway_id.as_str(),
                        "accounts": []
                    })
                })
            })
            .collect(),
    )
}

fn normalize_status_bar(raw: Option<serde_json::Value>) -> serde_json::Value {
    let mut status_bar = raw.and_then(|value| value.as_object().cloned()).unwrap_or_default();

    if !status_bar.contains_key("pinnedAccountId") {
        status_bar.insert("pinnedAccountId".to_owned(), serde_json::Value::Null);
    }

    serde_json::Value::Object(status_bar)
}

fn normalize_accounts(raw: Option<&serde_json::Value>) -> Vec<serde_json::Value> {
    raw.and_then(|value| value.as_array())
        .map(|accounts| {
            accounts
                .iter()
                .filter_map(|account| {
                    let account_id = account.get("accountId")?.as_str()?.trim();
                    let label = account.get("label")?.as_str()?.trim();
                    let api_key = account.get("apiKey")?.as_str()?.trim();
                    if account_id.is_empty() || label.is_empty() || api_key.is_empty() {
                        return None;
                    }

                    Some(serde_json::json!({
                        "accountId": account_id,
                        "label": label,
                        "apiKey": api_key,
                        "enabled": account
                            .get("enabled")
                            .and_then(|value| value.as_bool())
                            .unwrap_or(true)
                    }))
                })
                .collect()
        })
        .unwrap_or_default()
}

impl GatewayId {
    fn from_str(value: &str) -> Option<Self> {
        match value {
            "llm-gateway" => Some(GatewayId::LlmGateway),
            "vibe" => Some(GatewayId::Vibe),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_uses_two_empty_gateways() {
        let cfg = AppConfig::default();
        assert_eq!(cfg.status_bar.pinned_account_id, None);
        assert_eq!(cfg.gateways.len(), 2);
        assert_eq!(cfg.gateways[0].gateway_id, GatewayId::LlmGateway);
        assert_eq!(cfg.gateways[1].gateway_id, GatewayId::Vibe);
    }

    #[test]
    fn migrate_renames_legacy_sections() {
        let raw = serde_json::json!({
            "activeGateway": "mininglamp",
            "mininglamp": { "baseUrl": "https://x.com", "apiKey": "sk-1" }
        });
        let m = migrate(raw);
        assert_eq!(m["statusBar"]["pinnedAccountId"], "llm-gateway:default");
        assert_eq!(m["gateways"][0]["gatewayId"], "llm-gateway");
        assert_eq!(m["gateways"][0]["accounts"][0]["apiKey"], "sk-1");
    }

    #[test]
    fn missing_active_gateway_defaults_to_first_available_account() {
        let raw = serde_json::json!({
            "vibe": { "apiKey": "sk-2" }
        });
        let cfg = parse_config_value(raw);
        assert_eq!(
            cfg.status_bar.pinned_account_id.as_deref(),
            Some("vibe:default")
        );
    }

    #[test]
    fn migrate_legacy_single_key_sections_into_accounts() {
        let raw = serde_json::json!({
            "activeGateway": "vibe",
            "llm-gateway": { "apiKey": "sk-llm" },
            "vibe": { "apiKey": "sk-vibe" }
        });

        let cfg = parse_config_value(raw);
        assert_eq!(
            cfg.status_bar.pinned_account_id.as_deref(),
            Some("vibe:default")
        );
        assert_eq!(cfg.gateways.len(), 2);
        assert_eq!(cfg.gateways[0].gateway_id, GatewayId::LlmGateway);
        assert_eq!(cfg.gateways[0].accounts[0].account_id, "default");
        assert_eq!(cfg.gateways[0].accounts[0].label, "Default");
        assert_eq!(cfg.gateways[0].accounts[0].api_key, "sk-llm");
        assert!(cfg.gateways[0].accounts[0].enabled);
        assert_eq!(cfg.gateways[1].gateway_id, GatewayId::Vibe);
        assert_eq!(cfg.gateways[1].accounts[0].account_id, "default");
        assert_eq!(cfg.gateways[1].accounts[0].api_key, "sk-vibe");
    }

    #[test]
    fn partial_status_bar_keeps_new_shape_gateways() {
        let raw = serde_json::json!({
            "statusBar": {},
            "gateways": [
                {
                    "gatewayId": "vibe",
                    "accounts": [
                        {
                            "accountId": "main",
                            "label": "Main",
                            "apiKey": "sk-vibe",
                            "enabled": true
                        }
                    ]
                }
            ]
        });

        let cfg = parse_config_value(raw);
        assert_eq!(cfg.status_bar.pinned_account_id, None);
        assert_eq!(cfg.gateways.len(), 2);
        assert_eq!(cfg.gateways[0].gateway_id, GatewayId::LlmGateway);
        assert!(cfg.gateways[0].accounts.is_empty());
        assert_eq!(cfg.gateways[1].gateway_id, GatewayId::Vibe);
        assert_eq!(cfg.gateways[1].accounts.len(), 1);
        assert_eq!(cfg.gateways[1].accounts[0].account_id, "main");
        assert_eq!(cfg.gateways[1].accounts[0].label, "Main");
        assert_eq!(cfg.gateways[1].accounts[0].api_key, "sk-vibe");
    }

    #[test]
    fn migrate_new_shape_defaults_missing_pinned_account_id_to_null() {
        let raw = serde_json::json!({
            "statusBar": {},
            "gateways": [
                {
                    "gatewayId": "vibe",
                    "accounts": [
                        {
                            "accountId": "main",
                            "label": "Main",
                            "apiKey": "sk-vibe"
                        }
                    ]
                }
            ]
        });

        let migrated = migrate(raw);
        let status_bar = migrated["statusBar"]
            .as_object()
            .expect("statusBar should remain an object");
        assert!(status_bar.contains_key("pinnedAccountId"));
        assert!(status_bar["pinnedAccountId"].is_null());
        assert_eq!(migrated["gateways"][1]["accounts"][0]["accountId"], "main");
    }
}
