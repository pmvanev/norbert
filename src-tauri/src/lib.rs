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

/// Aggregated token usage from a Claude Code transcript file.
///
/// Returned by get_transcript_usage to provide token/cost data
/// that Claude Code hooks do not include in their payloads.
#[derive(Debug, Clone, serde::Serialize)]
struct TranscriptUsage {
    input_tokens: u64,
    output_tokens: u64,
    cache_read_tokens: u64,
    cache_creation_tokens: u64,
    model: String,
    message_count: u32,
}

/// Read a Claude Code transcript JSONL file and return aggregated usage.
///
/// Claude Code hook payloads do NOT include token usage data.
/// The usage data lives in the transcript JSONL files referenced by
/// the `transcript_path` field in every hook payload.
///
/// This command reads the JSONL, finds assistant messages with usage,
/// and returns cumulative token counts.
#[tauri::command]
fn get_transcript_usage(transcript_path: String) -> Result<TranscriptUsage, String> {
    use std::io::BufRead;

    let file = std::fs::File::open(&transcript_path)
        .map_err(|e| format!("Failed to open transcript: {}", e))?;
    let reader = std::io::BufReader::new(file);

    let mut total = TranscriptUsage {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        model: String::new(),
        message_count: 0,
    };

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };
        let value: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        // Only process assistant messages
        if value.get("type").and_then(|t| t.as_str()) != Some("assistant") {
            continue;
        }

        let msg = match value.get("message") {
            Some(m) => m,
            None => continue,
        };

        let usage = match msg.get("usage") {
            Some(u) => u,
            None => continue,
        };

        let input = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
        let output = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);

        if input == 0 && output == 0 {
            continue;
        }

        total.input_tokens += input;
        total.output_tokens += output;
        total.cache_read_tokens += usage.get("cache_read_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
        total.cache_creation_tokens += usage.get("cache_creation_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
        total.message_count += 1;

        // Track the model from the message (use last seen)
        if let Some(model) = msg.get("model").and_then(|m| m.as_str()) {
            if model != "<synthetic>" {
                total.model = model.to_string();
            }
        }
    }

    Ok(total)
}

/// A single file's path and content, tagged with its scope origin.
/// The `source` field identifies where the file came from: "user", "project",
/// or a plugin name like "nw@nwave-marketplace".
#[derive(Debug, Clone, serde::Serialize)]
struct FileEntry {
    path: String,
    content: String,
    scope: String,
    source: String,
}

/// A file that could not be read, with the error message and scope origin.
#[derive(Debug, Clone, serde::Serialize)]
struct ReadError {
    path: String,
    error: String,
    scope: String,
    source: String,
}

/// Claude configuration files collected from user and/or project scope.
///
/// Returned by read_claude_config to provide the frontend with agents,
/// commands, settings, hooks, rules, and CLAUDE.md files.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ClaudeConfig {
    agents: Vec<FileEntry>,
    commands: Vec<FileEntry>,
    settings: Option<FileEntry>,
    hooks: Vec<FileEntry>,
    rules: Vec<FileEntry>,
    claude_md_files: Vec<FileEntry>,
    installed_plugins: Option<FileEntry>,
    errors: Vec<ReadError>,
}

/// Read markdown files from a subdirectory, returning entries and errors.
///
/// Missing directory produces empty results (not an error).
/// Individual file read failures are captured in the errors vector.
fn read_md_files_from_directory(
    directory: &std::path::Path,
    scope: &str,
    source: &str,
) -> (Vec<FileEntry>, Vec<ReadError>) {
    let mut entries = Vec::new();
    let mut errors = Vec::new();

    let read_dir = match std::fs::read_dir(directory) {
        Ok(rd) => rd,
        Err(_) => return (entries, errors), // Missing directory = empty, not error
    };

    for dir_entry in read_dir {
        let dir_entry = match dir_entry {
            Ok(de) => de,
            Err(e) => {
                errors.push(ReadError {
                    path: directory.display().to_string(),
                    error: format!("Failed to read directory entry: {}", e),
                    scope: scope.to_string(),
                    source: source.to_string(),
                });
                continue;
            }
        };

        let path = dir_entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }

        let path_str = path.display().to_string();
        match std::fs::read_to_string(&path) {
            Ok(content) => {
                entries.push(FileEntry {
                    path: path_str,
                    content,
                    scope: scope.to_string(),
                    source: source.to_string(),
                });
            }
            Err(e) => {
                errors.push(ReadError {
                    path: path_str,
                    error: format!("Failed to read file: {}", e),
                    scope: scope.to_string(),
                    source: source.to_string(),
                });
            }
        }
    }

    (entries, errors)
}

