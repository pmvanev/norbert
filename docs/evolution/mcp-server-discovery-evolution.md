# Evolution Record: mcp-server-discovery

## Feature
Extend Norbert's Configuration Viewer to discover MCP servers from all local Claude Code config sources.

## Problem
The MCP Servers tab only read from `~/.claude/settings.json`, which contained zero MCP servers. Real servers lived in `~/.claude.json`, project `.mcp.json`, and plugin `.mcp.json` files.

## Solution
Added `mcp_files: Vec<FileEntry>` to the Rust `ClaudeConfig` struct. Backend reads 3 new file sources using existing `read_optional_file()`. TypeScript domain aggregates servers from all sources with scope/source attribution. View layer displays source origin on each server card.

## Key Decisions
- **ADR-047**: New `mcp_files` field over extending `settings` to array or separate IPC command
- Anthropic cloud connectors (Gmail, Calendar, Miro) out of scope — not in local files
- No deduplication — read-only viewer shows all sources, user resolves precedence

## Metrics

| Metric | Value |
|--------|-------|
| Roadmap Steps | 3 |
| Production Files Modified | 7 |
| Test Files Created/Modified | 4 |
| Total Tests Added | 65 |
| Mutation Kill Rate | 86.67% |
| Commits | 6 (3 feature + 1 refactor + 1 review fix + 1 mutation tests) |

## Phases Completed
1. Roadmap creation + review (approved after 1 revision)
2. TDD execution (3 steps, all COMMIT/PASS)
3. L1-L4 refactoring (-38 lines, extracted shared components)
4. Adversarial review (approved round 2 after D2-D5 revision)
5. Mutation testing (86.67% kill rate, threshold 80%)
6. Integrity verification (all 3 steps verified)

## Files Changed

### Rust Backend
- `src-tauri/src/lib.rs` — ClaudeConfig.mcp_files, read_claude_config extensions

### TypeScript Domain
- `src/plugins/norbert-config/domain/types.ts` — McpServerConfig.source field
- `src/plugins/norbert-config/domain/configAggregator.ts` — aggregateMcpFiles(), RawClaudeConfig.mcpFiles
- `src/plugins/norbert-config/domain/settingsParser.ts` — source attribution, extractEnvVars export

### React Views
- `src/plugins/norbert-config/views/McpTab.tsx` — source display, updated empty state
- `src/plugins/norbert-config/views/ConfigDetailPanel.tsx` — source in detail view
- `src/plugins/norbert-config/views/ConfigListPanel.tsx` — source in list view
- `src/plugins/norbert-config/views/shared.tsx` — extracted MaskedEnvVarRow (L3 refactoring)
