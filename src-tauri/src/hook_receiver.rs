/// Hook receiver sidecar binary.
///
/// HTTP server on 127.0.0.1:3748 accepting POST /hooks/:event_type.
/// Delegates normalization to an EventProvider, persists canonical events
/// via EventStore, returns 200 after write.
/// This is a separate binary target sharing the same crate as the Tauri app.

use std::net::SocketAddr;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use tokio_util::sync::CancellationToken;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use norbert_lib::adapters::db::metric_store::SqliteMetricStore;
use norbert_lib::adapters::db::SqliteEventStore;
use norbert_lib::adapters::otel::metrics_parser::parse_export_metrics_request;
use norbert_lib::adapters::otel::{
    extract_log_resource_attributes, extract_metrics_resource_attributes,
    extract_terminal_type_from_logs_request, parse_export_logs_request,
};
use norbert_lib::adapters::providers::claude_code::ClaudeCodeProvider;
use norbert_lib::domain::{SessionMetadata, HOOK_PORT};
use norbert_lib::ports::{EventProvider, EventStore, MetricStore};
use rusqlite::Connection;

// ---------------------------------------------------------------------------
// Pure tray formatting functions (no IO, no side effects)
// ---------------------------------------------------------------------------

/// Format the port display label.
///
/// Returns "Port: unavailable" when port is 0 (bind-failure sentinel),
/// otherwise "Port: {port}".
fn format_port_label(port: u32) -> String {
    if port == 0 {
        "Port: unavailable".to_string()
    } else {
        format!("Port: {}", port)
    }
}

/// Format the event count display label.
fn format_event_count_label(event_count: u64) -> String {
    format!("Events: {}", event_count)
}

/// Return the tray menu title label.
fn menu_title_label() -> &'static str {
    "Norbert Hook Receiver"
}

/// Build the tray icon tooltip string from current port and event count.
///
/// The tooltip contains three lines:
/// 1. "Norbert Hook Receiver"
/// 2. Port label (or "unavailable" if port=0)
/// 3. Event count
fn format_tray_tooltip(port: u32, event_count: u64) -> String {
    format!(
        "{}\n{}\n{}",
        menu_title_label(),
        format_port_label(port),
        format_event_count_label(event_count),
    )
}

// ---------------------------------------------------------------------------
// Tray icon lifecycle (Windows only, dedicated OS thread)
// ---------------------------------------------------------------------------

/// Graceful shutdown drain timeout in seconds.
const DRAIN_TIMEOUT_SECS: u64 = 2;

/// Spawn the tray icon on a dedicated OS thread.
///
/// The thread creates a TrayIcon with tooltip and context menu, then runs
/// a tick loop (16ms sleep) to process Win32 messages. State is read
/// on-demand from `Arc<AppState>` when tooltip or menu events fire.
/// Clicking "Quit" cancels the `CancellationToken`.
///
/// This function is a no-op on non-Windows platforms.
#[cfg(target_os = "windows")]
fn spawn_tray_thread(state: Arc<AppState>, cancel_token: CancellationToken) {
    use muda::{Menu, MenuItem, PredefinedMenuItem, MenuEvent};
    use tray_icon::{TrayIconBuilder, Icon as TrayIconIcon};

    std::thread::spawn(move || {
        // Decode the embedded PNG into RGBA pixels for the tray icon
        let icon_bytes = include_bytes!("../icons/icon.png");
        let decoder = png::Decoder::new(std::io::Cursor::new(icon_bytes));
        let mut reader = decoder.read_info().expect("Failed to read PNG info");
        let mut buf = vec![0u8; reader.output_buffer_size()];
        let info = reader.next_frame(&mut buf).expect("Failed to decode PNG frame");
        buf.truncate(info.buffer_size());
        let icon = TrayIconIcon::from_rgba(buf, info.width, info.height)
            .expect("Failed to create tray icon from RGBA data");

        // Build initial tooltip from current state
        let initial_port = state.bound_port.load(Ordering::Relaxed);
        let initial_count = state.event_counter.load(Ordering::Relaxed);
        let initial_tooltip = format_tray_tooltip(initial_port, initial_count);

        // Build context menu
        let menu = Menu::new();
        let title_item = MenuItem::new(menu_title_label(), false, None);
        let port_item = MenuItem::new(format_port_label(initial_port), false, None);
        let event_count_item = MenuItem::new(
            format_event_count_label(initial_count),
            false,
            None,
        );
        let quit_item = MenuItem::new("Quit", true, None);
        let quit_item_id = quit_item.id().clone();

        menu.append(&title_item).expect("Failed to add title menu item");
        menu.append(&PredefinedMenuItem::separator()).expect("Failed to add separator");
        menu.append(&port_item).expect("Failed to add port menu item");
        menu.append(&event_count_item).expect("Failed to add event count menu item");
        menu.append(&PredefinedMenuItem::separator()).expect("Failed to add separator");
        menu.append(&quit_item).expect("Failed to add quit menu item");

        let tray_icon = TrayIconBuilder::new()
            .with_tooltip(&initial_tooltip)
            .with_menu(Box::new(menu))
            .with_icon(icon)
            .build()
            .expect("Failed to build tray icon");

        let menu_receiver = MenuEvent::receiver();
        let cancel = cancel_token.clone();

        // Track last-seen values to avoid redundant updates
        let mut last_port = initial_port;
        let mut last_count = initial_count;

        // Tick loop: refresh tooltip/menu on state change, process quit, sleep 16ms
        loop {
            // Refresh tooltip and menu items when state changes (on-demand read)
            let current_port = state.bound_port.load(Ordering::Relaxed);
            let current_count = state.event_counter.load(Ordering::Relaxed);
            if current_port != last_port || current_count != last_count {
                let tooltip = format_tray_tooltip(current_port, current_count);
                let _ = tray_icon.set_tooltip(Some(&tooltip));
                let _ = port_item.set_text(&format_port_label(current_port));
                let _ = event_count_item.set_text(&format_event_count_label(current_count));
                last_port = current_port;
                last_count = current_count;
            }

            if let Ok(event) = menu_receiver.try_recv() {
                if event.id() == &quit_item_id {
                    cancel.cancel();
                    break;
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(16));
        }
    });
}

#[cfg(not(target_os = "windows"))]
fn spawn_tray_thread(_state: Arc<AppState>, _cancel_token: CancellationToken) {
    // No-op on non-Windows platforms
}

/// Shared application state holding the event store and provider.
///
/// Wraps SqliteEventStore in a Mutex because rusqlite::Connection
/// is Send but not Sync. The Mutex ensures safe concurrent access
/// from multiple HTTP request handlers.
///
/// The provider handles normalization of raw hook events into
/// canonical event types before storage.
struct AppState {
    event_store: Mutex<SqliteEventStore>,
    metric_store: Mutex<SqliteMetricStore>,
    provider: Box<dyn EventProvider + Send + Sync>,
    event_counter: AtomicU64,
    bound_port: AtomicU32,
}

/// Collect unique session IDs from an iterator, preserving first-seen order.
fn collect_unique_session_ids<'a>(session_ids: impl Iterator<Item = &'a String>) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut unique = Vec::new();
    for id in session_ids {
        if seen.insert(id.clone()) {
            unique.push(id.clone());
        }
    }
    unique
}

