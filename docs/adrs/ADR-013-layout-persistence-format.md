# ADR-013: Layout Persistence Format -- JSON Files with Atomic Writes

## Status

Accepted

## Context

Phase 3 requires persisting layout state (zone assignments, divider position, floating panels, presets) across restarts. The persistence must: (1) survive crashes without corruption, (2) support per-window files, (3) use a schema that extends naturally when new zones are added.

**Quality attribute drivers**: Reliability (no layout corruption on crash), maintainability (zone-count-agnostic schema), usability (instant restore on launch).

**Constraints**: Solo developer. Local filesystem only. No database for config (SQLite reserved for event/session data).

## Decision

JSON files in `~/.norbert/` with atomic write (write to temp file, then rename). Zone assignments stored as a keyed map (`Map<zoneName, {viewId, pluginId}>`), never as positional fields.

**File layout**:
- `layout.json` -- primary window layout + global presets
- `layout-{window-id}.json` -- additional window layouts (no presets)
- `sidebar.json` -- sidebar icon order and visibility
- `plugins.json` -- plugin enabled/disabled state
- `windows.json` -- open window set for restart restore

**Write strategy**:
1. Serialize state to JSON
2. Write to `{filename}.tmp` in same directory
3. Rename `{filename}.tmp` to `{filename}` (atomic on all target platforms)
4. On read, if `{filename}` is missing/corrupt, check `{filename}.tmp` as fallback

**Debouncing**: Layout auto-saves debounce at 500ms to prevent excessive writes during rapid divider dragging.

**Schema versioning**: Each file includes a `version` field. On read, if version is older than current, apply migration transforms in sequence.

## Alternatives Considered

### SQLite for Layout Storage

- What: Store layout state in norbert.db alongside event data.
- Expected impact: Single storage location. Transactional writes.
- Why insufficient: Layout config is user preference data, conceptually separate from observability data. Mixing them complicates backup, reset, and plugin sandboxing. JSON files are human-readable, editable, and trivially copyable for sharing layout presets. SQLite's transactional guarantees are unnecessary for config that has a "Reset to Default" escape hatch.

### localStorage in Webview

- What: Use browser localStorage for layout persistence.
- Expected impact: Zero filesystem writes. Familiar web API.
- Why insufficient: localStorage is per-webview. Multi-window support requires shared state across webviews. localStorage is also opaque to users, not portable, and cleared when the webview cache is reset. Filesystem JSON files are inspectable, shareable, and survive webview cache clearing.

### TOML/YAML Instead of JSON

- What: Use TOML or YAML for more readable config files.
- Expected impact: Slightly better human readability for manual editing.
- Why insufficient: JSON is natively supported in both Rust (serde_json) and TypeScript (built-in). No additional parser dependency. Layout files are rarely hand-edited -- the UI manages them. The marginal readability benefit does not justify adding a parser dependency.

## Consequences

**Positive**:
- Atomic write prevents corruption on crash or power loss
- Keyed zone map extends naturally for future zones (no schema restructuring)
- Human-readable JSON allows manual inspection and sharing
- Debounced writes prevent I/O thrashing during drag operations
- Schema versioning enables future migration without data loss
- Separate files per window avoid contention

**Negative**:
- Multiple JSON files to manage (layout, sidebar, plugins, windows)
- JSON lacks comments (mitigated: config managed by UI, not hand-edited)
- Atomic rename is not truly atomic on all filesystems (mitigated: rename is as atomic as it gets on NTFS and ext4; corruption window is sub-millisecond)
