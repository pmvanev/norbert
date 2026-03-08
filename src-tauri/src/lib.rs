pub mod domain;
pub mod ports;

use domain::{APP_NAME, AppStatus, VERSION, WindowAction, format_tooltip, initial_status, toggle_window_action};
use tauri::Manager;

/// Greet command exposed to the frontend via Tauri IPC.
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Norbert v{}.", name, VERSION)
}

/// Return current application status to the frontend via Tauri IPC.
///
/// Returns a snapshot of version, listening status, port, and counters.
/// For the walking skeleton, returns initial hardcoded values.
#[tauri::command]
fn get_status() -> AppStatus {
    initial_status()
}

/// Build and configure the Tauri application.
///
/// This is the library entry point called by the binary.
/// Registers the tray icon with tooltip, tray click handler,
/// window close interceptor, and all Tauri commands.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let tooltip = format_tooltip(APP_NAME, VERSION);

    tauri::Builder::default()
        .setup(move |app| {
            let icon = app
                .default_window_icon()
                .cloned()
                .unwrap_or_else(|| {
                    tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))
                        .expect("failed to load tray icon from embedded bytes")
                });
            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(icon)
                .tooltip(&tooltip)
                .on_tray_icon_event(|tray_icon, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        let app_handle = tray_icon.app_handle();
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            match toggle_window_action(is_visible) {
                                WindowAction::ShowAndFocus => {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                                WindowAction::Hide => {
                                    let _ = window.hide();
                                }
                            }
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![greet, get_status])
        .run(tauri::generate_context!())
        .expect("error while running Norbert");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_semver() {
        let parts: Vec<&str> = VERSION.split('.').collect();
        assert_eq!(parts.len(), 3, "Version should have 3 parts: {}", VERSION);
        for part in &parts {
            part.parse::<u32>()
                .unwrap_or_else(|_| panic!("Version part '{}' is not a number", part));
        }
    }

    #[test]
    fn greet_includes_name_and_version() {
        let result = greet("Developer");
        assert!(result.contains("Developer"), "Greeting should include name");
        assert!(result.contains(VERSION), "Greeting should include version");
    }

    #[test]
    fn get_status_returns_initial_status() {
        let status = get_status();
        let expected = initial_status();
        assert_eq!(status, expected);
    }

    #[test]
    fn get_status_serializes_to_expected_json_keys() {
        let status = get_status();
        let json = serde_json::to_value(&status).expect("should serialize");
        assert!(json.get("version").is_some());
        assert!(json.get("status").is_some());
        assert!(json.get("port").is_some());
        assert!(json.get("session_count").is_some());
        assert!(json.get("event_count").is_some());
    }
}
