mod ring_icon;
mod state_file;
mod tray;

use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Arc;

use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

use crate::tray::TraySharedState;

/// Holds the sidecar child process so it can be killed on app exit.
struct SidecarChild(std::sync::Mutex<Option<CommandChild>>);

fn resolve_base_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    std::env::var("VIBE_MONITOR_RUNTIME_DIR")
        .map(PathBuf::from)
        .or_else(|_| app.path().app_data_dir().map_err(|e| e.to_string()))
}

/// Spawn the usage-daemon sidecar and return the child handle.
fn spawn_sidecar(app: &tauri::AppHandle) -> Option<CommandChild> {
    let data_dir = resolve_base_dir(app).ok()?;

    let cmd = app
        .shell()
        .sidecar("usage-daemon")
        .and_then(|c| Ok(c.env("VIBE_MONITOR_RUNTIME_DIR", data_dir.to_string_lossy().as_ref())));

    match cmd {
        Ok(c) => match c.spawn() {
            Ok((rx, child)) => {
                tauri::async_runtime::spawn(async move {
                    let mut rx = rx;
                    while let Some(_event) = rx.recv().await {}
                });
                Some(child)
            }
            Err(e) => {
                eprintln!("warning: failed to spawn usage-daemon sidecar: {e}");
                None
            }
        },
        Err(e) => {
            eprintln!("warning: failed to create sidecar command: {e}");
            None
        }
    }
}

#[tauri::command]
fn read_materialized_state(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let base_dir = resolve_base_dir(&app)?;
    state_file::read_materialized_state(&base_dir)
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
    let pretty = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&path, pretty).map_err(|e| e.to_string())
}

#[tauri::command]
fn restart_daemon(app: tauri::AppHandle) -> Result<(), String> {
    let state = app
        .try_state::<SidecarChild>()
        .ok_or_else(|| "sidecar state not found".to_string())?;
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;

    // Kill existing sidecar
    if let Some(child) = guard.take() {
        let _ = child.kill();
    }

    // Spawn new sidecar
    *guard = spawn_sidecar(&app);
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
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            read_materialized_state,
            read_app_config,
            write_app_config,
            restart_daemon,
            popover_mouse_enter,
            popover_mouse_leave,
        ])
        .setup(|app| {
            // Hide dock icon — run as menu bar accessory only.
            // Info.plist sets LSUIElement=true for the bundled .app, but that has
            // no effect during `tauri dev` (no bundle). This runtime call covers
            // both dev and production.
            #[cfg(target_os = "macos")]
            let _ = app.handle().set_activation_policy(tauri::ActivationPolicy::Accessory);

            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");

            // Ensure runtime directory exists
            let var_dir = data_dir.join("var");
            std::fs::create_dir_all(&var_dir).ok();

            // Set env so resolve_base_dir uses the correct path
            std::env::set_var("VIBE_MONITOR_RUNTIME_DIR", &data_dir);

            // Spawn usage-daemon sidecar
            let child = spawn_sidecar(app.handle());
            app.manage(SidecarChild(std::sync::Mutex::new(child)));

            tray::setup_tray(app)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build tauri app");

    app.run(|app_handle, event| {
        match event {
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                if let Some(state) = app_handle.try_state::<SidecarChild>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
            _ => {}
        }
    });
}
