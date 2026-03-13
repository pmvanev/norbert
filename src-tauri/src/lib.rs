pub mod adapters;
pub mod domain;
pub mod ports;

use std::sync::Mutex;

use adapters::db::SqliteEventStore;
use domain::{
    build_status_with_session, format_tooltip, toggle_window_action, AppStatus,
    Session, WindowAction, APP_NAME, VERSION,
};
use ports::EventStore;
use rusqlite::Connection;
use tauri::Manager;

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

/// Return all sessions, most recent first.
#[tauri::command]
fn get_sessions(state: tauri::State<AppState>) -> Vec<Session> {
    let store = state.event_store.lock().unwrap();
    store.get_sessions().unwrap_or_default()
}

/// Return all events for a given session, ordered chronologically.
///
/// Returns an empty array when the session does not exist or has no events.
#[tauri::command]
fn get_session_events(state: tauri::State<AppState>, session_id: String) -> Vec<domain::Event> {
    let store = state.event_store.lock().unwrap();
    store.get_events_for_session(&session_id).unwrap_or_default()
}

/// Initialize the SQLite event store from the platform data directory.
fn initialize_event_store() -> Result<SqliteEventStore, String> {
    let db_path = adapters::db::resolve_database_path()?;
    let connection = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    SqliteEventStore::new(connection)
}

/// Build and configure the Tauri application.
///
/// This is the composition root: initializes the database
/// and registers IPC commands. The library entry point called by the binary.
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
        .manage(app_state)
        .setup(move |app| {
            let icon = app
                .default_window_icon()
                .cloned()
                .expect("default window icon must be set in tauri.conf.json");

            let show_hide = tauri::menu::MenuItemBuilder::with_id("show_hide", "Show / Hide")
                .build(app)?;
            let quit = tauri::menu::MenuItemBuilder::with_id("quit", "Quit Norbert")
                .build(app)?;
            let menu = tauri::menu::MenuBuilder::new(app)
                .item(&show_hide)
                .separator()
                .item(&quit)
                .build()?;

            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(icon)
                .tooltip(&tooltip)
                .menu(&menu)
                .on_menu_event(|app_handle, event| {
                    match event.id().as_ref() {
                        "show_hide" => {
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
                        "quit" => {
                            app_handle.exit(0);
                        }
                        _ => {}
                    }
                })
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
        .invoke_handler(tauri::generate_handler![greet, get_status, get_latest_session, get_sessions, get_session_events])
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
