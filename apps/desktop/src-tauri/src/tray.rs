use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::webview::WebviewWindowBuilder;
use tauri::window::{Effect, EffectState, EffectsBuilder};
use tauri::{Manager, WebviewUrl, WindowEvent};

use crate::ring_icon;
use crate::usage::config::AppConfig;
use crate::usage::{AccountSnapshot, AppConfigState, UsageState};

const POPOVER_WIDTH: f64 = 320.0;
const POPOVER_HEIGHT: f64 = 340.0;

pub struct TraySharedState {
    pub pinned: AtomicBool,
}

impl TraySharedState {
    fn new() -> Self {
        Self {
            pinned: AtomicBool::new(false),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
struct TrayDisplay {
    label: String,
    percent: f64,
    show_overflow_warning: bool,
}

#[cfg_attr(not(test), allow(dead_code))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TrayInteraction {
    Enter,
    Leave,
    LeftClickUp,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PopoverAction {
    Noop,
    Show,
    Hide,
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
        .inner_size(POPOVER_WIDTH, POPOVER_HEIGHT)
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
    let initial_png = ring_icon::generate_ring_png(0.0, false);
    let icon = tauri::image::Image::from_bytes(&initial_png)?;

    // Right-click menu
    let settings_item = MenuItemBuilder::with_id("settings", "Settings...").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit Vibe Monitor").build(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[&settings_item, &quit_item])
        .build()?;

    // Build tray icon
    let popover_click = popover.clone();
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
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } => match next_popover_state(
                shared_click.pinned.load(Ordering::SeqCst),
                &TrayInteraction::LeftClickUp,
            ) {
                PopoverAction::Show => {
                    shared_click.pinned.store(true, Ordering::SeqCst);
                    let (width, _) = popover_dimensions();
                    position_popover(&popover_click, &rect, width);
                    let _ = popover_click.show();
                    let _ = popover_click.set_focus();
                }
                PopoverAction::Hide => {
                    shared_click.pinned.store(false, Ordering::SeqCst);
                    let _ = popover_click.hide();
                }
                PopoverAction::Noop => {}
            },
            _ => {}
        })
        .build(app)?;

