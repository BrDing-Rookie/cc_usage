mod state_file;

use tauri::Manager;

#[tauri::command]
fn read_materialized_state(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    state_file::read_materialized_state(app.path().app_data_dir().map_err(|e| e.to_string())?)
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_materialized_state])
        .run(tauri::generate_context!())
        .expect("failed to run tauri app");
}
