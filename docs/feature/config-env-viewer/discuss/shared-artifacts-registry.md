# Shared Artifacts Registry: config-env-viewer

## Artifacts

### settings_file_path

- **Source of Truth**: `~/.claude/settings.json` (resolved by Rust backend `collect_scope_config`)
- **Consumers**:
  - Environment tab source attribution (list header)
  - Detail panel "Source" field
  - Error indicator file path on read failure
- **Owner**: Rust backend (`read_claude_config` IPC command)
- **Integration Risk**: LOW -- path is already read for hooks/MCP/rules; env extraction adds no new file access
- **Validation**: Detail panel source path must match the file the backend actually read

### env_vars

- **Source of Truth**: `~/.claude/settings.json` -> `env` block (JSON object of string key-value pairs)
- **Consumers**:
  - Environment list panel (key-value display)
  - Environment detail panel (selected item)
  - Count badge in tab header
- **Owner**: `settingsParser.ts` (frontend domain layer) -- parses env block from raw JSON
- **Integration Risk**: MEDIUM -- new extraction logic must be added to `settingsParser.ts` and `SettingsParseResult` type
- **Validation**: Each env var key-value pair in the UI must match the raw JSON exactly; no transformation or normalization applied to values

### env_var_count

- **Source of Truth**: Derived from `env_vars` array length
- **Consumers**:
  - Tab header: "Environment Variables (N)"
  - Empty state toggle (count === 0)
- **Owner**: Frontend view component
- **Integration Risk**: LOW -- derived value, no separate data source
- **Validation**: Count in header must equal number of rows displayed

### env_scope

- **Source of Truth**: Determined by which `settings.json` was read (user: `~/.claude/settings.json`, project: `.claude/settings.json`)
- **Consumers**:
  - Scope tag in list header
  - Detail panel "Scope" field
- **Owner**: Rust backend (passes `scope` field with each `FileEntry`)
- **Integration Risk**: LOW -- scope attribution already works for hooks/MCP/rules from same file
- **Validation**: Scope tag in list header must match scope shown in detail panel

## Integration Checkpoints

### Checkpoint 1: Backend to Frontend Data Flow

The Rust backend reads `settings.json` and passes it as a `FileEntry` to the frontend. The frontend `settingsParser.ts` must extract the `env` block in addition to existing hooks/mcpServers/rules/plugins extraction. The `SettingsParseResult` type must be extended to include `envVars`.

**Validation**: After parsing, the env vars array length matches the number of top-level keys in the `env` JSON object.

### Checkpoint 2: Aggregator Inclusion

The `configAggregator.ts` must pass env vars from `ParsedSettings` through to `AggregatedConfig`. The `AggregatedConfig` type must be extended with an `envVars` field.

**Validation**: `AggregatedConfig.envVars` contains the same data as `SettingsParseResult.envVars`.

### Checkpoint 3: Tab Navigation Registration

The `CONFIG_SUB_TABS` const array in `types.ts` must include `"env"` as a new entry. The `ConfigViewerView.tsx` must map this tab to the correct label, icon, and list rendering.

**Validation**: Clicking the Environment tab renders the env var list with correct data.

### Checkpoint 4: Detail Panel Integration

Selecting an env var must produce a `SelectedConfigItem` with tag `"env"` that the app-level secondary zone can render.

**Validation**: Detail panel shows key, value, source, and scope matching the list selection.
