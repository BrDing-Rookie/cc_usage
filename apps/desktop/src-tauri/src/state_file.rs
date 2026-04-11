use std::fs;
use std::path::{Path, PathBuf};

pub fn materialized_state_path(base_dir: &Path) -> PathBuf {
    base_dir.join("var").join("current-snapshots.json")
}

pub fn read_materialized_state(base_dir: &Path) -> Result<serde_json::Value, String> {
    let path = materialized_state_path(base_dir);
    if !path.exists() {
        return Ok(serde_json::json!({
            "generatedAt": "1970-01-01T00:00:00.000Z",
            "sources": []
        }));
    }

    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use crate::state_file::materialized_state_path;
    use crate::state_file::read_materialized_state;

    #[test]
    fn resolves_current_snapshot_path_under_var() {
        let base = PathBuf::from("/tmp/vibe-monitor");
        let path = materialized_state_path(&base);
        assert_eq!(
            path,
            PathBuf::from("/tmp/vibe-monitor/var/current-snapshots.json")
        );
    }

    #[test]
    fn default_state_has_generated_at_and_sources() {
        let base = PathBuf::from("/tmp/vibe-monitor-missing");
        let value = read_materialized_state(&base).expect("expected default json");

        let obj = value.as_object().expect("expected object");
        assert!(obj.contains_key("generatedAt"));
        assert!(obj.get("sources").map(|v| v.is_array()).unwrap_or(false));
        assert!(!obj.contains_key("historyWindow"));
        assert!(!obj.contains_key("history"));
    }
}
