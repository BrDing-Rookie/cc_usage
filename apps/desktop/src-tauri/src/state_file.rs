use std::fs;
use std::path::{Path, PathBuf};

pub fn materialized_state_path(base_dir: &Path) -> PathBuf {
    base_dir.join("var").join("current-snapshots.json")
}

pub fn read_materialized_state(base_dir: PathBuf) -> Result<serde_json::Value, String> {
    let path = materialized_state_path(&base_dir);
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

    #[test]
    fn resolves_current_snapshot_path_under_var() {
        let base = PathBuf::from("/tmp/vibe-monitor");
        let path = materialized_state_path(&base);
        assert_eq!(
            path,
            PathBuf::from("/tmp/vibe-monitor/var/current-snapshots.json")
        );
    }
}