/// Handle POST /hooks/:event_type.
///
/// Extracts session_id from payload, delegates normalization to the
/// EventProvider, persists the canonical event via EventStore, and
/// returns 200 on success. Returns 400 for unknown event types or
/// missing session_id.
async fn handle_hook_event(
    State(state): State<Arc<AppState>>,
    Path(event_type_name): Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    let session_id = match payload.get("session_id").and_then(|v| v.as_str()) {
        Some(id) => id.to_string(),
        None => {
            eprintln!("Warning: missing session_id in payload for event type {}", event_type_name);
            return (
                StatusCode::BAD_REQUEST,
                "missing session_id in payload".to_string(),
            );
        }
    };

    let received_at = chrono::Utc::now().to_rfc3339();

    let canonical_event = match state.provider.normalize(
        &event_type_name,
        session_id,
        payload,
        received_at,
    ) {
        Some(event) => event,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                format!("Unknown event type: {}", event_type_name),
            );
        }
    };

    let store = state.event_store.lock().unwrap();
    match store.write_event(&canonical_event) {
        Ok(()) => {
            state.event_counter.fetch_add(1, Ordering::Relaxed);
            (StatusCode::OK, "OK".to_string())
        }
        Err(e) => {
            eprintln!("Failed to persist event: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to persist event: {}", e),
            )
        }
    }
}

/// Handle POST /v1/logs (OTLP HTTP log export).
///
/// Accepts an ExportLogsServiceRequest JSON body, delegates parsing to
/// the pure OTLP parser, persists each recognized event via EventStore,
/// and returns 200 OK with {} per OTLP spec. Returns 400 for malformed JSON.
async fn handle_otlp_logs(
    State(state): State<Arc<AppState>>,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    let json_body: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, "malformed JSON".to_string());
        }
    };

    let received_at = chrono::Utc::now().to_rfc3339();
    let events = parse_export_logs_request(&json_body, &received_at);

    // Step 1: Lock event_store, write events, collect session_ids, then drop lock.
    let session_ids: Vec<String> = {
        let store = state.event_store.lock().unwrap();
        for event in &events {
            match store.write_event(event) {
                Ok(()) => {
                    state.event_counter.fetch_add(1, Ordering::Relaxed);
                }
                Err(e) => {
                    eprintln!("Failed to persist OTLP event: {}", e);
                }
            }
        }
        collect_unique_session_ids(events.iter().map(|e| &e.session_id))
    };

    // Step 2: Lock metric_store (event_store lock already dropped) to write metadata.
    if !events.is_empty() {
        let terminal_type = extract_terminal_type_from_logs_request(&json_body);
        let (service_version, os_type, host_arch) = extract_log_resource_attributes(&json_body);
        let metric_store = state.metric_store.lock().unwrap();
        for session_id in session_ids {
            let metadata = SessionMetadata {
                session_id,
                terminal_type: terminal_type.clone(),
                service_version: service_version.clone(),
                os_type: os_type.clone(),
                host_arch: host_arch.clone(),
            };
            if let Err(e) = metric_store.write_session_metadata(&metadata) {
                eprintln!("Failed to write session metadata from logs: {}", e);
            }
        }
    }

    (StatusCode::OK, "{}".to_string())
}

