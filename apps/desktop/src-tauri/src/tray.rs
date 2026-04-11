use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::webview::WebviewWindowBuilder;
use tauri::window::{Effect, EffectState, EffectsBuilder};
use tauri::{Manager, WebviewUrl, WindowEvent};

use crate::ring_icon;
use crate::state_file;

pub struct TraySharedState {
    pub pinned: AtomicBool,
    pub mouse_in_popover: AtomicBool,
    hide_generation: AtomicU64,
}

impl TraySharedState {
    fn new() -> Self {
        Self {
            pinned: AtomicBool::new(false),
            mouse_in_popover: AtomicBool::new(false),
            hide_generation: AtomicU64::new(0),
        }
    }
}

pub fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let shared = Arc::new(TraySharedState::new());

    // Create hidden popover window with native macOS vibrancy
    let effects = EffectsBuilder::new()
        .effect(Effect::Popover)
        .state(EffectState::Active)
        .radius(12.0)
        .build();

    let popover = WebviewWindowBuilder::new(app, "popover", WebviewUrl::App("index.html".into()))
        .title("")
        .inner_size(280.0, 130.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .visible(false)
        .effects(effects)
        .build()?;

    // Dismiss popover when it loses focus (click-outside-to-close)
    let shared_focus = shared.clone();
    let popover_focus = popover.clone();
    popover.on_window_event(move |event| {
        if let WindowEvent::Focused(false) = event {
            if shared_focus.pinned.load(Ordering::SeqCst) {
                shared_focus.pinned.store(false, Ordering::SeqCst);
                let _ = popover_focus.hide();
            }
        }
    });

    // Store shared state in app for commands to access
    app.manage(shared.clone());

    // Initial icon (empty ring)
    let initial_png = ring_icon::generate_ring_png(0.0);
    let icon = tauri::image::Image::from_bytes(&initial_png)?;

    // Right-click menu
    let settings_item = MenuItemBuilder::with_id("settings", "Settings...").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit Vibe Monitor").build(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[&settings_item, &quit_item])
        .build()?;

    // Build tray icon
    let popover_enter = popover.clone();
    let popover_leave = popover.clone();
    let popover_click = popover.clone();
    let shared_enter = shared.clone();
    let shared_leave = shared.clone();
    let shared_click = shared.clone();

    let _tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .icon_as_template(false)
        .tooltip("Vibe Usage Monitor")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "settings" => show_settings_window(app),
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(move |_tray, event| match event {
            TrayIconEvent::Enter { rect, .. } => {
                if !shared_enter.pinned.load(Ordering::SeqCst) {
                    position_popover(&popover_enter, &rect, 280.0);
                    let _ = popover_enter.show();
                }
            }
            TrayIconEvent::Leave { .. } => {
                if !shared_leave.pinned.load(Ordering::SeqCst) {
                    let gen = shared_leave.hide_generation.fetch_add(1, Ordering::SeqCst) + 1;
                    let shared_delayed = shared_leave.clone();
                    let popover_delayed = popover_leave.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(Duration::from_millis(400));
                        if shared_delayed.hide_generation.load(Ordering::SeqCst) == gen
                            && !shared_delayed.mouse_in_popover.load(Ordering::SeqCst)
                            && !shared_delayed.pinned.load(Ordering::SeqCst)
                        {
                            let _ = popover_delayed.hide();
                        }
                    });
                }
            }
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } => {
                if shared_click.pinned.load(Ordering::SeqCst) {
                    shared_click.pinned.store(false, Ordering::SeqCst);
                    let _ = popover_click.hide();
                } else {
                    shared_click.pinned.store(true, Ordering::SeqCst);
                    position_popover(&popover_click, &rect, 280.0);
                    let _ = popover_click.show();
                    let _ = popover_click.set_focus();
                }
            }
            _ => {}
        })
        .build(app)?;

    // Background thread: poll state file and update tray icon
    let app_handle = app.handle().clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_secs(5));

            let base_dir = app_handle
                .try_state::<crate::BaseDir>()
                .map(|s| s.0.clone())
                .unwrap_or_else(|| {
                    app_handle
                        .path()
                        .app_data_dir()
                        .unwrap_or_else(|_| PathBuf::from("."))
                });

            if let Ok(state) = state_file::read_materialized_state(&base_dir) {
                let (label, percent) = extract_max_usage(&state);
                let png = ring_icon::generate_ring_png(percent);
                if let Ok(icon) = tauri::image::Image::from_bytes(&png) {
                    if let Some(tray) = app_handle.tray_by_id("main") {
                        let _ = tray.set_icon(Some(icon));
                        let _ = tray
                            .set_tooltip(Some(&format!("{}: {:.0}%", label, percent)));
                    }
                }
            }
        }
    });

    Ok(())
}

fn position_popover(
    window: &tauri::WebviewWindow,
    rect: &tauri::Rect,
    window_width: f64,
) {
    // Convert Position/Size enums to logical values (scale factor 1.0 for physical→logical)
    let pos = rect.position.to_logical::<f64>(1.0);
    let sz = rect.size.to_logical::<f64>(1.0);
    let x = pos.x - (window_width / 2.0) + (sz.width / 2.0);
    let y = pos.y + sz.height + 4.0;
    let _ = window.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
}

/// Return the source with the highest usagePercent, along with its label and value.
fn extract_max_usage(state: &serde_json::Value) -> (String, f64) {
    state["sources"]
        .as_array()
        .and_then(|sources| {
            sources
                .iter()
                .filter_map(|s| {
                    let id = s["sourceId"].as_str()?;
                    let pct = s["usagePercent"].as_f64()?;
                    Some((id.to_owned(), pct))
                })
                .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        })
        .unwrap_or_else(|| ("no data".to_owned(), 0.0))
}

fn show_settings_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }

    let url = WebviewUrl::App("index.html?view=settings".into());
    let _ = WebviewWindowBuilder::new(app, "settings", url)
        .title("Settings")
        .inner_size(400.0, 340.0)
        .resizable(false)
        .build();
}
