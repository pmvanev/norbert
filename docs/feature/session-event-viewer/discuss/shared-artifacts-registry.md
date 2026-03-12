# Shared Artifacts Registry: Session Event Viewer

## Registry

### session_list

- **Source of truth**: `EventStore::get_sessions()` (SQLite `sessions` table, `ORDER BY started_at DESC`)
- **Consumers**:
  - Session list view (renders all session rows)
  - Status bar session count
  - Session selection (click handler reads session.id)
- **Owner**: Norbert backend (Rust IPC command `get_sessions`)
- **Integration risk**: MEDIUM -- if the query changes ordering or returns stale data, the list does not match reality
- **Validation**: Session list count must match `SELECT COUNT(*) FROM sessions`. Ordering must be most-recent-first.

### session_events

- **Source of truth**: `EventStore::get_events_for_session(session_id)` (SQLite `events` table, filtered by `session_id`, `ORDER BY received_at ASC`)
- **Consumers**:
  - Event detail view (renders event rows for selected session)
  - Event count in session detail header
- **Owner**: Norbert backend (new Rust IPC command `get_session_events`)
- **Integration risk**: HIGH -- this is a new query that does not exist in the walking skeleton. If the filter or ordering is wrong, events from other sessions appear or events display out of order.
- **Validation**: Event count from query must match `SELECT COUNT(*) FROM events WHERE session_id = ?`. Events must be in chronological order.

### selected_session_id

- **Source of truth**: User click event on a session row in the frontend
- **Consumers**:
  - Event query filter (passed to `get_session_events` IPC call)
  - Session detail header (displays metadata for selected session)
- **Owner**: Frontend React component state
- **Integration risk**: MEDIUM -- if the session ID is stale or invalid (session deleted between list and click), the event query returns empty or errors
- **Validation**: Selected ID must exist in sessions table. Frontend should handle the case where it does not.

### design_system

- **Source of truth**: `norbert-mockup-v5.html` CSS variables and class patterns
- **Consumers**:
  - Session row styling (`.srow`, `.sdot`, `.sname`, `.scost` patterns)
  - Event row styling (similar card pattern)
  - Typography (`--font-ui: Rajdhani`, `--font-mono: Share Tech Mono`)
  - Color scheme (`--brand`, `--text-p`, `--text-s`, `--text-m`, `--bg-card`, `--border-card`)
  - Status indicators (`.sdot.live`, `.sdot.done`, `@keyframes lpulse`)
- **Owner**: Design system (norbert-mockup-v5.html)
- **Integration risk**: HIGH -- Phase 2 is the first time Norbert displays styled data views. If the design system is not correctly applied, the app looks inconsistent with the target aesthetic.
- **Validation**: Visual inspection against mockup. CSS variables must be imported and used, not hardcoded.

### version

- **Source of truth**: `package.json` / `Cargo.toml` version field (inherited from walking skeleton)
- **Consumers**:
  - Titlebar display
  - Tray icon tooltip
- **Owner**: Build pipeline
- **Integration risk**: HIGH (inherited) -- version mismatch between displayed and actual
- **Validation**: Same as walking skeleton -- `env!("CARGO_PKG_VERSION")` constant

### hook_port

- **Source of truth**: `domain::HOOK_PORT` constant (3748)
- **Consumers**:
  - Status bar display
  - HTTP server bind address
- **Owner**: Norbert core
- **Integration risk**: HIGH (inherited)
- **Validation**: Same as walking skeleton

### database_path

- **Source of truth**: `adapters::db::resolve_database_path()`
- **Consumers**:
  - Session list queries (reader)
  - Event list queries (reader)
  - Hook receiver event writes (writer)
- **Owner**: Norbert core
- **Integration risk**: HIGH (inherited) -- if reader and writer use different paths, UI shows no data
- **Validation**: Same as walking skeleton

## Integration Validation Checkpoints

### Checkpoint 1: Session List Query Works

**What to validate**: `get_sessions` IPC command returns session data that matches what is in the database.

**How to validate**:
1. Insert test sessions into SQLite directly
2. Call `get_sessions` IPC command
3. Verify returned list matches inserted data
4. Verify ordering is most-recent-first

**Failure indicator**: Empty session list despite sessions in database, wrong ordering, or missing fields.

### Checkpoint 2: Event List Query Works

**What to validate**: `get_session_events` IPC command returns events filtered by session ID in chronological order.

**How to validate**:
1. Insert test events for multiple sessions into SQLite
2. Call `get_session_events` with a specific session ID
3. Verify only events for that session are returned
4. Verify events are in chronological order (oldest first)

**Failure indicator**: Events from wrong session, wrong ordering, or empty result despite events existing.

### Checkpoint 3: Design System Applied

**What to validate**: UI components use CSS variables and patterns from the design system mockup.

**How to validate**:
1. Visual comparison of session list against mockup's `.srow` pattern
2. Verify fonts load (Rajdhani for UI, Share Tech Mono for data)
3. Verify color scheme matches active theme
4. Verify status dots animate for live sessions

**Failure indicator**: Unstyled or inconsistent UI, wrong fonts, missing animations.

### Checkpoint 4: Navigation State

**What to validate**: Clicking a session shows events, clicking back returns to list.

**How to validate**:
1. Click a session row -> event list appears
2. Verify session header shows correct metadata
3. Click "Back to Sessions" -> session list appears
4. Verify session list is up to date

**Failure indicator**: Navigation breaks, state not preserved, data stale after return.

### Checkpoint 5: End-to-End Data Flow

**What to validate**: Run Claude Code, open Norbert, see session, click session, see events.

**How to validate**:
1. Start Norbert
2. Run a Claude Code session with tool calls
3. Open Norbert window
4. Verify session appears in list
5. Click session
6. Verify events appear with correct types and timestamps

**Failure indicator**: Session missing from list, events empty, event types wrong.
