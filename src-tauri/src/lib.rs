pub mod adapters;
pub mod domain;
pub mod ports;

use std::sync::Mutex;

use adapters::db::SqliteEventStore;
use domain::{
    build_status_with_session, format_tooltip, toggle_window_action, AppStatus,
    Session, WindowAction, APP_NAME, HOOK_PORT, VERSION,
};
use ports::EventStore;
use rusqlite::Connection;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

/// Shared application state accessible from IPC command handlers.
///
/// Wraps the SqliteEventStore in a Mutex because rusqlite::Connection
/// is Send but not Sync. The Mutex ensures safe concurrent access
/// from multiple IPC calls.
pub struct AppState {
    pub event_store: Mutex<SqliteEventStore>,
}

/// Greet command exposed to the frontend via Tauri IPC.
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Norbert v{}.", name, VERSION)
}

/// Return current application status to the frontend via Tauri IPC.
///
/// Reads real session and event counts from the EventStore.
/// Derives status from the latest session state.
/// Falls back to zero counts if the store cannot be read.
#[tauri::command]
fn get_status(state: tauri::State<AppState>) -> AppStatus {
    let store = state.event_store.lock().unwrap();
    let session_count = store.get_sessions().map(|s| s.len() as u32).unwrap_or(0);
    let event_count = store.get_event_count().unwrap_or(0);
    let latest_session = store.get_latest_session().unwrap_or(None);
    build_status_with_session(session_count, event_count, latest_session.as_ref())
}

/// Return the most recently started session, if any.
///
/// Returns None (serialized as null) when no sessions have been recorded.
#[tauri::command]
fn get_latest_session(state: tauri::State<AppState>) -> Option<Session> {
    let store = state.event_store.lock().unwrap();
    store.get_latest_session().unwrap_or(None)
}

/// Initialize the SQLite event store from the platform data directory.
fn initialize_event_store() -> Result<SqliteEventStore, String> {
    let db_path = adapters::db::resolve_database_path()?;
    let connection = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    SqliteEventStore::new(connection)
}

/// Spawn the hook-receiver sidecar process.
///
/// The sidecar runs independently and survives window close events
/// because window close only hides the window (does not exit the app).
fn spawn_hook_receiver_sidecar(app: &tauri::App) {
    match app.shell().sidecar("norbert-hook-receiver") {
        Ok(command) => {
            match command.spawn() {
                Ok((_rx, _child)) => {
                    eprintln!("norbert: Hook receiver sidecar started on port {}", HOOK_PORT);
                }
                Err(e) => {
                    eprintln!("norbert: Failed to spawn hook receiver sidecar: {}", e);
                }
            }
        }
        Err(e) => {
            eprintln!("norbert: Failed to create sidecar command: {}", e);
        }
    }
}

/// Build and configure the Tauri application.
///
/// This is the composition root: initializes the database,
/// spawns the hook-receiver sidecar, and registers IPC commands.
/// The library entry point called by the binary.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let tooltip = format_tooltip(APP_NAME, VERSION);

    // Initialize the event store before building the app.
    let event_store = match initialize_event_store() {
        Ok(store) => store,
        Err(e) => {
            eprintln!("norbert: Fatal -- failed to initialize database: {}", e);
            std::process::exit(1);
        }
    };

    let app_state = AppState {
        event_store: Mutex::new(event_store),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .setup(move |app| {
            // Spawn hook-receiver sidecar.
            spawn_hook_receiver_sidecar(app);

            let icon = app
                .default_window_icon()
                .cloned()
                .expect("default window icon must be set in tauri.conf.json");
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
        .invoke_handler(tauri::generate_handler![greet, get_status, get_latest_session])
        .run(tauri::generate_context!())
        .expect("error while running Norbert");
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::{build_status, initial_status};

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
    fn build_status_with_zero_counts_matches_initial_status() {
        let status = build_status(0, 0);
        let expected = initial_status();
        assert_eq!(status, expected);
    }

    #[test]
    fn app_status_serializes_to_expected_json_keys() {
        let status = build_status(1, 5);
        let json = serde_json::to_value(&status).expect("should serialize");
        assert!(json.get("version").is_some());
        assert!(json.get("status").is_some());
        assert!(json.get("port").is_some());
        assert!(json.get("session_count").is_some());
        assert!(json.get("event_count").is_some());
    }

    #[test]
    fn app_status_reflects_real_counts() {
        let status = build_status(7, 123);
        assert_eq!(status.session_count, 7);
        assert_eq!(status.event_count, 123);
    }
}