/// Handle POST /v1/metrics (OTLP HTTP metric export).
///
/// Accepts an ExportMetricsServiceRequest JSON body, delegates parsing to
/// the pure OTLP metrics parser, accumulates each data point via MetricStore,
/// extracts resource attributes for session metadata enrichment,
/// and returns 200 OK with {} per OTLP spec. Returns 400 for malformed JSON.
async fn handle_otlp_metrics(
    State(state): State<Arc<AppState>>,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    let json_body: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, "malformed JSON".to_string());
        }
    };

    let data_points = parse_export_metrics_request(&json_body);
    let (service_version, os_type, host_arch) = extract_metrics_resource_attributes(&json_body);

    let store = state.metric_store.lock().unwrap();

    for point in &data_points {
        match store.accumulate_delta(
            &point.session_id,
            &point.metric_name,
            &point.attribute_key,
            point.value,
            &point.end_time_nano,
        ) {
            Ok(()) => {
                state.event_counter.fetch_add(1, Ordering::Relaxed);
            }
            Err(e) => {
                eprintln!("Failed to accumulate metric: {}", e);
            }
        }
    }

    // Write session metadata once per unique session in this request
    let session_ids = collect_unique_session_ids(data_points.iter().map(|p| &p.session_id));
    for session_id in session_ids {
        let metadata = SessionMetadata {
            session_id,
            terminal_type: None,
            service_version: service_version.clone(),
            os_type: os_type.clone(),
            host_arch: host_arch.clone(),
        };
        if let Err(e) = store.write_session_metadata(&metadata) {
            eprintln!("Failed to write session metadata: {}", e);
        }
    }

    (StatusCode::OK, "{}".to_string())
}

/// Build the axum router with hook routes and OTLP log receiver.
fn build_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/hooks/:event_type", post(handle_hook_event))
        .route("/v1/logs", post(handle_otlp_logs))
        .route("/v1/metrics", post(handle_otlp_metrics))
        .with_state(state)
}

