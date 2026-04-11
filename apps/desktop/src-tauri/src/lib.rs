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

#[tauri::command]
fn read_materialized_state(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let base_dir = std::env::var("VIBE_MONITOR_RUNTIME_DIR")
        .map(PathBuf::from)
        .or_else(|_| app.path().app_data_dir().map_err(|e| e.to_string()))?;
    state_file::read_materialized_state(&base_dir)
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

            // Set env so read_materialized_state uses the correct path
            std::env::set_var("VIBE_MONITOR_RUNTIME_DIR", &data_dir);

            // Spawn usage-daemon sidecar
            let sidecar_result = app
                .shell()
                .sidecar("usage-daemon")
                .and_then(|cmd| {
                    Ok(cmd.env("VIBE_MONITOR_RUNTIME_DIR", data_dir.to_string_lossy().as_ref()))
                });

            match sidecar_result {
                Ok(cmd) => match cmd.spawn() {
                    Ok((rx, child)) => {
                        // Drain sidecar stdout/stderr to prevent pipe buffer from blocking the daemon
                        tauri::async_runtime::spawn(async move {
                            let mut rx = rx;
                            while let Some(_event) = rx.recv().await {}
                        });
                        app.manage(SidecarChild(std::sync::Mutex::new(Some(child))));
                    }
                    Err(e) => {
                        eprintln!("warning: failed to spawn usage-daemon sidecar: {e}");
                        app.manage(SidecarChild(std::sync::Mutex::new(None)));
                    }
                },
                Err(e) => {
                    eprintln!("warning: failed to create sidecar command: {e}");
                    app.manage(SidecarChild(std::sync::Mutex::new(None)));
                }
            }

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
