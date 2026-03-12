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

/// Build the axum router with hook routes.
fn build_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/hooks/:event_type", post(handle_hook_event))
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
}
