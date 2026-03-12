# Session Event Viewer — Evolution Record

**Feature ID**: session-event-viewer
**Delivered**: 2026-03-12
**Paradigm**: Functional
**Crafter**: nw-functional-software-crafter

## Summary

Phase 2 of the Norbert build order. Replaces the walking skeleton status display with a session list and event detail viewer, styled with the glassmorphism design system from norbert-mockup-v5.html. Introduces the provider abstraction layer for multi-tool extensibility.

## Architecture Changes

### Provider Abstraction Layer
- **EventProvider trait** (ports/mod.rs) — normalization contract for tool-specific event providers
- **ClaudeCodeProvider** (adapters/providers/claude_code.rs) — first adapter, normalizes PascalCase hook names to canonical snake_case event types
- **Canonical EventType enum** (domain/mod.rs) — 6 tool-agnostic variants: session_start, session_end, tool_call_start, tool_call_end, agent_complete, prompt_submit
- Claude Code-specific constants (HOOK_EVENT_NAMES, parse_event_type) live in the adapter, not domain

### Storage
- Events table extended with `provider` column (`TEXT NOT NULL DEFAULT 'unknown'`)
- write_event wrapped in SQLite transaction (BEGIN IMMEDIATE / COMMIT / ROLLBACK)
- get_events_for_session returns proper error on unknown event_type (no silent fallback)

### IPC Commands
- `get_sessions` — returns all sessions, most recent first
- `get_session_events` — returns canonical events for a session, chronological

### Frontend
- **SessionListView** — glassmorphism cards, pulsing status dots, keyboard accessible
- **EventDetailView** — fixed session header, scrollable event list, back navigation, error state
- **Design system** — 5 themes via CSS custom properties, theme switching with localStorage persistence
- **Fonts** — Rajdhani (UI labels), Share Tech Mono (data values) via Google Fonts
- Pure domain functions for formatting, theme management, event display

## Steps Executed

| Step | Title | Phases |
|------|-------|--------|
| 01-01 | Canonical event types and provider port | PREPARE, RED_UNIT, GREEN, COMMIT |
| 01-02 | Claude Code provider adapter | PREPARE, RED_UNIT, GREEN, COMMIT |
| 01-03 | Hook receiver integration with provider | PREPARE, RED_ACCEPTANCE, GREEN, COMMIT |
| 02-01 | EventStore session events query and IPC commands | PREPARE, RED_UNIT, GREEN, COMMIT |
| 03-01 | Design system CSS, fonts, and theme switching | PREPARE, RED_UNIT, GREEN, COMMIT |
| 04-01 | Session list view | PREPARE, RED_UNIT, GREEN, COMMIT |
| 04-02 | Event detail view with navigation | PREPARE, RED_UNIT, GREEN, COMMIT |

## Review Findings Addressed

### Phase 4a (Backend focus) — 5 defects fixed
- D1: Silent fallback on unknown event_type → proper error
- D2: Missing provider column in SQLite → added with storage/retrieval
- D3: No transaction in write_event → wrapped in BEGIN/COMMIT/ROLLBACK
- D7: HOOK_EVENT_NAMES in domain → moved to Claude Code adapter
- D10: Test budget exceeded → consolidated from 129 to 80 tests

### Phase 4b (Frontend focus) — 8 defects fixed
- D1: Unguarded IPC event type seam → CANONICAL_EVENT_TYPES set with unknown handling
- D2: Silent IPC errors → error state in EventDetailView
- D3: Missing keyboard handler → onKeyDown for Enter/Space on session rows
- D4: Race condition in polling → cancelled flag in useEffect
- D5: Testing theater → deleted tautological type-shape tests
- D6: Wrong vocabulary in canary test → fixed to snake_case canonical names
- D7: Unused --status-text-override → wired into .status-bar CSS
- D8: Unstable list keys → improved key composition

## Test Counts

- Rust: 80 tests (domain: 72, hook_receiver: 8)
- TypeScript: 81 tests (status: 34, eventDetail: 23, theme: 14, sessionList: 10)

## Files Modified (22)

### Backend (Rust)
- src-tauri/src/domain/mod.rs
- src-tauri/src/ports/mod.rs
- src-tauri/src/adapters/mod.rs
- src-tauri/src/adapters/providers/mod.rs
- src-tauri/src/adapters/providers/claude_code.rs
- src-tauri/src/adapters/db/mod.rs
- src-tauri/src/hook_receiver.rs
- src-tauri/src/lib.rs

### Frontend (TypeScript/React/CSS)
- src/App.tsx
- src/main.tsx
- src/views/SessionListView.tsx
- src/views/EventDetailView.tsx
- src/domain/status.ts
- src/domain/theme.ts
- src/domain/eventDetail.ts
- src/domain/eventDetail.test.ts
- src/domain/sessionList.test.ts
- src/domain/theme.test.ts
- src/styles/design-system.css
- src/styles/themes.css
- index.html

### Documentation
- docs/feature/session-event-viewer/deliver/execution-log.json
