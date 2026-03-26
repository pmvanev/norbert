# ADR-041: Environment Viewer as Frontend-Only Extension

## Status

Accepted

## Context

The config-env-viewer feature needs to display environment variables from `~/.claude/settings.json`. The Rust backend already reads the entire `settings.json` file and passes it as a `FileEntry` (path + content + scope) to the frontend. The frontend `settingsParser.ts` already parses this JSON to extract hooks, MCP servers, rules, and plugins.

The question is whether env var extraction should happen in the Rust backend or the TypeScript frontend.

## Decision

Extract environment variables in the frontend `settingsParser.ts`, following the same pattern used for hooks, MCP servers, rules, and plugins. No Rust backend changes required.

## Alternatives Considered

### Alternative 1: Rust Backend Extraction

- **What**: Add `env` field to the Rust `ClaudeConfig` struct; parse `env` block in `collect_scope_config`
- **Expected Impact**: Equivalent correctness
- **Why Insufficient**: Violates the existing pattern established in ADR-018 (single IPC command) and ADR-019 (frontend parsing). The backend sends raw file content; the frontend owns parsing. Adding backend parsing for one field creates inconsistency. Also requires Rust recompilation for a trivial JSON extraction.

### Alternative 2: Separate IPC Command for Env Vars

- **What**: New `read_env_vars` Tauri command that reads only the env block
- **Expected Impact**: Functional but wasteful
- **Why Insufficient**: Violates ADR-018 (single IPC command pattern). The file is already read by `read_claude_config`. A second IPC call reads the same file redundantly.

## Consequences

- **Positive**: Zero Rust changes; consistent with ADR-018/019 pattern; faster development cycle (TypeScript hot reload vs Rust recompilation)
- **Positive**: Existing `extractEnvVars` function in settingsParser.ts provides a proven extraction pattern to reuse
- **Negative**: None significant -- the env block is a simple key-value object, trivial to parse in TypeScript
