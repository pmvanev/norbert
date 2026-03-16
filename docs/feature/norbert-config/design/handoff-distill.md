# DISTILL Wave Handoff: norbert-config

## Handoff Status: APPROVED

## Package Contents

| Artifact | Path |
|----------|------|
| Architecture Design | `docs/feature/norbert-config/design/architecture-design.md` |
| Component Boundaries | `docs/feature/norbert-config/design/component-boundaries.md` |
| Data Models | `docs/feature/norbert-config/design/data-models.md` |
| ADR-018 | `docs/adrs/ADR-018-config-plugin-single-ipc-command.md` |
| ADR-019 | `docs/adrs/ADR-019-config-plugin-frontend-parsing.md` |
| ADR-020 | `docs/adrs/ADR-020-config-plugin-markdown-rendering.md` |
| DISCUSS Artifacts | `docs/feature/norbert-config/discuss/` (7 user stories, JTBD, journey, Gherkin) |

## Architecture Summary

- **Pattern**: Modular monolith, ports-and-adapters, following existing plugin architecture
- **Paradigm**: Functional programming (pure domain functions, immutable types, discriminated unions)
- **Backend**: 1 new Rust IPC command (`read_claude_config`) reads `.claude/` directories
- **Frontend**: New plugin at `src/plugins/norbert-config/` with domain/ and views/ layers
- **New dependency**: `react-markdown` + `remark-gfm` (MIT, for Docs tab)

## Estimated Production Files: 18

| Layer | Count | Files |
|-------|-------|-------|
| Rust backend | 1 | lib.rs (additions) |
| Plugin entry | 2 | manifest.ts, index.ts |
| Domain | 5 | types.ts, agentParser.ts, settingsParser.ts, skillParser.ts, configAggregator.ts |
| Views | 10 | ConfigViewerView.tsx, AgentsTab.tsx, HooksTab.tsx, McpTab.tsx, SkillsTab.tsx, RulesTab.tsx, PluginsTab.tsx, DocsTab.tsx, EmptyState.tsx, ErrorIndicator.tsx |

## Story-to-Component Mapping

| Story | Components Involved |
|-------|-------------------|
| US-001 | manifest.ts, index.ts, ConfigViewerView.tsx, App.tsx integration |
| US-007 | Rust read_claude_config command, types.ts |
| US-002 | agentParser.ts, AgentsTab.tsx |
| US-003 | settingsParser.ts, HooksTab.tsx |
| US-004 | settingsParser.ts, McpTab.tsx |
| US-005 | skillParser.ts, settingsParser.ts, SkillsTab.tsx, RulesTab.tsx, PluginsTab.tsx |
| US-006 | DocsTab.tsx (react-markdown) |

## Key Architectural Constraints for DISTILL

1. **Single IPC command** (ADR-018): One Rust command returns all `.claude/` contents
2. **Frontend parsing** (ADR-019): Rust returns raw strings; TypeScript domain parses
3. **Pure domain functions**: All parsers take string input, return immutable typed output
4. **Discriminated unions**: Parse results use `{ tag: "parsed", ... } | { tag: "error", ... }` pattern
5. **Per-file error isolation**: One unreadable file does not break other files or tabs
6. **No caching**: Fresh read on each Config tab activation
7. **Env var masking**: MCP env vars masked by default in views; no console logging
8. **ConfigScope annotation**: Every entity carries `"user" | "project"` scope

## Implementation Order (Suggested)

Based on story dependencies (US-001 -> US-007 -> US-002..006):

1. Types (domain/types.ts) -- all algebraic data types first (FP: types-first)
2. Rust command + plugin skeleton (US-001 + US-007)
3. Parsers + tabs in parallel (US-002 through US-006)

## Spike Dependency

SP-001 (half-day): Determine Claude Code plugin storage format before implementing Plugins sub-tab in US-005. If format is undiscoverable, the Plugins tab shows a "format unknown" message with guidance.

## Non-Functional Requirements

- All tabs load within 500ms for typical `.claude/` directories
- Empty tabs show explanatory empty state (what the category is, where to add items)
- Keyboard navigation across all tabs and cards
- 4.5:1 contrast ratios for accessibility