#[tokio::main]
async fn main() {
    let db_path = match norbert_lib::adapters::db::resolve_database_path() {
        Ok(path) => path,
        Err(e) => {
            eprintln!("norbert-hook-receiver: {}", e);
            std::process::exit(1);
        }
    };

    let connection = match Connection::open(&db_path) {
        Ok(conn) => conn,
        Err(e) => {
            eprintln!("norbert-hook-receiver: Failed to open database: {}", e);
            std::process::exit(1);
        }
    };

    let event_store = match SqliteEventStore::new(connection) {
        Ok(store) => store,
        Err(e) => {
            eprintln!("norbert-hook-receiver: Failed to initialize database: {}", e);
            std::process::exit(1);
        }
    };

    // Open a separate connection for the metric store (SQLite WAL allows concurrent readers/writers)
    let metric_connection = match Connection::open(&db_path) {
        Ok(conn) => conn,
        Err(e) => {
            eprintln!("norbert-hook-receiver: Failed to open metric database: {}", e);
            std::process::exit(1);
        }
    };

    let metric_store = match SqliteMetricStore::new(metric_connection) {
        Ok(store) => store,
        Err(e) => {
            eprintln!("norbert-hook-receiver: Failed to initialize metric store: {}", e);
            std::process::exit(1);
        }
    };

    let state = Arc::new(AppState {
        event_store: Mutex::new(event_store),
        metric_store: Mutex::new(metric_store),
        provider: Box::new(ClaudeCodeProvider),
        event_counter: AtomicU64::new(0),
        bound_port: AtomicU32::new(0),
    });

    // Create cancellation token for coordinated shutdown
    let cancel_token = CancellationToken::new();

    // Spawn tray icon on dedicated OS thread (Windows only, no-op elsewhere)
    spawn_tray_thread(state.clone(), cancel_token.clone());

    let app = build_router(state.clone());

    let addr = SocketAddr::from(([127, 0, 0, 1], HOOK_PORT));
    eprintln!("norbert-hook-receiver: listening on {}", addr);

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => {
            let actual_port = l.local_addr().map(|a| a.port() as u32).unwrap_or(0);
            state.bound_port.store(actual_port, Ordering::Relaxed);
            l
        }
        Err(e) => {
            state.bound_port.store(0, Ordering::Relaxed);
            eprintln!(
                "norbert-hook-receiver: Port {} unavailable: {}",
                HOOK_PORT, e
            );
            std::process::exit(1);
        }
    };

    // Run server until cancellation (tray Quit) or server error
    let server = axum::serve(listener, app)
        .with_graceful_shutdown(cancel_token.cancelled_owned());

    if let Err(e) = server.await {
        eprintln!("norbert-hook-receiver: Server error: {}", e);
        std::process::exit(1);
    }

    // Allow in-flight requests to drain
    tokio::time::sleep(std::time::Duration::from_secs(DRAIN_TIMEOUT_SECS)).await;
    eprintln!("norbert-hook-receiver: shutting down gracefully");
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::Request,
    };
    use tower::ServiceExt;

    /// Create a test app state with in-memory SQLite databases
    /// and the ClaudeCodeProvider for normalization.
    fn test_state() -> Arc<AppState> {
        let conn =
            Connection::open_in_memory().expect("Failed to open in-memory database");
        let event_store =
            SqliteEventStore::new(conn).expect("Failed to initialize schema");
        let metric_conn =
            Connection::open_in_memory().expect("Failed to open in-memory metric database");
        let metric_store =
            SqliteMetricStore::new(metric_conn).expect("Failed to initialize metric schema");
        Arc::new(AppState {
            event_store: Mutex::new(event_store),
            metric_store: Mutex::new(metric_store),
            provider: Box::new(ClaudeCodeProvider),
            event_counter: AtomicU64::new(0),
            bound_port: AtomicU32::new(0),
        })
    }

    #[tokio::test]
    async fn valid_event_type_returns_200() {
        let state = test_state();
        let app = build_router(state);

        let body = serde_json::json!({
            "session_id": "sess-test-1",
            "tool": "bash"
        });

        let request = Request::builder()
            .method("POST")
            .uri("/hooks/PreToolUse")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn unknown_event_type_returns_400() {
        let state = test_state();
        let app = build_router(state);

        let body = serde_json::json!({"session_id": "sess-1"});

        let request = Request::builder()
            .method("POST")
            .uri("/hooks/UnknownEvent")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn event_persisted_before_acknowledgment() {
        let state = test_state();
        let app = build_router(state.clone());

        let body = serde_json::json!({
            "session_id": "sess-persist-test",
            "tool": "Read"
        });

        let request = Request::builder()
            .method("POST")
            .uri("/hooks/PostToolUse")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // Verify event was persisted
        let count = state.event_store.lock().unwrap().get_event_count().unwrap();
        assert_eq!(count, 1, "Event should be persisted before acknowledgment");
    }

    #[tokio::test]
    async fn unknown_event_type_does_not_persist() {
        let state = test_state();
        let app = build_router(state.clone());

        let body = serde_json::json!({"session_id": "sess-1"});

        let request = Request::builder()
            .method("POST")
            .uri("/hooks/InvalidType")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let _response = app.oneshot(request).await.unwrap();

        let count = state.event_store.lock().unwrap().get_event_count().unwrap();
        assert_eq!(count, 0, "No events should be stored for invalid types");
    }

    #[tokio::test]
    async fn missing_session_id_returns_400() {
        let state = test_state();
        let app = build_router(state.clone());

        let body = serde_json::json!({"tool": "bash"});

        let request = Request::builder()
            .method("POST")
            .uri("/hooks/PreToolUse")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let count = state.event_store.lock().unwrap().get_event_count().unwrap();
        assert_eq!(count, 0, "No events should be stored when session_id is missing");
    }

    #[tokio::test]
    async fn all_valid_event_types_accepted() {
        for event_type in &norbert_lib::adapters::providers::claude_code::HOOK_EVENT_NAMES {
            let state = test_state();
            let app = build_router(state);

            let body = serde_json::json!({"session_id": "sess-1"});

            let request = Request::builder()
                .method("POST")
                .uri(format!("/hooks/{}", event_type))
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&body).unwrap()))
                .unwrap();

            let response = app.oneshot(request).await.unwrap();
            assert_eq!(
                response.status(),
                StatusCode::OK,
                "Event type {} should be accepted",
                event_type
            );
        }
    }

    #[tokio::test]
    async fn provider_normalizes_event_before_storage() {
        // Integration test: hook receiver delegates to EventProvider,
        // which normalizes PascalCase -> canonical EventType before storage.
        let state = test_state();
        let app = build_router(state.clone());

        let body = serde_json::json!({
            "session_id": "sess-provider-test",
            "tool": "bash"
        });

        // Send PascalCase event type (Claude Code format)
        let request = Request::builder()
            .method("POST")
            .uri("/hooks/PreToolUse")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // Verify event was stored with canonical event type, not raw PascalCase
        let stored_type: String = {
            let store = state.event_store.lock().unwrap();
            store.get_stored_event_type("sess-provider-test")
                .expect("should find stored event")
        };
        assert_eq!(
            stored_type, "tool_call_start",
            "SQLite should store canonical event type (tool_call_start), not raw name (PreToolUse)"
        );
    }

    #[tokio::test]
    async fn event_attributed_to_correct_session() {
        let state = test_state();
        let app = build_router(state.clone());

        let body = serde_json::json!({
            "session_id": "sess-attribution-test"
        });

        let request = Request::builder()
            .method("POST")
            .uri("/hooks/SessionStart")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let sessions = state.event_store.lock().unwrap().get_sessions().unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, "sess-attribution-test");
    }

    // --- OTLP /v1/logs handler tests ---

    /// Build a minimal valid OTLP ExportLogsServiceRequest with one api_request log record.
    fn otlp_api_request_body(session_id: &str) -> serde_json::Value {
        serde_json::json!({
            "resourceLogs": [{
                "resource": {
                    "attributes": [
                        {"key": "service.name", "value": {"stringValue": "claude-code"}}
                    ]
                },
                "scopeLogs": [{
                    "scope": {"name": "com.anthropic.claude_code.events"},
                    "logRecords": [{
                        "timeUnixNano": "1774290633104000000",
                        "observedTimeUnixNano": "1774290633104000000",
                        "body": {"stringValue": "claude_code.api_request"},
                        "attributes": [
                            {"key": "session.id", "value": {"stringValue": session_id}},
                            {"key": "event.name", "value": {"stringValue": "api_request"}},
                            {"key": "event.timestamp", "value": {"stringValue": "2026-03-23T18:30:33Z"}},
                            {"key": "event.sequence", "value": {"intValue": "1"}},
                            {"key": "prompt.id", "value": {"stringValue": "prompt-1"}},
                            {"key": "model", "value": {"stringValue": "claude-opus-4-6"}},
                            {"key": "input_tokens", "value": {"stringValue": "337"}},
                            {"key": "output_tokens", "value": {"stringValue": "12"}},
                            {"key": "cache_read_tokens", "value": {"stringValue": "100"}},
                            {"key": "cache_creation_tokens", "value": {"stringValue": "200"}}
                        ],
                        "droppedAttributesCount": 0
                    }]
                }]
            }]
        })
    }

    #[tokio::test]
    async fn otlp_valid_api_request_returns_200_and_persists_event() {
        let state = test_state();
        let app = build_router(state.clone());

        let body = otlp_api_request_body("sess-otlp-1");

        let request = Request::builder()
            .method("POST")
            .uri("/v1/logs")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // Verify response body is {}
        let response_body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        assert_eq!(
            std::str::from_utf8(&response_body).unwrap(),
            "{}",
            "OTLP success response must be {{}}"
        );

        // Verify event persisted with correct type and provider
        let count = state.event_store.lock().unwrap().get_event_count().unwrap();
        assert_eq!(count, 1, "One event should be persisted from OTLP request");

        let stored_type: String = {
            let store = state.event_store.lock().unwrap();
            store
                .get_stored_event_type("sess-otlp-1")
                .expect("should find stored event")
        };
        assert_eq!(
            stored_type, "api_request",
            "Event should be stored with canonical type api_request"
        );
    }

    #[tokio::test]
    async fn otlp_malformed_json_returns_400() {
        let state = test_state();
        let app = build_router(state);

        let request = Request::builder()
            .method("POST")
            .uri("/v1/logs")
            .header("content-type", "application/json")
            .body(Body::from("not valid json {{{"))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn otlp_empty_resource_logs_returns_200_no_events() {
        let state = test_state();
        let app = build_router(state.clone());

        let body = serde_json::json!({"resourceLogs": []});

        let request = Request::builder()
            .method("POST")
            .uri("/v1/logs")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let count = state.event_store.lock().unwrap().get_event_count().unwrap();
        assert_eq!(count, 0, "No events should be persisted for empty resourceLogs");
    }

    #[tokio::test]
    async fn otlp_unrecognized_event_returns_200_no_events() {
        let state = test_state();
        let app = build_router(state.clone());

        let body = serde_json::json!({
            "resourceLogs": [{
                "resource": {"attributes": []},
                "scopeLogs": [{
                    "scope": {"name": "test"},
                    "logRecords": [{
                        "timeUnixNano": "1774290633104000000",
                        "observedTimeUnixNano": "1774290633104000000",
                        "body": {"stringValue": "unknown.event_type"},
                        "attributes": [
                            {"key": "session.id", "value": {"stringValue": "sess-unknown"}},
                            {"key": "event.name", "value": {"stringValue": "unknown_event_type"}}
                        ],
                        "droppedAttributesCount": 0
                    }]
                }]
            }]
        });

        let request = Request::builder()
            .method("POST")
            .uri("/v1/logs")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let count = state.event_store.lock().unwrap().get_event_count().unwrap();
        assert_eq!(count, 0, "No events should be persisted for unrecognized event types");
    }

    #[tokio::test]
    async fn otlp_route_does_not_affect_hooks_route() {
        // Verify existing /hooks/:type route still works alongside /v1/logs
        let state = test_state();
        let app = build_router(state.clone());

        let body = serde_json::json!({
            "session_id": "sess-hooks-coexist",
            "tool": "bash"
        });

        let request = Request::builder()
            .method("POST")
            .uri("/hooks/PreToolUse")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(
            response.status(),
            StatusCode::OK,
            "Existing /hooks/:type route must still work after adding /v1/logs"
        );
    }

    // --- OTLP /v1/metrics handler tests ---

    /// Build a minimal valid OTLP ExportMetricsServiceRequest with one cost.usage data point.
    fn otlp_metrics_body(session_id: &str) -> serde_json::Value {
        serde_json::json!({
            "resourceMetrics": [{
                "resource": {
                    "attributes": [
                        {"key": "service.name", "value": {"stringValue": "claude-code"}},
                        {"key": "service.version", "value": {"stringValue": "2.1.81"}},
                        {"key": "os.type", "value": {"stringValue": "linux"}},
                        {"key": "host.arch", "value": {"stringValue": "x86_64"}}
                    ]
                },
                "scopeMetrics": [{
                    "scope": {"name": "com.anthropic.claude_code", "version": "2.1.81"},
                    "metrics": [{
                        "name": "claude_code.cost.usage",
                        "description": "Cost tracking",
                        "unit": "USD",
                        "sum": {
                            "aggregationTemporality": 1,
                            "isMonotonic": true,
                            "dataPoints": [{
                                "attributes": [
                                    {"key": "session.id", "value": {"stringValue": session_id}},
                                    {"key": "model", "value": {"stringValue": "claude-opus-4-6[1m]"}}
                                ],
                                "startTimeUnixNano": "1774290634816000000",
                                "timeUnixNano": "1774290637123000000",
                                "asDouble": 0.144065
                            }]
                        }
                    }]
                }]
            }]
        })
    }

    #[tokio::test]
    async fn metrics_valid_payload_returns_200_and_accumulates() {
        let state = test_state();
        let app = build_router(state.clone());

        let body = otlp_metrics_body("sess-metrics-1");

        let request = Request::builder()
            .method("POST")
            .uri("/v1/metrics")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // Verify response body is {}
        let response_body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        assert_eq!(
            std::str::from_utf8(&response_body).unwrap(),
            "{}",
            "OTLP metrics success response must be {{}}"
        );

        // Verify metric was accumulated
        let metrics = state
            .metric_store
            .lock()
            .unwrap()
            .get_metrics_for_session("sess-metrics-1")
            .unwrap();
        assert_eq!(metrics.len(), 1, "One metric should be accumulated");
        assert_eq!(metrics[0].metric_name, "cost.usage");
        assert_eq!(metrics[0].attribute_key, "model=claude-opus-4-6");
        assert!(
            (metrics[0].value - 0.144065).abs() < f64::EPSILON,
            "Metric value should match the data point"
        );
    }

    #[tokio::test]
    async fn metrics_malformed_json_returns_400() {
        let state = test_state();
        let app = build_router(state);

        let request = Request::builder()
            .method("POST")
            .uri("/v1/metrics")
            .header("content-type", "application/json")
            .body(Body::from("not valid json {{{"))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn metrics_empty_resource_metrics_returns_200_no_data() {
        let state = test_state();
        let app = build_router(state.clone());

        let body = serde_json::json!({"resourceMetrics": []});

        let request = Request::builder()
            .method("POST")
            .uri("/v1/metrics")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let metrics = state
            .metric_store
            .lock()
            .unwrap()
            .get_metrics_for_session("any-session")
            .unwrap();
        assert!(metrics.is_empty(), "No metrics should be accumulated for empty resourceMetrics");
    }

    #[tokio::test]
    async fn metrics_resource_attributes_written_as_session_metadata() {
        let state = test_state();
        let app = build_router(state.clone());

        let body = otlp_metrics_body("sess-metadata-1");

        let request = Request::builder()
            .method("POST")
            .uri("/v1/metrics")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // Verify session metadata was written from resource attributes
        let metadata = state
            .metric_store
            .lock()
            .unwrap()
            .get_session_metadata("sess-metadata-1")
            .unwrap()
            .expect("Session metadata should be written");

        assert_eq!(metadata.session_id, "sess-metadata-1");
        assert_eq!(metadata.service_version, Some("2.1.81".to_string()));
        assert_eq!(metadata.os_type, Some("linux".to_string()));
        assert_eq!(metadata.host_arch, Some("x86_64".to_string()));
    }

    #[tokio::test]
    async fn metrics_multiple_data_points_all_accumulated() {
        let state = test_state();
        let app = build_router(state.clone());

        let body = serde_json::json!({
            "resourceMetrics": [{
                "resource": {"attributes": []},
                "scopeMetrics": [{
                    "scope": {"name": "com.anthropic.claude_code"},
                    "metrics": [
                        {
                            "name": "claude_code.cost.usage",
                            "sum": {
                                "aggregationTemporality": 1,
                                "isMonotonic": true,
                                "dataPoints": [{
                                    "attributes": [
                                        {"key": "session.id", "value": {"stringValue": "sess-multi"}},
                                        {"key": "model", "value": {"stringValue": "claude-opus-4-6"}}
                                    ],
                                    "startTimeUnixNano": "1774290634816000000",
                                    "timeUnixNano": "1774290637123000000",
                                    "asDouble": 0.05
                                }]
                            }
                        },
                        {
                            "name": "claude_code.token.usage",
                            "sum": {
                                "aggregationTemporality": 1,
                                "isMonotonic": true,
                                "dataPoints": [{
                                    "attributes": [
                                        {"key": "session.id", "value": {"stringValue": "sess-multi"}},
                                        {"key": "model", "value": {"stringValue": "claude-opus-4-6"}},
                                        {"key": "type", "value": {"stringValue": "input"}}
                                    ],
                                    "startTimeUnixNano": "1774290634816000000",
                                    "timeUnixNano": "1774290637123000000",
                                    "asDouble": 337.0
                                }]
                            }
                        }
                    ]
                }]
            }]
        });

        let request = Request::builder()
            .method("POST")
            .uri("/v1/metrics")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let metrics = state
            .metric_store
            .lock()
            .unwrap()
            .get_metrics_for_session("sess-multi")
            .unwrap();
        assert_eq!(metrics.len(), 2, "Both metrics should be accumulated");
    }

    #[tokio::test]
    async fn metrics_route_does_not_affect_existing_routes() {
        // Verify /hooks/:type and /v1/logs still work alongside /v1/metrics
        let state = test_state();

        // Test /hooks/:type
        let app = build_router(state.clone());
        let hook_body = serde_json::json!({
            "session_id": "sess-coexist",
            "tool": "bash"
        });
        let hook_request = Request::builder()
            .method("POST")
            .uri("/hooks/PreToolUse")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&hook_body).unwrap()))
            .unwrap();
        let hook_response = app.oneshot(hook_request).await.unwrap();
        assert_eq!(
            hook_response.status(),
            StatusCode::OK,
            "/hooks/:type must still work after adding /v1/metrics"
        );

        // Test /v1/logs
        let app = build_router(state.clone());
        let logs_body = otlp_api_request_body("sess-coexist-logs");
        let logs_request = Request::builder()
            .method("POST")
            .uri("/v1/logs")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&logs_body).unwrap()))
            .unwrap();
        let logs_response = app.oneshot(logs_request).await.unwrap();
        assert_eq!(
            logs_response.status(),
            StatusCode::OK,
            "/v1/logs must still work after adding /v1/metrics"
        );
    }

    // --- Session metadata enrichment from /v1/logs ---

    /// Build an OTLP logs request with terminal.type on log record and resource attributes.
    fn otlp_logs_with_terminal_type(session_id: &str) -> serde_json::Value {
        serde_json::json!({
            "resourceLogs": [{
                "resource": {
                    "attributes": [
                        {"key": "service.name", "value": {"stringValue": "claude-code"}},
                        {"key": "service.version", "value": {"stringValue": "2.1.81"}},
                        {"key": "os.type", "value": {"stringValue": "linux"}},
                        {"key": "host.arch", "value": {"stringValue": "x86_64"}}
                    ]
                },
                "scopeLogs": [{
                    "scope": {"name": "com.anthropic.claude_code.events"},
                    "logRecords": [{
                        "timeUnixNano": "1774290633104000000",
                        "observedTimeUnixNano": "1774290633104000000",
                        "body": {"stringValue": "claude_code.api_request"},
                        "attributes": [
                            {"key": "session.id", "value": {"stringValue": session_id}},
                            {"key": "event.name", "value": {"stringValue": "api_request"}},
                            {"key": "event.timestamp", "value": {"stringValue": "2026-03-23T18:30:33Z"}},
                            {"key": "event.sequence", "value": {"intValue": "1"}},
                            {"key": "prompt.id", "value": {"stringValue": "prompt-1"}},
                            {"key": "model", "value": {"stringValue": "claude-opus-4-6"}},
                            {"key": "input_tokens", "value": {"stringValue": "337"}},
                            {"key": "output_tokens", "value": {"stringValue": "12"}},
                            {"key": "terminal.type", "value": {"stringValue": "vscode"}}
                        ],
                        "droppedAttributesCount": 0
                    }]
                }]
            }]
        })
    }

    #[tokio::test]
    async fn logs_with_terminal_type_writes_session_metadata() {
        let state = test_state();
        let app = build_router(state.clone());

        let body = otlp_logs_with_terminal_type("sess-enrich-1");

        let request = Request::builder()
            .method("POST")
            .uri("/v1/logs")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // Verify session metadata was written with terminal_type and resource attributes
        let metadata = state
            .metric_store
            .lock()
            .unwrap()
            .get_session_metadata("sess-enrich-1")
            .unwrap()
            .expect("Session metadata should be written from /v1/logs");

        assert_eq!(metadata.session_id, "sess-enrich-1");
        assert_eq!(metadata.terminal_type, Some("vscode".to_string()));
        assert_eq!(metadata.service_version, Some("2.1.81".to_string()));
        assert_eq!(metadata.os_type, Some("linux".to_string()));
        assert_eq!(metadata.host_arch, Some("x86_64".to_string()));
    }

    #[tokio::test]
    async fn logs_missing_terminal_type_writes_metadata_with_null_terminal() {
        let state = test_state();
        let app = build_router(state.clone());

        // Use the existing helper which has no terminal.type attribute
        let body = otlp_api_request_body("sess-enrich-no-term");

        let request = Request::builder()
            .method("POST")
            .uri("/v1/logs")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // Metadata should be written but with terminal_type = None
        let metadata = state
            .metric_store
            .lock()
            .unwrap()
            .get_session_metadata("sess-enrich-no-term")
            .unwrap()
            .expect("Session metadata should be written even without terminal.type");

        assert_eq!(metadata.session_id, "sess-enrich-no-term");
        assert!(metadata.terminal_type.is_none(), "Missing terminal.type should produce None, not error");
    }

    // --- Event counter acceptance tests (step 02-01) ---

    #[tokio::test]
    async fn event_counter_equals_total_successful_writes_across_all_endpoints() {
        let state = test_state();

        // 1 hook write
        let app = build_router(state.clone());
        let hook_body = serde_json::json!({
            "session_id": "sess-counter-accept",
            "tool": "bash"
        });
        let request = Request::builder()
            .method("POST")
            .uri("/hooks/PreToolUse")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&hook_body).unwrap()))
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // 1 OTLP log write (contains 1 log record)
        let app = build_router(state.clone());
        let logs_body = otlp_api_request_body("sess-counter-accept-log");
        let request = Request::builder()
            .method("POST")
            .uri("/v1/logs")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&logs_body).unwrap()))
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // 1 OTLP metric write (contains 1 data point)
        let app = build_router(state.clone());
        let metrics_body = otlp_metrics_body("sess-counter-accept-metric");
        let request = Request::builder()
            .method("POST")
            .uri("/v1/metrics")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&metrics_body).unwrap()))
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // Total successful writes: 1 hook + 1 log + 1 metric = 3
        let counter_value = state.event_counter.load(std::sync::atomic::Ordering::Relaxed);
        assert_eq!(
            counter_value, 3,
            "Event counter should equal total successful writes across all endpoints"
        );
    }

    #[tokio::test]
    async fn bound_port_stores_actual_port_on_successful_bind() {
        let state = test_state();

        // Bind to port 0 (OS assigns an available port)
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("should bind to an available port");
        let actual_port = listener.local_addr().unwrap().port();

        state
            .bound_port
            .store(actual_port as u32, std::sync::atomic::Ordering::Relaxed);

        let stored_port = state.bound_port.load(std::sync::atomic::Ordering::Relaxed);
        assert_eq!(
            stored_port, actual_port as u32,
            "bound_port should store the actual port from local_addr()"
        );
        assert_ne!(stored_port, 0, "bound_port should not be 0 after successful bind");
    }

    #[tokio::test]
    async fn bound_port_stores_zero_on_bind_failure() {
        let state = test_state();

        // Simulate bind failure: store 0 as the unavailable sentinel
        state
            .bound_port
            .store(0, std::sync::atomic::Ordering::Relaxed);

        let stored_port = state.bound_port.load(std::sync::atomic::Ordering::Relaxed);
        assert_eq!(
            stored_port, 0,
            "bound_port should be 0 (unavailable sentinel) when bind fails"
        );
    }

    #[tokio::test]
    async fn event_counter_unchanged_on_write_error() {
        let state = test_state();

        // Send a request that returns an error (unknown event type -> no write happens)
        let app = build_router(state.clone());
        let body = serde_json::json!({"session_id": "sess-err"});
        let request = Request::builder()
            .method("POST")
            .uri("/hooks/InvalidEventType")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        // Send malformed JSON to /v1/logs (returns 400, no write)
        let app = build_router(state.clone());
        let request = Request::builder()
            .method("POST")
            .uri("/v1/logs")
            .header("content-type", "application/json")
            .body(Body::from("not valid json"))
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        // Send malformed JSON to /v1/metrics (returns 400, no write)
        let app = build_router(state.clone());
        let request = Request::builder()
            .method("POST")
            .uri("/v1/metrics")
            .header("content-type", "application/json")
            .body(Body::from("not valid json"))
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let counter_value = state.event_counter.load(std::sync::atomic::Ordering::Relaxed);
        assert_eq!(
            counter_value, 0,
            "Event counter must not change when writes return errors"
        );
    }

    // --- Tray formatting acceptance tests (step 03-01) ---

    #[test]
    fn tooltip_contains_port_and_event_count_for_active_server() {
        let tooltip = format_tray_tooltip(3748, 42);
        assert!(
            tooltip.contains("Port: 3748"),
            "Tooltip should contain 'Port: 3748', got: {}",
            tooltip
        );
        assert!(
            tooltip.contains("Events: 42"),
            "Tooltip should contain 'Events: 42', got: {}",
            tooltip
        );
        assert!(
            tooltip.contains("Norbert Hook Receiver"),
            "Tooltip should contain 'Norbert Hook Receiver', got: {}",
            tooltip
        );
    }

    #[test]
    fn tooltip_shows_port_unavailable_when_port_is_zero() {
        let tooltip = format_tray_tooltip(0, 5);
        assert!(
            tooltip.contains("Port: unavailable"),
            "Tooltip should contain 'Port: unavailable' when port=0, got: {}",
            tooltip
        );
        assert!(
            tooltip.contains("Events: 5"),
            "Tooltip should contain 'Events: 5', got: {}",
            tooltip
        );
    }

    #[test]
    fn format_port_label_shows_number_for_nonzero_port() {
        assert_eq!(format_port_label(3748), "Port: 3748");
        assert_eq!(format_port_label(8080), "Port: 8080");
        assert_eq!(format_port_label(1), "Port: 1");
    }

    #[test]
    fn format_port_label_shows_unavailable_for_zero() {
        assert_eq!(format_port_label(0), "Port: unavailable");
    }

    #[test]
    fn format_event_count_label_shows_count() {
        assert_eq!(format_event_count_label(0), "Events: 0");
        assert_eq!(format_event_count_label(1), "Events: 1");
        assert_eq!(format_event_count_label(999999), "Events: 999999");
    }

    #[test]
    fn tooltip_contains_all_three_lines() {
        let tooltip = format_tray_tooltip(3748, 0);
        let lines: Vec<&str> = tooltip.lines().collect();
        assert_eq!(lines.len(), 3, "Tooltip should have exactly 3 lines, got: {:?}", lines);
        assert_eq!(lines[0], "Norbert Hook Receiver");
        assert_eq!(lines[1], "Port: 3748");
        assert_eq!(lines[2], "Events: 0");
    }

    #[test]
    fn menu_title_label_is_norbert_hook_receiver() {
        assert_eq!(menu_title_label(), "Norbert Hook Receiver");
    }

    #[tokio::test]
    async fn logs_enrichment_does_not_break_existing_event_persistence() {
        let state = test_state();
        let app = build_router(state.clone());

        let body = otlp_logs_with_terminal_type("sess-enrich-events");

        let request = Request::builder()
            .method("POST")
            .uri("/v1/logs")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // Existing behavior: events still persisted
        let count = state.event_store.lock().unwrap().get_event_count().unwrap();
        assert_eq!(count, 1, "Event persistence must not be broken by enrichment");

        let stored_type: String = {
            let store = state.event_store.lock().unwrap();
            store.get_stored_event_type("sess-enrich-events")
                .expect("should find stored event")
        };
        assert_eq!(stored_type, "api_request");
    }
}
