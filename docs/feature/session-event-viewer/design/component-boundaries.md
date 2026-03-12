# Component Boundaries: Session Event Viewer

## Boundary Map (Phase 2)

```
+----------------------------------------------------------------------+
|                        Norbert Desktop App                            |
|                                                                       |
|  +---------------------+      +--------------------+                  |
|  |    React UI          |      |   Tauri Shell     |                  |
|  |  (WebView)           |<---->|  (Rust)           |                  |
|  |                      | IPC  |                   |                  |
|  | - SessionListView    |      | - App lifecycle   |                  |
|  | - EventDetailView    |      | - Tray manager    |                  |
|  | - Design System CSS  |      | - Window manager  |                  |
|  | - StatusBar          |      | - IPC commands:   |                  |
|  +---------------------+      |   get_sessions    |                  |
|                                |   get_session_    |                  |
|                                |     events        |                  |
|                                +--------+----------+                  |
|                                         |                             |
|                                +--------v----------+                  |
|                                |   Application     |                  |
|                                |   (composes       |                  |
|                                |    adapters)      |                  |
|                                +--------+----------+                  |
|                                         |                             |
|              +--------------------------+------------------------+    |
|              |                          |                        |    |
|     +--------v--------+      +---------v--------+     +---------v-+  |
|     | Hook Receiver   |      | Event Store      |     | Claude    |  |
|     | (HTTP adapter)  |      | (SQLite adapter)  |     | Code      |  |
|     |                 |      |                   |     | Provider  |  |
|     | Receives raw    |      | Implements:       |     | (adapter) |  |
|     | hooks, delegates|      |  EventStore port  |     |           |  |
|     | to provider     |      |  (extended with   |     | Normalizes|  |
|     |                 |      |   get_events_for  |     | hooks to  |  |
|     | Implements:     |      |   _session)       |     | canonical |  |
|     |  HTTP endpoint  |      |                   |     | events    |  |
|     +--------+--------+      +--------+----------+     +-----+-----+  |
|              |                         |                       |      |
|              |    +--------------------+                       |      |
|              |    |                                            |      |
|              v    v                                            |      |
|     +----------------+                                        |      |
|     | Port 3748      |   raw payload                          |      |
|     | (network)      |------->------>------>------>----------->+      |
|     +----------------+                                               |
|                       +----------------+                             |
|                       | norbert.db     |                             |
|                       | (canonical     |                             |
|                       |  events only)  |                             |
|                       +----------------+                             |
+----------------------------------------------------------------------+
```

## Module Responsibilities (Phase 2 Additions)

### domain (Rust) -- MODIFIED

**Owns**: Canonical event types. Session types (unchanged). Pure functions.

Phase 2 changes:
- **CanonicalEventType enum**: tool-agnostic event classification (session_start, session_end, tool_call_start, tool_call_end, agent_complete, prompt_submit)
- **CanonicalEvent struct**: session_id, event_type (canonical), payload (normalized), received_at, provider (identifies source tool)
- Existing EventType enum removed from domain. Moved to Claude Code provider adapter as a private type.
- All existing pure functions (duration calc, status derivation) unchanged.

### ports (Rust) -- MODIFIED

**Owns**: Trait definitions. Depends only on domain.

Phase 2 changes:
- **EventStore trait extended**: new method `get_events_for_session(session_id) -> Vec<CanonicalEvent>`
- **EventProvider trait (new)**: normalization contract for providers
- Existing EventStore methods unchanged (write_event now accepts CanonicalEvent)

### adapters/db (Rust) -- MODIFIED

**Owns**: SQLite implementation of EventStore.

Phase 2 changes:
- `write_event` stores canonical event types (e.g., `tool_call_start` instead of `pre_tool_use`)
- `get_events_for_session`: new method implementing the session event query
- Existing methods (get_sessions, get_event_count, get_latest_session) unchanged

### adapters/providers/claude_code (Rust) -- NEW

