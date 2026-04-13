# ADR-047: MCP Server Multi-Source Discovery

## Status
Proposed

## Context
The MCP Servers tab in norbert-config only reads servers from `~/.claude/settings.json` and `.claude/settings.json`. On real systems, MCP servers live in three additional local files:
1. `~/.claude.json` (global config)
2. Project-root `.mcp.json` (project-scoped servers)
3. Plugin `.mcp.json` files (plugin-bundled servers)

All sources use the same `{ "mcpServers": { ... } }` schema. The current architecture has a single `settings: Option<FileEntry>` field in `ClaudeConfig`, which cannot carry multiple MCP-bearing files.

## Decision
Add a `mcp_files: Vec<FileEntry>` field to the Rust `ClaudeConfig` struct and corresponding `mcpFiles: readonly FileEntry[]` to the TypeScript `RawClaudeConfig` interface. The Rust backend reads the three new file sources using the existing `read_optional_file()` helper and populates `mcp_files`. The TypeScript aggregator extracts MCP servers from each entry using the existing `extractMcpServers()` function and merges them with servers from `settings.json`.

## Alternatives Considered

### A: Extend `settings` field to an array
- Pros: No new field on `ClaudeConfig`
- Cons: Breaking change to existing `settings: Option<FileEntry>` contract. Settings parsing extracts hooks, rules, plugins, env vars -- not just MCP servers. `.claude.json` and `.mcp.json` only contribute MCP servers; forcing them through the full settings parser would produce misleading empty results for other categories.
- Rejected: Semantic mismatch and breaking change outweigh simplicity.

### B: Read new files in TypeScript via Tauri fs plugin
- Pros: No Rust changes
- Cons: Breaks ADR-018 (single IPC command for config reading). Requires additional Tauri plugin permissions. Bypasses centralized error handling.
- Rejected: Architectural inconsistency.

### C: Create separate IPC command for MCP discovery
- Pros: Clean separation of concerns
- Cons: Two IPC round-trips for config data. Adds coordination complexity in frontend. Current `read_claude_config` already handles all config reading -- adding a parallel path is unnecessary.
- Rejected: Over-engineering for 3 additional file reads.

## Consequences
- Positive: All local MCP server sources visible in one view; reuses existing parsing; backward compatible (new field only)
- Positive: Source attribution via `filePath` + `source` enables the user to see where each server is defined
- Negative: `McpServerConfig` type gains a `source` field (minor type change, all consumers already display `filePath`)
- Negative: Duplicate server names across files are shown without deduplication (acceptable for read-only viewer)
