# ADR-012: Multi-Window IPC Architecture -- Tauri Event System

## Status

Accepted

## Context

Phase 3 introduces multi-window support. Multiple Norbert windows must receive live event updates from the single backend process. The IPC mechanism must: (1) deliver events to all windows without per-window polling, (2) add zero backend overhead per additional window, (3) support per-window layout independence.

**Quality attribute drivers**: Performance (no degradation with multiple windows), reliability (events delivered to all windows), maintainability (simple IPC model).

**Constraints**: Single backend process (Tauri app). Windows are Tauri webviews. Solo developer.

## Decision

Use Tauri's built-in event system (`app_handle.emit()` + `listen()` in webview). The backend emits named events; each window's webview subscribes independently.

**Event flow**:
1. Hook receiver writes event to SQLite
2. Hook receiver notifies Tauri app via IPC command
3. Tauri app calls `app_handle.emit("norbert://event-received", payload)`
4. All open windows receive the event via their `listen("norbert://event-received")` subscription
5. Each window's React app updates its own UI state

**Per-window state**: Each window maintains its own layout state, zone assignments, and view instances. The shared backend data (sessions, events) is queried directly from SQLite (WAL mode allows concurrent reads).

**Window lifecycle**:
- `WebviewWindowBuilder::new()` creates new windows
- Each window loads the same React app with a `window-id` parameter
- Layout engine reads `layout-{window-id}.json` for that window's configuration
- Closing a window unsubscribes its event listener automatically (Tauri handles this)

## Alternatives Considered

### Per-Window Polling

- What: Each window polls the backend at intervals (like current Phase 2 single-window approach).
- Expected impact: Simple implementation, works immediately.
- Why insufficient: N windows polling at 1s intervals = N queries/second. Scales linearly with window count. Produces noticeable update delay (up to 1s). Push-based events are both more responsive and more efficient.

### Custom WebSocket Server

- What: Embed a WebSocket server in the backend; windows connect as WebSocket clients.
- Expected impact: Full-featured pub/sub with backpressure.
- Why insufficient: Over-engineered. Tauri's built-in event system provides exactly the same pub/sub capability without a separate server. Adding a WebSocket server means managing connection lifecycle, reconnection, heartbeats -- all solved problems in Tauri's event system.

### Shared Memory / IPC via File

- What: Backend writes events to a shared file or memory-mapped region; windows watch it.
- Expected impact: Very low latency.
- Why insufficient: Tauri already provides efficient IPC between the Rust backend and webview processes. Shared memory adds platform-specific complexity (different APIs on Windows/macOS/Linux) for marginal latency benefit in a UI that updates at most every 100ms.

## Consequences

**Positive**:
- Zero additional backend overhead per window (emit is O(1) per window)
- Sub-millisecond event delivery to all windows
- Tauri handles subscriber lifecycle automatically (window close = unsubscribe)
- Same codebase for single and multi-window modes
- Battle-tested by VS Code's equivalent architecture

**Negative**:
- Tauri event payloads are serialized (JSON) -- large payloads could add latency (mitigated: events are small; bulk data fetched via direct SQLite query)
- No built-in backpressure (mitigated: event rate is bounded by hook frequency, typically <10/second)
