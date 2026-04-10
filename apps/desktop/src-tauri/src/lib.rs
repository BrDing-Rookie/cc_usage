mod state_file;

use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
fn read_materialized_state(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let base_dir = std::env::var("VIBE_MONITOR_RUNTIME_DIR")
        .map(PathBuf::from)
        .or_else(|_| app.path().app_data_dir().map_err(|e| e.to_string()))?;
    state_file::read_materialized_state(base_dir)
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_materialized_state])
        .run(tauri::generate_context!())
        .expect("failed to run tauri app");
}