    // Background thread: poll in-memory state and update tray icon
    let app_handle = app.handle().clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_secs(5));

            if let Some(usage_state) = app_handle.try_state::<UsageState>() {
                let guard = usage_state.0.blocking_read();
                let config = app_handle
                    .try_state::<AppConfigState>()
                    .map(|state| state.0.blocking_read().clone())
                    .unwrap_or_default();
                let display = resolve_tray_display(&config, &guard.accounts);
                let png = ring_icon::generate_ring_png(
                    display.percent,
                    display.show_overflow_warning,
                );
                if let Ok(icon) = tauri::image::Image::from_bytes(&png) {
                    if let Some(tray) = app_handle.tray_by_id("main") {
                        let _ = tray.set_icon(Some(icon));
                        let _ = tray.set_tooltip(Some(&format!(
                            "{}: {:.0}%",
                            display.label, display.percent
                        )));
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

fn resolve_tray_display(config: &AppConfig, accounts: &[AccountSnapshot]) -> TrayDisplay {
    let pinned_id = config.status_bar.pinned_account_id.as_deref();
    let pinned = accounts
        .iter()
        .find(|account| Some(account.source_id.as_str()) == pinned_id);

    match pinned {
        Some(account) => TrayDisplay {
            label: account.account_label.clone(),
            percent: account.usage_percent.unwrap_or(0.0),
            show_overflow_warning: accounts.iter().any(|other| {
                other.source_id != account.source_id && other.usage_percent.unwrap_or(0.0) >= 80.0
            }),
        },
        None => TrayDisplay {
            label: "no data".to_owned(),
            percent: 0.0,
            show_overflow_warning: false,
        },
    }
}

fn next_popover_state(is_open: bool, interaction: &TrayInteraction) -> PopoverAction {
    match (is_open, interaction) {
        (_, TrayInteraction::Enter | TrayInteraction::Leave) => PopoverAction::Noop,
        (false, TrayInteraction::LeftClickUp) => PopoverAction::Show,
        (true, TrayInteraction::LeftClickUp) => PopoverAction::Hide,
    }
}

fn popover_dimensions() -> (f64, f64) {
    (POPOVER_WIDTH, POPOVER_HEIGHT)
}

fn show_settings_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.destroy();
    }

    let url = WebviewUrl::App("index.html?view=settings".into());
    let _ = WebviewWindowBuilder::new(app, "settings", url)
        .title("Settings")
        .inner_size(400.0, 340.0)
        .resizable(false)
        .build();
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::usage::config::{AppConfig, GatewayConfig, GatewayId, StatusBarConfig};
    use crate::usage::{AccountSnapshot, Capabilities};

    fn fixture_config(pinned: Option<&str>) -> AppConfig {
        AppConfig {
            status_bar: StatusBarConfig {
                pinned_account_id: pinned.map(str::to_owned),
            },
            gateways: vec![
                GatewayConfig {
                    gateway_id: GatewayId::LlmGateway,
                    accounts: vec![],
                },
                GatewayConfig {
                    gateway_id: GatewayId::Vibe,
                    accounts: vec![],
                },
            ],
        }
    }

    fn fixture_account(
        gateway: GatewayId,
        account: &str,
        label: &str,
        percent: Option<f64>,
        refresh_status: &str,
        alert_kind: Option<&str>,
    ) -> AccountSnapshot {
        AccountSnapshot {
            source_id: format!("{}:{account}", gateway.as_str()),
            gateway_id: gateway,
            account_id: account.to_owned(),
            vendor_family: gateway.as_str().to_owned(),
            source_kind: "custom_endpoint".to_owned(),
            account_label: label.to_owned(),
            plan_name: None,
            usage_percent: percent,
            used_amount: None,
            total_amount: None,
            amount_unit: Some("USD".to_owned()),
            reset_at: None,
            refresh_status: refresh_status.to_owned(),
            last_success_at: Some("2026-04-18T09:59:00.000Z".to_owned()),
            last_error: None,
            alert_kind: alert_kind.map(str::to_owned),
            capabilities: Capabilities {
                percent: true,
                absolute_amount: false,
                reset_time: false,
                plan_name: false,
                health_signal: true,
            },
            windows: vec![],
        }
    }

    #[test]
    fn resolve_tray_display_uses_pinned_account_and_warns_on_other_high_usage() {
        let config = fixture_config(Some("vibe:main"));
        let accounts = vec![
            fixture_account(GatewayId::Vibe, "main", "Main", Some(42.0), "ok", None),
            fixture_account(
                GatewayId::LlmGateway,
                "prod",
                "Production",
                Some(91.0),
                "ok",
                None,
            ),
        ];

        let display = resolve_tray_display(&config, &accounts);
        assert_eq!(display.label, "Main");
        assert_eq!(display.percent, 42.0);
        assert!(display.show_overflow_warning);
    }

    #[test]
    fn resolve_tray_display_ignores_non_pinned_errors_for_warning_state() {
        let config = fixture_config(Some("vibe:main"));
        let accounts = vec![
            fixture_account(GatewayId::Vibe, "main", "Main", Some(42.0), "ok", None),
            fixture_account(
                GatewayId::LlmGateway,
                "prod",
                "Production",
                Some(12.0),
                "auth_invalid",
                Some("auth_invalid"),
            ),
            fixture_account(
                GatewayId::LlmGateway,
                "backup",
                "Backup",
                Some(8.0),
                "source_broken",
                Some("source_broken"),
            ),
        ];

        let display = resolve_tray_display(&config, &accounts);
        assert_eq!(display.label, "Main");
        assert_eq!(display.percent, 42.0);
        assert!(!display.show_overflow_warning);
    }

    #[test]
    fn tray_click_behavior_only_toggles_on_left_button_release() {
        assert_eq!(
            next_popover_state(false, &TrayInteraction::Enter),
            PopoverAction::Noop
        );
        assert_eq!(
            next_popover_state(true, &TrayInteraction::Leave),
            PopoverAction::Noop
        );
        assert_eq!(
            next_popover_state(false, &TrayInteraction::LeftClickUp),
            PopoverAction::Show
        );
        assert_eq!(
            next_popover_state(true, &TrayInteraction::LeftClickUp),
            PopoverAction::Hide
        );
    }

    #[test]
    fn popover_dimensions_fit_multi_gateway_layout() {
        let (width, height) = popover_dimensions();
        assert!(width >= 320.0);
        assert!(height >= 300.0);
    }
}
