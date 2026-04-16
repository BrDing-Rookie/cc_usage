use std::path::Path;

pub struct AppConfig {
    pub active_gateway: GatewayId,
    pub llm_gateway_key: Option<String>,
    pub vibe_key: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GatewayId {
    LlmGateway,
    Vibe,
}

pub struct GatewayPreset {
    pub base_url: &'static str,
}

impl GatewayId {
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

    let migrated = migrate(parsed);

    let active_gateway = match migrated["activeGateway"].as_str() {
        Some("vibe") => GatewayId::Vibe,
        _ => GatewayId::LlmGateway,
    };

    let llm_gateway_key = migrated["llm-gateway"]["apiKey"]
        .as_str()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_owned());

    let vibe_key = migrated["vibe"]["apiKey"]
        .as_str()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_owned());

    AppConfig {
        active_gateway,
        llm_gateway_key,
        vibe_key,
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            active_gateway: GatewayId::LlmGateway,
            llm_gateway_key: None,
            vibe_key: None,
        }
    }
}

fn migrate(raw: serde_json::Value) -> serde_json::Value {
    let Some(obj) = raw.as_object() else {
        return raw;
    };
    let mut m = obj.clone();

    // Rename legacy section names
    let renames = [("mininglamp", "llm-gateway"), ("litellm", "vibe")];
    for (old, new) in renames {
        if m.contains_key(old) && !m.contains_key(new) {
            if let Some(v) = m.remove(old) {
                m.insert(new.to_owned(), v);
            }
        }
    }

    // Rename legacy activeGateway value
    if let Some(ag) = m.get("activeGateway").and_then(|v| v.as_str()) {
        for (old, new) in renames {
            if ag == old {
                m.insert(
                    "activeGateway".to_owned(),
                    serde_json::Value::String(new.to_owned()),
                );
                break;
            }
        }
    }

    // Strip legacy baseUrl from gateway sections
    for key in ["llm-gateway", "vibe"] {
        if let Some(section) = m.get_mut(key).and_then(|v| v.as_object_mut()) {
            section.remove("baseUrl");
            if section.is_empty() {
                m.remove(key);
            }
        }
    }

    serde_json::Value::Object(m)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_uses_llm_gateway() {
        let cfg = AppConfig::default();
        assert_eq!(cfg.active_gateway, GatewayId::LlmGateway);
    }

    #[test]
    fn migrate_renames_legacy_sections() {
        let raw = serde_json::json!({
            "activeGateway": "mininglamp",
            "mininglamp": { "baseUrl": "https://x.com", "apiKey": "sk-1" }
        });
        let m = migrate(raw);
        assert_eq!(m["activeGateway"], "llm-gateway");
        assert_eq!(m["llm-gateway"]["apiKey"], "sk-1");
        assert!(m["llm-gateway"].get("baseUrl").is_none());
    }

    #[test]
    fn missing_active_gateway_defaults_to_llm_gateway() {
        let raw = serde_json::json!({
            "vibe": { "apiKey": "sk-2" }
        });
        let m = migrate(raw);
        // No activeGateway in JSON → load_config falls through to default
        assert!(m.get("activeGateway").is_none());
    }
}
