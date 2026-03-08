# Component Boundaries: Walking Skeleton

## Boundary Map

```
+------------------------------------------------------------------+
|                        Norbert Desktop App                        |
|                                                                   |
|  +------------------+     +------------------+                    |
|  |    React UI      |     |   Tauri Shell    |                    |
|  |  (WebView)       |<--->|  (Rust)          |                    |
|  |                  |IPC  |                  |                    |
|  | - Status display |     | - App lifecycle  |                    |
|  | - Session list   |     | - Tray manager   |                    |
|  | - Event counts   |     | - Window manager |                    |
|  +------------------+     +--------+---------+                    |
|                                    |                              |
|                           +--------v---------+                    |
|                           |   Application    |                    |
|                           |   (composes      |                    |
|                           |    adapters)     |                    |
|                           +--------+---------+                    |
|                                    |                              |
|              +---------------------+---------------------+        |
|              |                     |                     |        |
|     +--------v-------+   +--------v-------+   +---------v-----+  |
|     | Hook Receiver  |   | Event Store    |   | Settings      |  |
|     | (HTTP adapter) |   | (SQLite adapter)|   | Merger        |  |
|     |                |   |                |   | (FS adapter)  |  |
|     | Implements:    |   | Implements:    |   | Implements:   |  |
|     |  HookReceiver  |   |  EventStore    |   |  SettingsMgr  |  |
|     |  port trait    |   |  port trait    |   |  port trait   |  |
|     +----------------+   +----------------+   +---------------+  |
|              |                     |                              |
|              v                     v                              |
|     +----------------+   +----------------+                       |
|     | Port 3748      |   | ~/.norbert/    |                       |
|     | (network)      |   | norbert.db     |                       |
|     +----------------+   +----------------+                       |
+------------------------------------------------------------------+
```

## Module Responsibilities

### core (Rust crate/module)

**Owns**: Domain types only. No dependencies on any external crate except std.

- `HookEvent`: Struct representing a received hook event (event_type, payload, timestamp)
- `Session`: Struct representing a session record (id, started_at, ended_at, event_count)
- `EventType`: Enum of supported hook event types
- `AppStatus`: Enum (Listening, ActiveSession, Error)
- Validation functions: pure functions that validate hook payloads

### ports (Rust crate/module)

**Owns**: Trait definitions. Depends only on core.

- `EventStore` trait: store_event, get_sessions, get_event_count, get_latest_session
- `HookReceiver` trait: start, stop (lifecycle management for the HTTP server)
- `SettingsManager` trait: merge_hooks, check_hooks_registered

### hook-receiver adapter

**Owns**: HTTP server implementation. Depends on core + ports.

- Binds to HOOK_PORT
- Routes: POST /hooks/{event_type}
- Validates event_type against HOOK_EVENT_TYPES
- Delegates storage to EventStore (injected)
- Returns HTTP 200 after successful storage

### db adapter

**Owns**: SQLite implementation of EventStore. Depends on core + ports.

- Creates database file and schema on init
- Sets WAL mode and NORMAL synchronous pragmas
- Implements all EventStore trait methods
- Manages connection pooling (single writer, multiple readers)

### settings adapter

**Owns**: File system operations for settings merge. Depends on core + ports.

- Reads ~/.claude/settings.json
- Creates byte-identical backup
- Performs surgical JSON merge
- Handles edge cases (missing file, malformed JSON, existing hooks)

### app (Rust, Tauri entry point)

**Owns**: Composition root and Tauri lifecycle. Depends on everything.

- Composes adapters with ports at startup
- Registers Tauri IPC commands (get_status, get_latest_session)
- Creates system tray icon and manages click events
- Creates/toggles main window
- Emits events to frontend when new hook events arrive

### ui (TypeScript/React)

**Owns**: Visual presentation only. Depends on Tauri IPC.

- Status display component (status, port, session count, event count)
- Last session component (timestamp, duration, event count)
- Empty state component ("Waiting for first Claude Code session...")
- Restart banner component (dismisses on first event)
- Listens for Tauri events to update counts in real time

## Boundary Rules

1. **ui never imports Rust types directly** -- communicates only through Tauri IPC invoke/listen
2. **Adapters never import other adapters** -- hook-receiver does not import db; both depend on ports
3. **core never imports anything outside core** -- pure domain types and functions
4. **ports never import adapters** -- dependency inversion enforced by Rust module visibility
5. **Only app composes** -- app is the only module that creates concrete adapter instances

## Future Plugin Extraction Points

| Module | Extraction Path |
|--------|----------------|
| hook-receiver | Becomes part of core (always present per product spec) |
| db | Becomes core database with plugin namespace sandboxing |
| settings | Becomes core settings manager |
| ui status components | Replaced by norbert-session plugin views in Phase 3 |

The walking skeleton's module boundaries are designed so that Phase 3 plugin architecture wraps these modules rather than replacing them. The ports remain; the adapters remain; the plugin API adds a layer above.
