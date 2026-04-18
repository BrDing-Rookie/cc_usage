mod ring_icon;
mod tray;
pub mod usage;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use tauri::Manager;

use crate::usage::config::{load_config, parse_config_value, write_config};
use crate::usage::{AppConfigState, RefreshHandle, UsageState};

struct BaseDir(PathBuf);

fn resolve_base_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Some(state) = app.try_state::<BaseDir>() {
        return Ok(state.0.clone());
    }
    app.path().app_data_dir().map_err(|e| e.to_string())
}

#[tauri::command]
fn read_materialized_state(
    state: tauri::State<'_, UsageState>,
) -> Result<serde_json::Value, String> {
    let guard = state.0.blocking_read();
    serde_json::to_value(&*guard).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_app_config(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let config_state = app
        .try_state::<AppConfigState>()
        .ok_or_else(|| "config state not found".to_string())?;
    let guard = config_state.0.blocking_read();
    serde_json::to_value(&*guard).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_app_config(
    app: tauri::AppHandle,
    config: serde_json::Value,
    config_state: tauri::State<'_, AppConfigState>,
) -> Result<(), String> {
    let base_dir = resolve_base_dir(&app)?;
    let parsed = parse_config_value(config);
    write_config(&base_dir, &parsed)?;
    *config_state.0.blocking_write() = parsed;

    Ok(())
}

#[tauri::command]
fn restart_daemon(app: tauri::AppHandle) -> Result<(), String> {
    let usage_state = app
        .try_state::<UsageState>()
        .ok_or_else(|| "usage state not found".to_string())?;
    let config_state = app
        .try_state::<AppConfigState>()
        .ok_or_else(|| "config state not found".to_string())?;
    let refresh_handle = app
        .try_state::<Mutex<RefreshHandle>>()
        .ok_or_else(|| "refresh handle not found".to_string())?;
    let mut handle = refresh_handle.lock().map_err(|e| e.to_string())?;

    usage::restart_refresh(&mut handle, usage_state.0.clone(), config_state.0.clone());
    Ok(())
}

pub fn run() {
    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_materialized_state,
            read_app_config,
            write_app_config,
            restart_daemon
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            let _ = app
                .handle()
                .set_activation_policy(tauri::ActivationPolicy::Accessory);

            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");

            std::fs::create_dir_all(data_dir.join("var")).ok();
            app.manage(BaseDir(data_dir.clone()));
            app.manage(AppConfigState(Arc::new(tokio::sync::RwLock::new(load_config(
                &data_dir,
            )))));

            let usage_state = UsageState::default();
            let state_arc = usage_state.0.clone();
            app.manage(usage_state);

            let config_arc = app.state::<AppConfigState>().0.clone();
            let token = usage::spawn_refresh_loop(state_arc, config_arc);
            app.manage(Mutex::new(RefreshHandle::new(token)));

            tray::setup_tray(app)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build tauri app");

    app.run(|_app_handle, _event| {});
}