**Owns**: Claude Code-specific event normalization. Only module that knows Claude Code hook format.

Responsibilities:
- Maps PascalCase event names (PreToolUse) to canonical types (tool_call_start)
- Extracts session_id from Claude Code payload format
- Extracts tool name from PreToolUse/PostToolUse payloads
- Extracts prompt text from UserPromptSubmit payloads
- Produces CanonicalEvent values from raw HTTP payloads

**Boundary rule**: Claude Code-specific types (event names, payload field paths) are private to this module. Nothing outside this adapter references Claude Code format.

### hook-receiver (Rust) -- MODIFIED

**Owns**: HTTP server implementation.

Phase 2 changes:
- Handler delegates to Claude Code provider for normalization before writing
- No longer directly constructs HookEvent -- receives CanonicalEvent from provider
- Event type validation moves to the provider (provider returns error for unknown types)

### app (Rust, Tauri entry point) -- MODIFIED

**Owns**: Composition root and Tauri lifecycle.

Phase 2 changes:
- New IPC command: `get_sessions` (wraps existing EventStore method)
- New IPC command: `get_session_events` (wraps new EventStore method)
- Composition root instantiates Claude Code provider and passes to sidecar

### ui (TypeScript/React) -- MODIFIED

**Owns**: Visual presentation. Depends on Tauri IPC only.

Phase 2 additions:
- **SessionListView**: Renders all sessions, most-recent-first. Session rows with timestamp, duration, event count, live/done status dot.
- **EventDetailView**: Renders events for selected session. Session header + chronological event list.
- **Design system**: CSS custom properties for all 5 themes from mockup. Rajdhani + Share Tech Mono fonts. Glassmorphism cards. Theme switching with localStorage persistence.
- **Navigation**: selectedSessionId state controls view switching.
- **Domain types**: CanonicalEvent interface added to frontend domain module.

## Boundary Rules (Unchanged + New)

1. **UI never imports Rust types directly** -- Tauri IPC only
2. **Adapters never import other adapters** -- all depend on ports
3. **Domain never imports anything outside domain** -- pure types and functions
4. **Ports never import adapters** -- dependency inversion enforced
5. **Only app composes** -- creates concrete adapter instances
6. **NEW: No Claude Code types above provider adapter** -- domain, ports, app, UI use canonical types only. Claude Code-specific names/formats exist only in `adapters/providers/claude_code`.

## New Integration Points (Phase 2)

| From | To | Data | Contract |
|------|-----|------|----------|
| Hook Receiver | Claude Code Provider | Raw event type name + JSON payload | Provider normalizes or returns error |
| Claude Code Provider | EventStore | CanonicalEvent value | write_event (existing method, new type) |
| IPC get_sessions | EventStore | none -> Vec<Session> | Existing method, new IPC wrapper |
| IPC get_session_events | EventStore | session_id -> Vec<CanonicalEvent> | New method + new IPC wrapper |
| Frontend SessionListView | IPC get_sessions | Polls every 1s | Returns Session[] |
| Frontend EventDetailView | IPC get_session_events | Polls every 1s with session_id | Returns CanonicalEvent[] |
| Frontend all views | Design system CSS | CSS custom properties | Variables from mockup |

## File Impact Estimate

| Module | New Files | Modified Files | Total |
|--------|-----------|---------------|-------|
| domain | 0 | 1 (mod.rs) | 1 |
| ports | 0 | 1 (mod.rs) | 1 |
| adapters/db | 0 | 1 (mod.rs) | 1 |
| adapters/providers | 1 (claude_code.rs) | 1 (mod.rs) | 2 |
| hook-receiver | 0 | 1 (hook_receiver.rs) | 1 |
| app | 0 | 1 (lib.rs) | 1 |
| ui domain | 0 | 1 (status.ts -> types evolve) | 1 |
| ui views | 2-3 (SessionList, EventDetail, CSS) | 1 (App.tsx) | 3-4 |
| **Total** | **3-4** | **8** | **11-12** |
