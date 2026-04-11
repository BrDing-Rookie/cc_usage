mod ring_icon;
mod state_file;
mod tray;

use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Arc;

use tauri::Manager;

use crate::tray::TraySharedState;

#[tauri::command]
fn read_materialized_state(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let base_dir = std::env::var("VIBE_MONITOR_RUNTIME_DIR")
        .map(PathBuf::from)
        .or_else(|_| app.path().app_data_dir().map_err(|e| e.to_string()))?;
    state_file::read_materialized_state(base_dir)
}

#[tauri::command]
fn popover_mouse_enter(state: tauri::State<'_, Arc<TraySharedState>>) {
    state.mouse_in_popover.store(true, Ordering::SeqCst);
}

#[tauri::command]
fn popover_mouse_leave(state: tauri::State<'_, Arc<TraySharedState>>) {
    state.mouse_in_popover.store(false, Ordering::SeqCst);
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_materialized_state,
            popover_mouse_enter,
            popover_mouse_leave,
        ])
        .setup(|app| {
            tray::setup_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run tauri app");
}
