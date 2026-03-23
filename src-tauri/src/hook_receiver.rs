/// Hook receiver sidecar binary.
///
/// HTTP server on 127.0.0.1:3748 accepting POST /hooks/:event_type.
/// Delegates normalization to an EventProvider, persists canonical events
/// via EventStore, returns 200 after write.
/// This is a separate binary target sharing the same crate as the Tauri app.

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use norbert_lib::adapters::db::SqliteEventStore;
use norbert_lib::adapters::otel::parse_export_logs_request;
use norbert_lib::adapters::providers::claude_code::ClaudeCodeProvider;
use norbert_lib::domain::HOOK_PORT;
use norbert_lib::ports::{EventProvider, EventStore};
use rusqlite::Connection;

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
    provider: Box<dyn EventProvider + Send + Sync>,
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
        Ok(()) => (StatusCode::OK, "OK".to_string()),
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

    let store = state.event_store.lock().unwrap();
    for event in &events {
        if let Err(e) = store.write_event(event) {
            eprintln!("Failed to persist OTLP event: {}", e);
        }
    }

    (StatusCode::OK, "{}".to_string())
}

/// Build the axum router with hook routes and OTLP log receiver.
fn build_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/hooks/:event_type", post(handle_hook_event))
        .route("/v1/logs", post(handle_otlp_logs))
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

    let state = Arc::new(AppState {
        event_store: Mutex::new(event_store),
        provider: Box::new(ClaudeCodeProvider),
    });
    let app = build_router(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], HOOK_PORT));
    eprintln!("norbert-hook-receiver: listening on {}", addr);

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!(
                "norbert-hook-receiver: Port {} unavailable: {}",
                HOOK_PORT, e
            );
            std::process::exit(1);
        }
    };

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("norbert-hook-receiver: Server error: {}", e);
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::Request,
    };
    use tower::ServiceExt;

    /// Create a test app state with an in-memory SQLite database
    /// and the ClaudeCodeProvider for normalization.
    fn test_state() -> Arc<AppState> {
        let conn =
            Connection::open_in_memory().expect("Failed to open in-memory database");
        let event_store =
            SqliteEventStore::new(conn).expect("Failed to initialize schema");
        Arc::new(AppState {
            event_store: Mutex::new(event_store),
            provider: Box::new(ClaudeCodeProvider),
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
}
