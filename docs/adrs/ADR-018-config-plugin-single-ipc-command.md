# ADR-018: Config Plugin Single IPC Command

## Status: Accepted

## Context

The norbert-config plugin needs to read `.claude/` directory contents (agents, commands, settings.json, CLAUDE.md) from both user-level (`~/.claude/`) and project-level (`./.claude/`) scopes. The frontend needs this data to populate 7 sub-tabs.

Two design options exist: one IPC command returning all data, or multiple granular commands (one per file type or directory).

## Decision

Use a single Rust IPC command `read_claude_config` that reads the entire `.claude/` directory tree and returns all contents in one response.

The command accepts a `scope` parameter ("user", "project", "both") and returns a `ClaudeConfig` struct containing raw file contents for agents, commands, settings.json, and CLAUDE.md files, plus a per-file errors array.

## Alternatives Considered

### Alternative 1: Multiple Granular IPC Commands
- `read_agents()`, `read_settings()`, `read_skills()`, `read_docs()` -- one per tab
- Pros: each tab fetches only what it needs; smaller response per call
- Cons: 4+ IPC round-trips on tab load; settings.json fetched multiple times by Hooks/MCP/Rules tabs unless coordinated; more boilerplate in Rust and TypeScript
- Rejected: `.claude/` is small (<50 files typically); round-trip overhead exceeds data size savings; coordination complexity for shared settings.json parse

### Alternative 2: Tauri fs Plugin (Frontend Direct Read)
- Use Tauri's `@tauri-apps/plugin-fs` to read files directly from TypeScript
- Pros: no Rust code needed; direct access from views
- Cons: requires additional Tauri plugin and capability permissions; breaks the pattern of Rust backend commands; harder to test; filesystem access scattered across view components
- Rejected: violates existing architecture pattern; adds unnecessary dependency; complicates permission model

## Consequences

- Positive: Single fetch on tab activation; simple frontend data flow; settings.json naturally shared across tabs; easy to test Rust command with temp directories
- Positive: No new Tauri plugins or capability changes needed
- Negative: Entire `.claude/` is read even if user only views one tab; acceptable for typical directory sizes (<50 files)
- Negative: Response payload slightly larger than needed per-tab; negligible for local IPC
