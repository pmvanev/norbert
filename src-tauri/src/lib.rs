pub mod adapters;
pub mod domain;
pub mod ports;

use std::collections::HashMap;
use std::sync::Mutex;

use adapters::db::metric_store::SqliteMetricStore;
use adapters::db::SqliteEventStore;
use domain::{
    build_status_with_session, decide_launch_action, next_window_label, parse_launch_intent,
    AccumulatedMetric, AppStatus, LaunchAction, Session, SessionMetadata, DEFAULT_WINDOW_LABEL,
    VERSION,
};
use ports::{EventStore, MetricStore};
use rusqlite::Connection;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

/// Shared application state accessible from IPC command handlers.
///
/// Wraps the SqliteEventStore in a Mutex because rusqlite::Connection
/// is Send but not Sync. The Mutex ensures safe concurrent access
/// from multiple IPC calls.
pub struct AppState {
    pub event_store: Mutex<SqliteEventStore>,
    pub metric_store: Mutex<SqliteMetricStore>,
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
    let session_count = store.get_session_count().unwrap_or(0);
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

/// Combined status + sessions in a single IPC call.
/// Avoids double mutex acquisition and double query per poll tick.
#[tauri::command]
fn get_status_and_sessions(state: tauri::State<AppState>) -> (AppStatus, Vec<Session>) {
    let store = state.event_store.lock().unwrap();
    let sessions = store.get_sessions().unwrap_or_default();
    let event_count = store.get_event_count().unwrap_or(0);
    let latest_session = store.get_latest_session().unwrap_or(None);
    let status = build_status_with_session(sessions.len() as u32, event_count, latest_session.as_ref());
    (status, sessions)
}

/// Return all events for a given session, ordered chronologically.
///
/// Returns an empty array when the session does not exist or has no events.
#[tauri::command]
fn get_session_events(state: tauri::State<AppState>, session_id: String) -> Vec<domain::Event> {
    let store = state.event_store.lock().unwrap();
    store.get_events_for_session(&session_id).unwrap_or_default()
}

/// Return new events for multiple sessions in a single IPC call.
///
/// Takes a map of session_id → number of already-processed events (offset).
/// Returns a map of session_id → new events (events after the offset).
/// Sessions with no new events are omitted from the result.
#[tauri::command]
fn get_new_events_batch(
    state: tauri::State<AppState>,
    offsets: HashMap<String, usize>,
) -> HashMap<String, Vec<domain::Event>> {
    let store = state.event_store.lock().unwrap();
    let mut result = HashMap::new();

    for (session_id, offset) in offsets {
        let all_events = store.get_events_for_session(&session_id).unwrap_or_default();
        if all_events.len() > offset {
            result.insert(session_id, all_events[offset..].to_vec());
        }
    }

    result
}

/// Return accumulated metrics for a given session.
///
/// Returns an empty array when the session does not exist or has no metrics.
#[tauri::command]
fn get_metrics_for_session(
    state: tauri::State<AppState>,
    session_id: String,
) -> Vec<AccumulatedMetric> {
    let store = state.metric_store.lock().unwrap();
    store.get_metrics_for_session(&session_id).unwrap_or_default()
}

/// Return session metadata (enrichment data) for a given session.
///
/// Returns null when no metadata has been recorded for this session.
#[tauri::command]
fn get_session_metadata(
    state: tauri::State<AppState>,
    session_id: String,
) -> Option<SessionMetadata> {
    let store = state.metric_store.lock().unwrap();
    store.get_session_metadata(&session_id).unwrap_or(None)
}

/// Return session metadata for all sessions.
///
/// Returns an empty array when no metadata has been recorded.
#[tauri::command]
fn get_all_session_metadata(state: tauri::State<AppState>) -> Vec<SessionMetadata> {
    let store = state.metric_store.lock().unwrap();
    store.get_all_session_metadata().unwrap_or_default()
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

/// Enriched metadata for an installed plugin, read from its install directory.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PluginDetail {
    name: String,
    version: String,
    description: String,
    homepage: String,
    install_path: String,
    readme: String,
    installed_at: String,
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
    skills: Vec<FileEntry>,
    settings: Option<FileEntry>,
    hooks: Vec<FileEntry>,
    rules: Vec<FileEntry>,
    claude_md_files: Vec<FileEntry>,
    installed_plugins: Option<FileEntry>,
    plugin_details: Vec<PluginDetail>,
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

/// Build enriched plugin details from installed_plugins.json content.
///
/// For each plugin, reads marketplace-manifest.json and README.md from the
/// install path to provide description, homepage, and documentation.
fn build_plugin_details(installed_plugins: &Option<FileEntry>) -> Vec<PluginDetail> {
    let entry = match installed_plugins {
        Some(e) => e,
        None => return Vec::new(),
    };

    let installed: InstalledPluginsFile = match serde_json::from_str(&entry.content) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };

    let mut details = Vec::new();

    for (name, entries) in &installed.plugins {
        for plugin_entry in entries {
            let install_path = std::path::Path::new(&plugin_entry.install_path);
            if !install_path.exists() {
                continue;
            }

            // Read marketplace-manifest.json for description and homepage
            let manifest = install_path.join("marketplace-manifest.json");
            let manifest_data = std::fs::read_to_string(&manifest)
                .ok()
                .and_then(|c| serde_json::from_str::<MarketplaceManifest>(&c).ok())
                .unwrap_or(MarketplaceManifest {
                    description: String::new(),
                    homepage: String::new(),
                });

            // Read README.md if present
            let readme = std::fs::read_to_string(install_path.join("README.md"))
                .unwrap_or_default();

            details.push(PluginDetail {
                name: name.clone(),
                version: plugin_entry.version.clone().unwrap_or_else(|| "unknown".into()),
                description: manifest_data.description,
                homepage: manifest_data.homepage,
                install_path: plugin_entry.install_path.clone(),
                readme,
                installed_at: plugin_entry.installed_at.clone().unwrap_or_default(),
            });
        }
    }

    details
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

    // Build plugin details from installed_plugins.json
    let plugin_details = build_plugin_details(&installed_plugins);

    ClaudeConfig {
        agents,
        commands,
        skills: Vec::new(),
        settings,
        hooks: Vec::new(),
        rules,
        claude_md_files,
        installed_plugins,
        plugin_details,
        errors,
    }
}

/// Installed plugin entry from installed_plugins.json.
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstalledPluginEntry {
    install_path: String,
    version: Option<String>,
    installed_at: Option<String>,
}

/// Marketplace manifest from marketplace-manifest.json inside a plugin directory.
#[derive(Debug, serde::Deserialize)]
struct MarketplaceManifest {
    #[serde(default)]
    description: String,
    #[serde(default)]
    homepage: String,
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
/// Scan a single plugin directory for agents, commands, skills, hooks, rules.
fn scan_plugin_directory(
    install_path: &std::path::Path,
    source: &str,
    all_agents: &mut Vec<FileEntry>,
    all_commands: &mut Vec<FileEntry>,
    all_skills: &mut Vec<FileEntry>,
    all_hooks: &mut Vec<FileEntry>,
    all_rules: &mut Vec<FileEntry>,
    all_errors: &mut Vec<ReadError>,
) {
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
    all_skills.extend(skills);
    all_errors.extend(errs);

    // hooks/hooks.json — read as a FileEntry for frontend parsing
    if let Some(hook_entry) = read_optional_file(
        &install_path.join("hooks").join("hooks.json"),
        "plugin", source, all_errors,
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

/// Reads ~/.claude/plugins/installed_plugins.json AND scans the plugin cache
/// directory for any plugins not in installed_plugins.json.
fn collect_plugin_configs(claude_dir: &std::path::Path) -> ClaudeConfig {
    let mut all_agents = Vec::new();
    let mut all_commands = Vec::new();
    let mut all_skills = Vec::new();
    let mut all_hooks = Vec::new();
    let mut all_rules = Vec::new();
    let mut all_errors = Vec::new();

    // Track which install paths we've already scanned (from installed_plugins.json)
    let mut scanned_paths: std::collections::HashSet<String> = std::collections::HashSet::new();

    // 1. Scan plugins listed in installed_plugins.json
    let plugins_file = claude_dir.join("plugins").join("installed_plugins.json");
    if let Ok(content) = std::fs::read_to_string(&plugins_file) {
        if let Ok(installed) = serde_json::from_str::<InstalledPluginsFile>(&content) {
            for (plugin_name, entries) in &installed.plugins {
                for entry in entries {
                    let install_path = std::path::Path::new(&entry.install_path);
                    if !install_path.exists() {
                        continue;
                    }
                    scanned_paths.insert(install_path.to_string_lossy().to_string());
                    scan_plugin_directory(
                        install_path, plugin_name,
                        &mut all_agents, &mut all_commands, &mut all_skills,
                        &mut all_hooks, &mut all_rules, &mut all_errors,
                    );
                }
            }
        }
    }

    // 2. Scan plugin cache directory for plugins not in installed_plugins.json
    //    Structure: cache/{marketplace}/{plugin-name}/{version}/
    let cache_dir = claude_dir.join("plugins").join("cache");
    if let Ok(marketplaces) = std::fs::read_dir(&cache_dir) {
        for marketplace_entry in marketplaces.flatten() {
            let marketplace_path = marketplace_entry.path();
            if !marketplace_path.is_dir() { continue; }
            let marketplace_name = marketplace_path.file_name()
                .unwrap_or_default().to_string_lossy().to_string();

            if let Ok(plugins) = std::fs::read_dir(&marketplace_path) {
                for plugin_entry in plugins.flatten() {
                    let plugin_path = plugin_entry.path();
                    if !plugin_path.is_dir() { continue; }
                    let plugin_name = plugin_path.file_name()
                        .unwrap_or_default().to_string_lossy().to_string();

                    // Find the most recent version directory (by modification time)
                    let mut best_version: Option<std::path::PathBuf> = None;
                    let mut best_mtime: Option<std::time::SystemTime> = None;

                    if let Ok(versions) = std::fs::read_dir(&plugin_path) {
                        for version_entry in versions.flatten() {
                            let version_path = version_entry.path();
                            if !version_path.is_dir() { continue; }
                            // Must have .claude-plugin/ marker to be a valid plugin
                            if !version_path.join(".claude-plugin").exists() { continue; }

                            let mtime = version_path.metadata()
                                .and_then(|m| m.modified()).ok();
                            if best_mtime.is_none() || mtime > best_mtime {
                                best_mtime = mtime;
                                best_version = Some(version_path);
                            }
                        }
                    }

                    if let Some(version_path) = best_version {
                        let canonical = version_path.to_string_lossy().to_string();
                        // Skip if already scanned via installed_plugins.json
                        // Normalize path separators for comparison
                        let normalized = canonical.replace('\\', "/");
                        let already_scanned = scanned_paths.iter().any(|p| {
                            p.replace('\\', "/") == normalized
                        });
                        if already_scanned { continue; }

                        let source = format!("{}@{}", plugin_name, marketplace_name);
                        scan_plugin_directory(
                            &version_path, &source,
                            &mut all_agents, &mut all_commands, &mut all_skills,
                            &mut all_hooks, &mut all_rules, &mut all_errors,
                        );
                    }
                }
            }
        }
    }

    ClaudeConfig {
        agents: all_agents,
        commands: all_commands,
        skills: all_skills,
        settings: None,
        hooks: all_hooks,
        rules: all_rules,
        claude_md_files: Vec::new(),
        installed_plugins: None,
        plugin_details: Vec::new(),
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
        skills: [a.skills, b.skills].concat(),
        settings,
        hooks: [a.hooks, b.hooks].concat(),
        rules: [a.rules, b.rules].concat(),
        claude_md_files: [a.claude_md_files, b.claude_md_files].concat(),
        installed_plugins,
        plugin_details: [a.plugin_details, b.plugin_details].concat(),
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
        skills: Vec::new(),
        settings: None,
        hooks: Vec::new(),
        rules: Vec::new(),
        claude_md_files: Vec::new(),
        installed_plugins: None,
        plugin_details: Vec::new(),
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
        let mut config = collect_scope_config(&project_claude_dir, "project", "project");
        // Also read CLAUDE.md from the project root (standard Claude Code convention)
        if let Some(entry) = read_optional_file(
            &cwd.join("CLAUDE.md"), "project", "project", &mut config.errors,
        ) {
            config.claude_md_files.push(entry);
        }
        config
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

/// Initialize the SQLite metric store from the platform data directory.
///
/// Opens a separate connection to the same database file. SQLite WAL mode
/// allows concurrent readers/writers across connections.
fn initialize_metric_store() -> Result<SqliteMetricStore, String> {
    let db_path = adapters::db::resolve_database_path()?;
    let connection = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open metric database: {}", e))?;
    SqliteMetricStore::new(connection)
}

// ---------------------------------------------------------------------------
// Multi-window support
// ---------------------------------------------------------------------------

/// Spawn a brand-new Norbert window.
///
/// Generates a unique label from the set of currently-open windows and opens
/// a fresh webview pointing at the frontend entry. The new window gets its
/// own OS-level HWND, so it shows up as an independent entry in the Windows
/// taskbar even though it shares the underlying process and backend state.
fn open_new_window(app: &AppHandle) -> tauri::Result<()> {
    let windows = app.webview_windows();
    let existing: Vec<String> = windows.keys().cloned().collect();
    let existing_refs: Vec<&str> = existing.iter().map(String::as_str).collect();
    let label = next_window_label(&existing_refs);

    WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title("Norbert")
        .inner_size(1024.0, 768.0)
        .build()?;

    Ok(())
}

/// Focus the primary Norbert window, or any remaining window if `main` is gone.
///
/// Falls back to the first available window because users can close the
/// original `main` window while other windows remain open.
fn focus_any_existing_window(app: &AppHandle) {
    let window = app
        .get_webview_window(DEFAULT_WINDOW_LABEL)
        .or_else(|| app.webview_windows().values().next().cloned());
    if let Some(window) = window {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// IPC command: open a new Norbert window (invoked from the frontend).
#[tauri::command]
fn open_window(app: AppHandle) -> Result<(), String> {
    open_new_window(&app).map_err(|e| e.to_string())
}

/// Theme identifiers matching the frontend CSS class suffixes.
const THEME_IDS: [&str; 5] = ["theme_nb", "theme_cd", "theme_vd", "theme_cl", "theme_vl"];

/// Base labels for each theme (no prefix).
const THEME_LABELS: [&str; 5] = ["Norbert", "Claude Dark", "VS Code Dark", "Claude Light", "VS Code Light"];

/// Format a theme label with a bullet prefix for the active theme.
fn theme_label(base: &str, is_active: bool) -> String {
    if is_active {
        format!("\u{2022}  {}", base)
    } else {
        format!("    {}", base)
    }
}

/// Rebuild and reassign the entire app menu with the given theme active.
/// On Windows, individual menu item mutations may not propagate to
/// window-level copies, so we rebuild the full menu instead.
fn rebuild_menu_with_theme(app: &AppHandle, active_id: &str) {
    use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
    let build = || -> tauri::Result<()> {
        let new_window = MenuItemBuilder::with_id("new_window", "New Window")
            .accelerator("CmdOrCtrl+Shift+N")
            .build(app)?;
        let quit = MenuItemBuilder::with_id("quit", "Quit Norbert")
            .accelerator("CmdOrCtrl+Q")
            .build(app)?;
        let file_menu = SubmenuBuilder::new(app, "File")
            .item(&new_window)
            .separator()
            .item(&quit)
            .build()?;

        let mut theme_submenu = SubmenuBuilder::new(app, "Theme");
        for (id, label) in THEME_IDS.iter().zip(THEME_LABELS.iter()) {
            let item = MenuItemBuilder::with_id(*id, theme_label(label, *id == active_id))
                .build(app)?;
            theme_submenu = theme_submenu.item(&item);
        }
        let theme_menu = theme_submenu.build()?;

        let view_menu = SubmenuBuilder::new(app, "View")
            .item(&theme_menu)
            .build()?;

        let menu = MenuBuilder::new(app)
            .item(&file_menu)
            .item(&view_menu)
            .build()?;
        app.set_menu(menu)?;
        Ok(())
    };
    if let Err(e) = build() {
        eprintln!("norbert: failed to rebuild menu: {}", e);
    }
}

/// IPC command: sync native menu theme selection with the frontend's stored theme.
#[tauri::command]
fn sync_theme_menu(app: AppHandle, theme: String) {
    let active_id = format!("theme_{}", theme);
    rebuild_menu_with_theme(&app, &active_id);
}

/// Build and configure the Tauri application.
///
/// This is the composition root: initializes the database
/// and registers IPC commands. The library entry point called by the binary.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize the event store before building the app.
    let event_store = match initialize_event_store() {
        Ok(store) => store,
        Err(e) => {
            eprintln!("norbert: Fatal -- failed to initialize database: {}", e);
            std::process::exit(1);
        }
    };

    // Initialize the metric store (separate connection, same database via WAL).
    let metric_store = match initialize_metric_store() {
        Ok(store) => store,
        Err(e) => {
            eprintln!("norbert: Fatal -- failed to initialize metric store: {}", e);
            std::process::exit(1);
        }
    };

    let app_state = AppState {
        event_store: Mutex::new(event_store),
        metric_store: Mutex::new(metric_store),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // A second norbert.exe was launched. Decide whether to focus the
            // existing window or spawn an additional one based on CLI args.
            let intent = parse_launch_intent(&args);
            let has_existing = !app.webview_windows().is_empty();
            match decide_launch_action(intent, has_existing) {
                LaunchAction::SpawnFirst | LaunchAction::SpawnAdditional => {
                    if let Err(e) = open_new_window(app) {
                        eprintln!("norbert: failed to open new window: {}", e);
                    }
                }
                LaunchAction::FocusExisting => {
                    focus_any_existing_window(app);
                }
            }
        }))
        .manage(app_state)
        .setup(|app| {
            use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};

            let new_window = MenuItemBuilder::with_id("new_window", "New Window")
                .accelerator("CmdOrCtrl+Shift+N")
                .build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit Norbert")
                .accelerator("CmdOrCtrl+Q")
                .build(app)?;
            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&new_window)
                .separator()
                .item(&quit)
                .build()?;

            // View > Theme submenu with bullet-prefixed labels (select-one).
            // The frontend calls sync_theme_menu on startup to match localStorage.
            let mut theme_submenu = SubmenuBuilder::new(app, "Theme");
            for (id, label) in THEME_IDS.iter().zip(THEME_LABELS.iter()) {
                let item = MenuItemBuilder::with_id(*id, theme_label(label, *id == "theme_nb"))
                    .build(app)?;
                theme_submenu = theme_submenu.item(&item);
            }
            let theme_menu = theme_submenu.build()?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&theme_menu)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&file_menu)
                .item(&view_menu)
                .build()?;
            app.set_menu(menu)?;

            app.on_menu_event(|app_handle, event| {
                let id = event.id().as_ref();
                match id {
                    "new_window" => {
                        if let Err(e) = open_new_window(app_handle) {
                            eprintln!("norbert: failed to open new window: {}", e);
                        }
                    }
                    "quit" => {
                        app_handle.exit(0);
                    }
                    _ if id.starts_with("theme_") => {
                        rebuild_menu_with_theme(app_handle, id);
                        let theme_name = id.strip_prefix("theme_").unwrap_or("nb");
                        let _ = app_handle.emit("theme-changed", theme_name);
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, get_status, get_latest_session, get_sessions, get_status_and_sessions, get_session_events, get_new_events_batch, get_metrics_for_session, get_session_metadata, get_all_session_metadata, get_transcript_usage, read_claude_config, open_window, sync_theme_menu])
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