/// Read a single optional file, returning it as an entry or recording the error.
///
/// Returns None when the file does not exist (not an error).
/// Returns Some(FileEntry) on success, or pushes to errors on read failure.
fn read_optional_file(
    file_path: &std::path::Path,
    scope: &str,
    source: &str,
    errors: &mut Vec<ReadError>,
) -> Option<FileEntry> {
    if !file_path.exists() {
        return None;
    }

    let path_str = file_path.display().to_string();
    match std::fs::read_to_string(file_path) {
        Ok(content) => Some(FileEntry {
            path: path_str,
            content,
            scope: scope.to_string(),
            source: source.to_string(),
        }),
        Err(e) => {
            errors.push(ReadError {
                path: path_str,
                error: format!("Failed to read file: {}", e),
                scope: scope.to_string(),
                source: source.to_string(),
            });
            None
        }
    }
}

/// Collect Claude configuration files from a single scope directory.
///
/// Reads agents/*.md, commands/*.md, rules/*.md, settings.json, and CLAUDE.md
/// from the given base directory. Also reads installed_plugins.json if present.
fn collect_scope_config(
    base_dir: &std::path::Path,
    scope: &str,
    source: &str,
) -> ClaudeConfig {
    let mut errors = Vec::new();

    let (agents, agent_errors) = read_md_files_from_directory(&base_dir.join("agents"), scope, source);
    errors.extend(agent_errors);

    let (commands, command_errors) = read_md_files_from_directory(&base_dir.join("commands"), scope, source);
    errors.extend(command_errors);

    let (rules, rule_errors) = read_md_files_from_directory(&base_dir.join("rules"), scope, source);
    errors.extend(rule_errors);

    let settings = read_optional_file(&base_dir.join("settings.json"), scope, source, &mut errors);

    let mut claude_md_files = Vec::new();
    if let Some(entry) = read_optional_file(&base_dir.join("CLAUDE.md"), scope, source, &mut errors) {
        claude_md_files.push(entry);
    }

    let installed_plugins = read_optional_file(
        &base_dir.join("plugins").join("installed_plugins.json"),
        scope, source, &mut errors,
    );

    ClaudeConfig {
        agents,
        commands,
        settings,
        hooks: Vec::new(),
        rules,
        claude_md_files,
        installed_plugins,
        errors,
    }
}

/// Installed plugin entry from installed_plugins.json.
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstalledPluginEntry {
    install_path: String,
    #[allow(dead_code)]
    version: Option<String>,
}

/// Top-level structure of installed_plugins.json.
#[derive(Debug, serde::Deserialize)]
struct InstalledPluginsFile {
    plugins: std::collections::HashMap<String, Vec<InstalledPluginEntry>>,
}

/// Read markdown files recursively from a directory and its subdirectories.
///
/// Unlike read_md_files_from_directory, this descends into subdirectories
/// to find .md files at any depth (e.g., skills/claude-md/skill.md).
fn read_md_files_recursive(
    directory: &std::path::Path,
    scope: &str,
    source: &str,
) -> (Vec<FileEntry>, Vec<ReadError>) {
    let mut entries = Vec::new();
    let mut errors = Vec::new();
    let mut stack = vec![directory.to_path_buf()];

    while let Some(dir) = stack.pop() {
        let read_dir = match std::fs::read_dir(&dir) {
            Ok(rd) => rd,
            Err(_) => continue,
        };

        for dir_entry in read_dir {
            let dir_entry = match dir_entry {
                Ok(de) => de,
                Err(e) => {
                    errors.push(ReadError {
                        path: dir.display().to_string(),
                        error: format!("Failed to read directory entry: {}", e),
                        scope: scope.to_string(),
                        source: source.to_string(),
                    });
                    continue;
                }
            };

            let path = dir_entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }

            if path.extension().and_then(|e| e.to_str()) != Some("md") {
                continue;
            }

            let path_str = path.display().to_string();
            match std::fs::read_to_string(&path) {
                Ok(content) => {
                    entries.push(FileEntry {
                        path: path_str,
                        content,
                        scope: scope.to_string(),
                        source: source.to_string(),
                    });
                }
                Err(e) => {
                    errors.push(ReadError {
                        path: path_str,
                        error: format!("Failed to read file: {}", e),
                        scope: scope.to_string(),
                        source: source.to_string(),
                    });
                }
            }
        }
    }

    (entries, errors)
}

