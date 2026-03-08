# Shared Artifacts Registry: Walking Skeleton

## Registry

### version

- **Source of truth**: `package.json` `version` field
- **Consumers**:
  - Main window title ("NORBERT v0.1.0")
  - Tray icon tooltip
  - About dialog (future)
  - GitHub Release tag
- **Owner**: Build pipeline / package.json
- **Integration risk**: HIGH -- version mismatch between binary and package.json breaks user trust and update detection
- **Validation**: Main window version string must match `package.json` version at build time

### hook_port

- **Source of truth**: Norbert configuration constant (default: `3748`)
- **Consumers**:
  - HTTP server bind address
  - settings.json hook URL entries (`http://localhost:3748/hooks/{event_type}`)
  - Main window status display ("Port: 3748")
  - Error messages when port is unavailable
- **Owner**: Norbert core (hook receiver)
- **Integration risk**: HIGH -- port mismatch between settings.json URLs and actual server bind port means zero events received
- **Validation**: Port in settings.json hook URLs must match the port the HTTP server binds to. Single constant, never hardcoded separately.

### database_path

- **Source of truth**: Norbert configuration constant (`~/.norbert/norbert.db`)
- **Consumers**:
  - Database initialization on first launch
  - Hook event writer (HTTP server -> SQLite)
  - UI data queries (SQLite -> React)
  - Future: MCP server queries
- **Owner**: Norbert core (data layer)
- **Integration risk**: HIGH -- if the writer and reader use different paths, the UI shows no data despite events being stored
- **Validation**: Single constant for database path used by all consumers. Never constructed from parts separately.

### settings_json_path

- **Source of truth**: Claude Code convention (`~/.claude/settings.json`)
- **Consumers**:
  - Settings merge on first launch
  - Backup creation (source)
  - Future: Configuration Viewer reads this file
- **Owner**: Claude Code (external)
- **Integration risk**: MEDIUM -- path is defined by Claude Code, not Norbert. If Claude Code changes its config location, Norbert must be updated.
- **Validation**: Check path existence before merge. Handle missing directory gracefully.

### settings_backup_path

- **Source of truth**: Norbert configuration constant (`~/.norbert/settings.json.bak`)
- **Consumers**:
  - First-launch merge (backup destination)
  - Uninstall / rollback (restore source)
  - User manual recovery
- **Owner**: Norbert core (installer)
- **Integration risk**: MEDIUM -- if backup path changes, existing users cannot roll back from their current backup
- **Validation**: Backup file must be byte-identical to original settings.json at time of creation.

### hook_event_types

- **Source of truth**: Norbert hook configuration constant (list of event types)
- **Consumers**:
  - settings.json merge (which hooks to register)
  - HTTP server route handler (which paths to accept)
  - Database event type column
  - Future: Hook Health Monitor
- **Owner**: Norbert core
- **Integration risk**: HIGH -- mismatch between registered hooks in settings.json and accepted HTTP routes means events are registered but not received
- **Validation**: The list of event types registered in settings.json must exactly match the HTTP routes the server handles. Walking skeleton event types: `PreToolUse`, `PostToolUse`, `SubagentStop`, `Stop`, `SessionStart`, `UserPromptSubmit`.

### norbert_data_directory

- **Source of truth**: Norbert configuration constant (`~/.norbert/`)
- **Consumers**:
  - Database file location
  - Settings backup location
  - Binary location (bin/)
  - Future: plugin data, avatars, sounds, config-repo
- **Owner**: Norbert core
- **Integration risk**: MEDIUM -- all Norbert data lives here. Path must be consistent across all consumers.
- **Validation**: Single constant. All paths derived from this root.

## Integration Validation Checkpoints

### Checkpoint 1: Settings Merge Integrity

**What to validate**: After first-launch merge, settings.json must contain Norbert hook entries AND all pre-existing user configuration.

**How to validate**:
1. Parse original settings.json (from backup)
2. Parse merged settings.json
3. Verify all original keys still present with original values
4. Verify Norbert hook entries added
5. Verify hook URLs reference correct port

**Failure indicator**: User's existing Claude Code configuration (MCP servers, permissions, etc.) is missing or modified after Norbert install.

### Checkpoint 2: Database Schema Ready

**What to validate**: SQLite database exists with correct schema and pragmas.

**How to validate**:
1. File exists at database_path
2. `PRAGMA journal_mode` returns `wal`
3. `PRAGMA synchronous` returns `1` (NORMAL)
4. Tables `sessions` and `events` exist with expected columns

**Failure indicator**: Database file missing, wrong journal mode, or missing tables.

### Checkpoint 3: Event Pipeline End-to-End

**What to validate**: An HTTP POST to the hook endpoint results in a stored database record.

**How to validate**:
1. POST a valid hook payload to `localhost:{hook_port}/hooks/PreToolUse`
2. Verify HTTP 200 response
3. Query `SELECT * FROM events ORDER BY id DESC LIMIT 1`
4. Verify returned record matches posted payload

**Failure indicator**: HTTP error, no database record, or mismatched data.

### Checkpoint 4: UI Reads Stored Data

**What to validate**: The main window displays data that matches what is in the database.

**How to validate**:
1. Query session count from database
2. Query event count from database
3. Compare with values displayed in main window
4. Must match exactly

**Failure indicator**: UI shows stale data, zero counts despite stored records, or incorrect timestamps.
