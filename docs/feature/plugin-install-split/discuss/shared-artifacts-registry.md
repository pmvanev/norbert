# Shared Artifacts Registry: Plugin Install Split

## Artifacts

### hook_port

- **Source of truth**: `plugin/hooks/hooks.json` (hook URL port) and `src-tauri/src/domain.rs` (`HOOK_PORT` constant)
- **Consumers**: Hook URLs in hooks.json, sidecar startup, app window status display, install terminal output
- **Owner**: Norbert core (domain constant)
- **Integration risk**: HIGH -- port mismatch between app sidecar and plugin hooks means events never arrive
- **Validation**: All hook URLs in hooks.json must use port matching `HOOK_PORT` domain constant. Sidecar must bind to same port.

### plugin_install_command

- **Source of truth**: README.md
- **Consumers**: README Quick Start section, app empty state window, terminal output after install
- **Owner**: Documentation / UX
- **Integration risk**: HIGH -- wrong command means users cannot connect the plugin
- **Validation**: String `/plugin install norbert@pmvanev-plugins` must be identical in all three locations

### version

- **Source of truth**: `package.json` version field
- **Consumers**: Install terminal output, tray icon tooltip, app window title bar, plugin.json metadata
- **Owner**: Release process
- **Integration risk**: MEDIUM -- version mismatch confuses users but does not break functionality
- **Validation**: Version displayed in app must match package.json. Plugin.json version should match or be compatible.

### app_install_command

- **Source of truth**: README.md
- **Consumers**: README Quick Start section, documentation
- **Owner**: Documentation
- **Integration risk**: LOW -- only appears in documentation
- **Validation**: Must match actual package name in package.json

### install_path

- **Source of truth**: Postinstall script in package.json
- **Consumers**: Install terminal output, binary location for app startup
- **Owner**: Install infrastructure
- **Integration risk**: HIGH -- wrong path means binary not found
- **Validation**: Path `~/.norbert/bin/` must be consistent between postinstall script output and actual binary placement

### mcp_server_name

- **Source of truth**: `plugin/.mcp.json`
- **Consumers**: Plugin install output, MCP tool call prefix (`norbert__tool_name`)
- **Owner**: Plugin definition
- **Integration risk**: MEDIUM -- name mismatch breaks MCP tool attribution in Norbert's event processing
- **Validation**: Server name "norbert" in .mcp.json must match what the app expects when identifying MCP tool calls

### hook_event_names

- **Source of truth**: `plugin/hooks/hooks.json` (keys) and `src-tauri/src/domain.rs` (`HOOK_EVENT_NAMES` constant)
- **Consumers**: Plugin hooks.json entries, sidecar route handlers, domain event processing
- **Owner**: Norbert core (domain)
- **Integration risk**: HIGH -- missing hook in plugin means events for that type never arrive
- **Validation**: All 6 hook names in hooks.json must match HOOK_EVENT_NAMES in domain. Sidecar must have route handlers for all 6.

## Integration Checkpoints

### Checkpoint 1: App Install Isolation

Verify that `npx github:pmvanev/norbert-cc` does NOT:
- Read ~/.claude/settings.json
- Write ~/.claude/settings.json
- Create ~/.norbert/settings.json.bak
- Show "hooks registered" notification
- Show "restart Claude Code" banner

### Checkpoint 2: Plugin Structure Validity

Verify that `plugin/` directory contains:
- `.claude-plugin/plugin.json` with valid metadata
- `hooks/hooks.json` with exactly 6 entries, all async, all pointing to localhost:3748
- `.mcp.json` with norbert server definition (stdio, command: norbert-cc, args: ["mcp"])

### Checkpoint 3: Port Consistency

Verify port 3748 appears in:
- `plugin/hooks/hooks.json` (all 6 hook URLs)
- `src-tauri/src/domain.rs` (HOOK_PORT constant)
- Sidecar binary startup (bind address)
- App window status display

### Checkpoint 4: Post-Uninstall Data Integrity

Verify that after `/plugin uninstall norbert`:
- SQLite database at `~/.norbert/` is untouched
- All session records remain queryable
- All event records remain queryable
- App status reverts to "No plugin connected"
- No crash or error on next app window open
