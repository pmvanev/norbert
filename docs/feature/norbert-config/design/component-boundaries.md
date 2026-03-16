# Component Boundaries: norbert-config

## Overview

norbert-config consists of 3 bounded components: Rust Backend Command, TypeScript Domain, and React Views. Dependencies flow inward (views -> domain -> backend via IPC).

## Component 1: Rust Backend Command

**Boundary**: `src-tauri/src/lib.rs` (new `read_claude_config` function)

**Responsibility**: Read raw file contents from `.claude/` directories. Return structured data with per-file error isolation.

**Inputs**: `scope: String` ("user" | "project" | "both")

**Outputs**: `ClaudeConfig` struct (see data-models.md)

**Rules**:
- Missing directories produce empty lists, not errors
- Per-file read failures populate `errors` array; other files still returned
- No parsing of file contents -- returns raw strings
- Resolves `~/.claude/` via `dirs::home_dir()`
- Resolves `./.claude/` via Tauri window URL or `std::env::current_dir()`
- UTF-8 decoding errors produce a ReadError for that file

**Does NOT**:
- Parse Markdown, JSON, or YAML
- Cache anything
- Write to filesystem
- Access database

## Component 2: TypeScript Domain Layer

**Boundary**: `src/plugins/norbert-config/domain/`

**Responsibility**: Transform raw file contents into typed domain objects. All functions are pure (no IO, no side effects).

### Sub-components

#### types.ts
- Algebraic data types for all config entities
- Discriminated unions for parse results
- See data-models.md for full type definitions

#### agentParser.ts
- Input: raw Markdown string from agent file
- Output: `AgentDefinition` (name, model, tools, description, systemPrompt)
- Handles: YAML frontmatter extraction, missing fields -> defaults
- Pure function, no IO

#### settingsParser.ts
- Input: raw JSON string from settings.json
- Output: discriminated union -- `SettingsParseResult`
  - `{ tag: "parsed", hooks, mcpServers, rules, plugins }` on success
  - `{ tag: "error", message, location }` on failure
- Handles: missing sections -> empty arrays/objects
- Pure function, no IO

#### skillParser.ts
- Input: raw Markdown string from skill file
- Output: `SkillDefinition` (name, description)
- Extracts description from first heading or first paragraph
- Pure function, no IO

#### configAggregator.ts
- Input: two `ClaudeConfig` responses (user-level, project-level) or a single "both" response
- Output: `AggregatedConfig` with source annotations per entity
- Annotates each entity with its source scope ("user" | "project")
- For settings.json: merges user + project, marks override precedence
- Pure function, no IO

### Testing Contract
- Every parser function testable with string inputs, no filesystem needed
- Property: `parse(serialize(x)) roundtrips` where applicable
- Edge cases: empty strings, missing fields, malformed input

## Component 3: React View Layer

**Boundary**: `src/plugins/norbert-config/views/`

**Responsibility**: Render parsed config data. Manage sub-tab state. Handle user interactions (expand/collapse, mask/reveal).

### Sub-components

#### ConfigViewerView.tsx (Primary View)
- Registered as plugin's primary view via `api.ui.registerView()`
- Contains sub-tab navigation (7 tabs)
- On mount: calls `invoke("read_claude_config")` and parses result
- Passes parsed data to active sub-tab component
- Manages selected sub-tab state (default: Agents)

#### AgentsTab.tsx
- Input: `AgentDefinition[]`
- Renders: card per agent with name, model, tool count, description preview
- Interaction: click to expand full details, progressive disclosure for system prompt

#### HooksTab.tsx
- Input: `HookConfig[]`
- Renders: card per hook with event type, command, matcher tags

#### McpTab.tsx
- Input: `McpServerConfig[]`
- Renders: card per server with name, type, command, args, env vars
- Interaction: click-to-reveal/mask env var values
- Constraint: never log revealed values to console

#### SkillsTab.tsx
- Input: `SkillDefinition[]`
- Renders: list entries with name and description

#### RulesTab.tsx
- Input: `RuleEntry[]`
- Renders: list entries with rule text and source annotation

#### PluginsTab.tsx
- Input: `PluginInfo[]`
- Renders: list entries with name and version

#### DocsTab.tsx
- Input: `DocFile[]`
- Renders: panel per file with source path header and rendered Markdown
- Uses react-markdown for rendering

#### EmptyState.tsx (Shared)
- Input: `category: string`, `description: string`
- Renders: explanatory message for empty tabs

#### ErrorIndicator.tsx (Shared)
- Input: `filePath: string`, `errorMessage: string`
- Renders: inline error for unreadable files

### View Rules
- All views are stateless (data passed as props)
- Exception: ConfigViewerView manages sub-tab selection and data fetch state
- Exception: McpTab manages mask/reveal toggle state per env var
- No direct filesystem access from views

## Integration Points

### With Norbert Core (App.tsx)

1. Plugin imported and added to `loadPlugins()` array
2. `ConfigViewerWrapper` FC registered in viewRegistry (key: "config-viewer")
3. Wrapper invokes `read_claude_config` and passes data to `ConfigViewerView`

### With Plugin System

- manifest.ts declares `id: "norbert-config"`, `dependencies: {}`
- index.ts registers 1 primary view ("config-viewer") + 1 sidebar tab ("config")
- Tab order: 2 (after Sessions=0, Usage=1)
- No hook registrations (no live event processing)

### With Rust Backend

- Single IPC command: `read_claude_config`
- Registered in `tauri::generate_handler![]` alongside existing commands
- No new Tauri plugins or capabilities needed

## File Inventory (Estimated)

| Layer | Files | Production Files |
|-------|-------|-----------------|
| Rust backend | 1 (additions to lib.rs) | 1 |
| Plugin entry | 2 (manifest.ts, index.ts) | 2 |
| Domain | 5 (types, 3 parsers, aggregator) | 5 |
| Views | 10 (viewer, 7 tabs, empty state, error) | 10 |
| **Total** | **18** | **18** |
