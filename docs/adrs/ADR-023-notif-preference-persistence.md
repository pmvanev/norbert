# ADR-023: Notification Preference Persistence -- JSON Files in Plugin Config Directory

## Status

Accepted

## Context

norbert-notif must persist user notification preferences (per-event channel toggles, thresholds, sounds, DND schedule, channel configurations). Preferences must survive app restarts and be immediately effective (no Save button). The data is structured (nested objects) and user-editable in nature.

**Quality attribute drivers**: Maintainability (simple format, debuggable), fault tolerance (graceful fallback on corruption), time-to-market.

**Constraints**: Existing plugin sandbox scopes config to `~/.norbert/plugins/{id}/` (ADR-014). No new SQLite tables (notification preferences are not relational data). Functional paradigm -- prefer immutable read/write over mutable ORM.

## Decision

Persist preferences as JSON files in `~/.norbert/plugins/norbert-notif/`:
- `preferences.json` -- event toggles, thresholds, sounds, global volume, DND config
- `channels.json` -- channel endpoint configurations (SMTP host/port, webhook URL)

Read/write via Tauri IPC commands (`read_notif_preferences`, `write_notif_preferences`). Schema version field enables future migration. Invalid/missing files fall back to defaults with user notification.

## Alternatives Considered

### SQLite tables (plugin-scoped)

- What: Store preferences in `plugin_norbert_notif_preferences` table using the existing db API.
- Expected impact: Consistent with event storage pattern. SQL queries for preferences.
- Why insufficient: Preferences are a single document (one user's settings), not relational data. SQL adds unnecessary complexity for what is fundamentally a key-value config file. Reading/writing a JSON file is simpler and more debuggable. Users can manually inspect/edit preferences if needed.

### Tauri plugin-store

- What: Use `tauri-plugin-store` for key-value persistence.
- Expected impact: Tauri-native persistence, automatic serialization.
- Why insufficient: Adds another Tauri plugin dependency for a simple JSON read/write. The plugin-store abstracts away the file format, making debugging harder. Direct JSON files are transparent and testable without Tauri runtime.

### In-memory with periodic flush

- What: Keep preferences in memory, flush to disk periodically or on app close.
- Expected impact: Faster reads, batched writes.
- Why insufficient: Risk of data loss on crash. Preferences changes are infrequent (user configures once, rarely changes), so the read/write overhead of file I/O is negligible. Immediate persistence is safer.

## Consequences

**Positive**:
- Human-readable files that users can inspect and back up
- Schema version enables non-breaking migration path
- No new database tables or SQL schemas
- Fallback to defaults on corruption -- never crashes
- Consistent with existing plugin config patterns (`.claude/plugins/{id}/`)

**Negative**:
- No atomic multi-file writes (preferences + channels are separate files)
- No query capability (must read entire file; acceptable given small file size)
- Must validate schema on read (schema version check + field validation)
