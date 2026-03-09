# ADR-007: Two-Phase Installation -- Plugin Framework over Surgical Merge

## Status

Accepted

## Context

Norbert's walking skeleton installs the desktop app and registers Claude Code hooks in a single step. On first launch, `run_settings_merge()` reads `~/.claude/settings.json`, creates a backup at `~/.norbert/settings.json.bak`, and surgically merges 6 async HTTP hook entries plus MCP server registration. This approach has three problems:

1. **Trust violation**: Modifying `~/.claude/settings.json` without explicit user consent is the highest-anxiety moment in the user journey (JTBD analysis). Users with custom MCP servers and permissions configurations feel their tooling has been tampered with.
2. **Maintenance burden**: The `SettingsMergeAdapter`, `SettingsManager` port, and 7+ pure domain functions for merge logic (~330 lines of Rust code, ~220 lines of tests) exist solely to manage JSON surgery that Claude's plugin framework now handles natively.
3. **No clean uninstall**: Removing Norbert requires manually editing `settings.json` to remove hook entries. The backup-based approach does not support reversible uninstall.

Claude Code now provides a plugin framework with `/plugin install` and `/plugin uninstall` commands that manage hook registration and MCP server configuration through an official, user-initiated channel.

## Decision

Split installation into two independent phases:

**Phase 1 -- App Install** (`npx github:pmvanev/norbert-cc`):
- Downloads binary to `~/.norbert/bin/`
- Launches system tray app with hook receiver sidecar on port 3748
- Does NOT read, modify, or back up `~/.claude/settings.json`
- Shows "No plugin connected" empty state with plugin install guidance

**Phase 2 -- Plugin Install** (`/plugin install norbert@pmvanev-plugins`):
- User explicitly runs this in Claude Code
- Claude's framework reads `plugin/.claude-plugin/plugin.json`, `plugin/hooks/hooks.json`, `plugin/.mcp.json`
- Claude registers 6 async HTTP hooks and 1 MCP server
- Fully reversible via `/plugin uninstall norbert`

Remove all settings merge code: `SettingsMergeAdapter`, `SettingsManager` port, `run_settings_merge()`, domain merge functions, backup logic, restart banner. Supersede ADR-006.

## Alternatives Considered

### Keep surgical merge but make it opt-in via flag or prompt

- Solves trust concern by requiring explicit consent
- Rejection: Maintains ~550 lines of merge code for an approach that duplicates what the plugin framework provides natively. Two code paths (manual merge + plugin framework) increases maintenance. Plugin framework is the officially supported integration channel.

### Remove merge, instruct users to manually add hooks to settings.json

- Zero code change beyond removing the merge call
- Rejection: Manual JSON editing is error-prone and was identified as the primary adoption barrier in JTBD analysis. No clean uninstall path. Does not leverage Claude's plugin framework.

### Keep merge as fallback when plugin framework is unavailable

- Graceful degradation for users on older Claude versions
- Rejection: Plugin framework is available now. Maintaining two registration paths adds complexity disproportionate to the edge case. Older Claude versions can be addressed if demand emerges.

## Consequences

**Positive**:
- App install never touches Claude configuration -- eliminates trust anxiety
- ~550 lines of Rust/test code removed (settings merge adapter, domain functions, port trait)
- Plugin uninstall cleanly removes all hooks and MCP registration
- Plugin files are static JSON -- no runtime merge logic, no edge cases
- Aligns with Claude's officially supported plugin distribution channel

**Negative**:
- Two-step install instead of one -- slight friction increase
- Requires Claude's plugin framework to be available (no fallback)
- Marketplace catalog entry in separate repo (`pmvanev/claude-marketplace`) must be created and maintained
- App must handle "no plugin connected" state gracefully (new UI state)

## Supersedes

ADR-006 (Settings Merge Strategy -- Surgical JSON Merge with Backup)