/// Scan installed plugins for agents, commands, skills, hooks, and rules.
///
/// Reads ~/.claude/plugins/installed_plugins.json, then for each plugin
/// scans its install path. Each entry is tagged with source = plugin name.
fn collect_plugin_configs(claude_dir: &std::path::Path) -> ClaudeConfig {
    let empty = ClaudeConfig {
        agents: Vec::new(),
        commands: Vec::new(),
        settings: None,
        hooks: Vec::new(),
        rules: Vec::new(),
        claude_md_files: Vec::new(),
        installed_plugins: None,
        errors: Vec::new(),
    };

    let plugins_file = claude_dir.join("plugins").join("installed_plugins.json");
    let content = match std::fs::read_to_string(&plugins_file) {
        Ok(c) => c,
        Err(_) => return empty,
    };

    let installed: InstalledPluginsFile = match serde_json::from_str(&content) {
        Ok(i) => i,
        Err(_) => return empty,
    };

    let mut all_agents = Vec::new();
    let mut all_commands = Vec::new();
    let mut all_hooks = Vec::new();
    let mut all_rules = Vec::new();
    let mut all_errors = Vec::new();

    for (plugin_name, entries) in &installed.plugins {
        for entry in entries {
            let install_path = std::path::Path::new(&entry.install_path);
            if !install_path.exists() {
                continue;
            }

            let source = plugin_name.as_str();

            // agents/*.md
            let (agents, errs) = read_md_files_from_directory(
                &install_path.join("agents"), "plugin", source,
            );
            all_agents.extend(agents);
            all_errors.extend(errs);

            // commands/*.md
            let (commands, errs) = read_md_files_from_directory(
                &install_path.join("commands"), "plugin", source,
            );
            all_commands.extend(commands);
            all_errors.extend(errs);

            // skills/ (recursive — skills can have subdirectories)
            let (skills, errs) = read_md_files_recursive(
                &install_path.join("skills"), "plugin", source,
            );
            all_commands.extend(skills);
            all_errors.extend(errs);

            // hooks/hooks.json — read as a FileEntry for frontend parsing
            if let Some(hook_entry) = read_optional_file(
                &install_path.join("hooks").join("hooks.json"),
                "plugin", source, &mut all_errors,
            ) {
                all_hooks.push(hook_entry);
            }

            // rules/*.md
            let (rules, errs) = read_md_files_from_directory(
                &install_path.join("rules"), "plugin", source,
            );
            all_rules.extend(rules);
            all_errors.extend(errs);
        }
    }

    ClaudeConfig {
        agents: all_agents,
        commands: all_commands,
        settings: None,
        hooks: all_hooks,
        rules: all_rules,
        claude_md_files: Vec::new(),
        installed_plugins: None,
        errors: all_errors,
    }
}

/// Merge two ClaudeConfig structs by concatenating their vectors.
fn merge_configs(a: ClaudeConfig, b: ClaudeConfig) -> ClaudeConfig {
    let settings = a.settings.or(b.settings);
    let installed_plugins = a.installed_plugins.or(b.installed_plugins);
    ClaudeConfig {
        agents: [a.agents, b.agents].concat(),
        commands: [a.commands, b.commands].concat(),
        settings,
        hooks: [a.hooks, b.hooks].concat(),
        rules: [a.rules, b.rules].concat(),
        claude_md_files: [a.claude_md_files, b.claude_md_files].concat(),
        installed_plugins,
        errors: [a.errors, b.errors].concat(),
    }
}

/// Read Claude Code configuration files from user and/or project scope.
///
/// Scope "user" reads from ~/.claude/ (agents, commands, settings, CLAUDE.md).
/// Scope "project" reads from ./.claude/ relative to CWD, plus CLAUDE.md at CWD root.
/// Scope "both" merges results from both scopes.
///
/// Missing directories produce empty lists. Per-file read failures are
/// captured in the errors array without blocking other file reads.
#[tauri::command]
fn read_claude_config(scope: String) -> Result<ClaudeConfig, String> {
    let empty_config = ClaudeConfig {
        agents: Vec::new(),
        commands: Vec::new(),
        settings: None,
        hooks: Vec::new(),
        rules: Vec::new(),
        claude_md_files: Vec::new(),
        installed_plugins: None,
        errors: Vec::new(),
    };

    let user_config = if scope == "user" || scope == "both" {
        let home = dirs::home_dir()
            .ok_or_else(|| "Cannot determine home directory".to_string())?;
        let user_claude_dir = home.join(".claude");
        let base = collect_scope_config(&user_claude_dir, "user", "user");
        let plugins = collect_plugin_configs(&user_claude_dir);
        merge_configs(base, plugins)
    } else {
        empty_config.clone()
    };

    let project_config = if scope == "project" || scope == "both" {
        let cwd = std::env::current_dir()
            .map_err(|e| format!("Cannot determine current directory: {}", e))?;
        let project_claude_dir = cwd.join(".claude");
        collect_scope_config(&project_claude_dir, "project", "project")
    } else {
        empty_config
    };

    match scope.as_str() {
        "user" => Ok(user_config),
        "project" => Ok(project_config),
        "both" => Ok(merge_configs(user_config, project_config)),
        _ => Err(format!("Invalid scope '{}': must be 'user', 'project', or 'both'", scope)),
    }
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
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Second instance launched — focus the existing window instead.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
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
        .invoke_handler(tauri::generate_handler![greet, get_status, get_latest_session, get_sessions, get_session_events, get_transcript_usage, read_claude_config])
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
