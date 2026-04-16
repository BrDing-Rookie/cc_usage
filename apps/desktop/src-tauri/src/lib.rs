mod ring_icon;
mod tray;
pub mod usage;

use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Arc;

use tauri::Manager;

use crate::tray::TraySharedState;
use crate::usage::{RefreshHandle, UsageState};

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
    let base_dir = resolve_base_dir(&app)?;
    let path = base_dir.join("config.json");
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_app_config(app: tauri::AppHandle, config: serde_json::Value) -> Result<(), String> {
    let base_dir = resolve_base_dir(&app)?;
    std::fs::create_dir_all(&base_dir).map_err(|e| e.to_string())?;
    let path = base_dir.join("config.json");
    let tmp_path = base_dir.join("config.json.tmp");
    let pretty = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;

    std::fs::write(&tmp_path, &pretty).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp_path, &path).map_err(|e| e.to_string())?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }

    Ok(())
}

#[tauri::command]
fn restart_daemon(app: tauri::AppHandle) -> Result<(), String> {
    let base_dir = resolve_base_dir(&app)?;
    let usage_state = app
        .try_state::<UsageState>()
        .ok_or_else(|| "usage state not found".to_string())?;
    let refresh_handle = app
        .try_state::<std::sync::Mutex<RefreshHandle>>()
        .ok_or_else(|| "refresh handle not found".to_string())?;
    let mut handle = refresh_handle.lock().map_err(|e| e.to_string())?;

    usage::restart_refresh(&mut handle, base_dir, usage_state.0.clone());
    Ok(())
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
    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_materialized_state,
            read_app_config,
            write_app_config,
            restart_daemon,
            popover_mouse_enter,
            popover_mouse_leave,
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

            let usage_state = UsageState::default();
            let state_arc = usage_state.0.clone();
            app.manage(usage_state);

            let token = usage::spawn_refresh_loop(data_dir, state_arc);
            app.manage(std::sync::Mutex::new(RefreshHandle::new(token)));

            tray::setup_tray(app)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build tauri app");

    app.run(|_app_handle, _event| {});
}
