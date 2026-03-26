# Implementation Roadmap: config-env-viewer

## Metadata

- **Feature**: config-env-viewer
- **Paradigm**: Functional (algebraic types, pure functions, immutable data)
- **Estimated production files**: 6
- **Estimated steps**: 3
- **Step ratio**: 3/6 = 0.5 (well under 2.5 threshold)
- **User stories**: US-CEV-01, US-CEV-02

## Rejected Simple Alternatives

### Alternative 1: Configuration-only (no code)

- What: Display env vars in an existing tab (e.g., append to MCP Servers)
- Expected Impact: 50% -- shows data but violates tab-per-category pattern
- Why Insufficient: Breaks established UI pattern; env vars are not MCP servers. Users expect dedicated tab per category (8 existing tabs follow this).

### Alternative 2: Single-file change (settingsParser only)

- What: Extract env vars in parser but skip UI rendering
- Expected Impact: 0% -- data extracted but invisible to user
- Why Insufficient: The entire value proposition is visual verification.

## Phase 01: Domain Types and Parsing

### Step 01-01: EnvVarEntry type and settings parser extraction

Extend domain types with `EnvVarEntry` algebraic type and add top-level env block extraction to `settingsParser`.

**Files**: `domain/types.ts`, `domain/settingsParser.ts`

**Acceptance Criteria**:
- `EnvVarEntry` type includes key, value, scope, source, filePath (all required)
- `SettingsParseResult` parsed variant includes `envVars` field
- `CONFIG_SUB_TABS` includes `"env"` entry
- `SelectedConfigItem` union includes `{ tag: "env" }` variant
- Non-string env values filtered out; missing env block produces empty array

**Architectural Constraints**:
- Pure types and pure extraction functions only (no IO)
- Reuse extraction pattern from existing `extractEnvVars` for MCP servers

### Step 01-02: Aggregator env var passthrough

Extend `configAggregator` to thread env vars from settings parse result into `AggregatedConfig`.

**Files**: `domain/configAggregator.ts`

**Acceptance Criteria**:
- `AggregatedConfig` includes `envVars` field populated from settings parse
- `ParsedSettings` internal type includes env vars
- Env vars receive `filePath` annotation from `FileEntry.path` (existing pattern)

**Architectural Constraints**:
- Pure aggregation function; env vars are annotated with filePath like hooks/rules
- Follow `annotateFilePath` pattern for source attribution

## Phase 02: View Layer

### Step 02-01: Environment tab rendering with list and detail

Register Environment tab in `ConfigViewerView`, add env var list rendering in `ConfigListPanel`, add env var detail in `ConfigDetailPanel`.

**Files**: `views/ConfigViewerView.tsx`, `views/ConfigListPanel.tsx`, `views/ConfigDetailPanel.tsx`

**Acceptance Criteria**:
- Environment tab appears in sub-tab navigation with label and icon
- Tab displays env var key-value pairs sorted alphabetically
- Header shows count badge and scope tag
- Empty state shows guidance message when no env vars configured
- Clicking env var opens detail panel with key, value, source, scope

**Architectural Constraints**:
- Follow existing tab registration pattern (SUB_TAB_LABELS, SUB_TAB_ICONS)
- Follow existing list row rendering pattern (config-list-row class)
- Follow existing detail panel pattern (config-detail-content, config-card-section)
- Empty state uses existing EmptyState component
