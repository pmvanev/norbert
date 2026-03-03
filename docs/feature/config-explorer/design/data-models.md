# Data Models: Config Explorer

**Feature ID**: config-explorer
**Date**: 2026-03-03

---

## 1. Config Domain Types (config-explorer package)

All types are readonly (immutable domain). Discriminated unions used where polymorphism is needed. These define the WHAT -- the crafter determines exact TypeScript syntax, file organization, and naming.

### 1.1 Scope (Discriminated Union)

| Variant | Description | Color |
|---------|-------------|-------|
| `user` | `~/.claude/` directory | Blue (#3B82F6) |
| `project` | `.claude/` directory and project root | Green (#22C55E) |
| `local` | `*.local.*` files (gitignored) | Yellow (#EAB308) |
| `plugin` | Installed plugin directories | Purple (#A855F7) |
| `managed` | Platform-specific enterprise policy paths | Red (#EF4444) |

### 1.2 Subsystem (Discriminated Union)

| Variant | File Patterns | Description |
|---------|--------------|-------------|
| `memory` | `CLAUDE.md`, `CLAUDE.local.md`, `MEMORY.md` | Instruction and memory files |
| `settings` | `settings.json`, `settings.local.json` | JSON configuration files |
| `rules` | `.claude/rules/*.md`, `~/.claude/rules/*.md` | Rule files with optional path scoping |
| `skills` | `skills/*/SKILL.md` | Skill definition directories |
| `agents` | `agents/*.md` | Subagent definition files |
| `hooks` | Hook entries in settings.json, hooks.json | Lifecycle event handlers |
| `plugins` | `.claude-plugin/plugin.json` manifest + components | Plugin bundles |
| `mcp` | `.mcp.json`, `.claude.json` | MCP server configurations |

### 1.3 ConfigNode

Represents a single configuration element discovered on the filesystem.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier (scope + relative path hash) |
| name | string | Display name (filename or element name from frontmatter) |
| scope | ConfigScope | Which scope level this file belongs to |
| subsystem | ConfigSubsystem | Which subsystem this file belongs to |
| nodeType | NodeType | Visual shape: agent, skill, rule, hook, mcp, memory, settings, plugin |
| filePath | string | Absolute file path on disk |
| relativePath | string | Path relative to scope root (for display) |
| content | string | Raw file content |
| parsedContent | ParsedContent | Structured parsed content (frontmatter + body) |
| loadBehavior | LoadBehavior | `always` or `on-demand` (for subdirectory CLAUDE.md, path-scoped rules) |
| error | ParseError or null | Parse error if file is malformed |

### 1.4 NodeType (Discriminated Union)

| Variant | Shape (Galaxy) | Icon |
|---------|---------------|------|
| `agent` | Hexagon | Agent icon |
| `skill` | Circle | Skill icon |
| `rule` | Square | Rule icon |
| `hook` | Diamond | Hook icon |
| `mcp` | Pentagon | MCP icon |
| `memory` | Rectangle | Memory icon |
| `settings` | Rounded rectangle | Settings icon |
| `plugin` | Star | Plugin icon |

### 1.5 ConfigEdge

Represents a relationship between two configuration elements.

| Field | Type | Description |
|-------|------|-------------|
| sourceId | string | ConfigNode id of the referencing element |
| targetId | string | ConfigNode id of the referenced element |
| edgeType | EdgeType | Type of relationship |
| label | string | Human-readable label for the edge |

### 1.6 EdgeType (Discriminated Union)

| Variant | Meaning | Source | Target |
|---------|---------|--------|--------|
| `agent-references-skill` | Agent frontmatter `skills:` field | Agent | Skill |
| `plugin-contains-component` | Plugin manifest bundles component | Plugin | Any |
| `agent-defines-hook` | Agent frontmatter `hooks:` field | Agent | Hook |
| `rule-scoped-to-path` | Rule frontmatter `paths:` field | Rule | Path pattern |
| `skill-allows-tool` | Skill frontmatter `allowed-tools:` field | Skill | Tool |
| `skill-uses-agent` | Skill frontmatter `agent:` field | Skill | Agent |
| `naming-conflict` | Same name at different scopes | Higher scope | Lower scope |

### 1.7 ParsedContent (Discriminated Union by format)

| Variant | Fields | Source Files |
|---------|--------|-------------|
| `json` | parsedData (object), keys (string[]) | settings.json, .mcp.json, plugin.json |
| `markdown-with-frontmatter` | frontmatter (object), body (string), frontmatterFields (FrontmatterField[]) | rules, skills, agents |
| `markdown` | body (string) | CLAUDE.md, CLAUDE.local.md |
| `unparseable` | error (string) | Malformed files |

### 1.8 FrontmatterField

Extracted from YAML frontmatter for annotation and cross-referencing.

| Field | Type | Description |
|-------|------|-------------|
| key | string | Field name (e.g., `paths`, `skills`, `tools`, `model`) |
| value | unknown | Parsed value |
| annotation | string | Human-readable explanation (e.g., "Applies to files matching: src/api/**/*.ts") |

### 1.9 PrecedenceChain

Per-subsystem precedence resolution result.

| Field | Type | Description |
|-------|------|-------------|
| subsystem | ConfigSubsystem | Which subsystem this chain resolves |
| entries | PrecedenceEntry[] | Ordered from highest (managed) to lowest (user/plugin) |
| resolutionType | ResolutionType | `override` (settings, hooks, agents) or `additive` (CLAUDE.md) or `merge` (array settings) |

### 1.10 PrecedenceEntry

One scope level in the precedence chain.

| Field | Type | Description |
|-------|------|-------------|
| scope | ConfigScope | Scope level |
| status | PrecedenceStatus | `active`, `overridden`, `empty`, `access-denied` |
| nodes | ConfigNode[] | Files at this scope for this subsystem |
| overrideReason | string or null | Why this entry is overridden (e.g., "Overridden by LOCAL scope") |
| mergeContribution | string[] or null | For array merge: values contributed by this scope |

### 1.11 PrecedenceStatus

| Variant | Display | Meaning |
|---------|---------|---------|
| `active` | ACTIVE marker | This scope's value is the effective winner |
| `overridden` | OVERRIDDEN + strikethrough | Suppressed by a higher-precedence scope |
| `empty` | (no config at scope) | No configuration file exists at this scope |
| `access-denied` | "Access denied" message | Managed scope not readable (permissions) |

### 1.12 ConfigModel

The complete configuration model assembled from all parsing results.

| Field | Type | Description |
|-------|------|-------------|
| nodes | ConfigNode[] | All discovered configuration elements |
| edges | ConfigEdge[] | All relationships between elements |
| precedenceChains | Record of subsystem to PrecedenceChain | Pre-resolved precedence per subsystem |
| scopeSummary | Record of scope to number | File count per scope |
| subsystemSummary | Record of subsystem to number | File count per subsystem |
| totalFiles | number | Total configuration files discovered |
| conflicts | NamingConflict[] | Detected naming conflicts |
| scanTimestamp | string (ISO 8601) | When the scan was performed |

### 1.13 MatchResult

Result of testing a file path against a glob pattern.

| Field | Type | Description |
|-------|------|-------------|
| rule | ConfigNode | The rule being tested |
| status | `match` or `no-match` or `unconditional` | Match result |
| pattern | string or null | The glob pattern tested (null for unconditional) |
| reason | string | Human-readable explanation |

### 1.14 PathTestResult

Complete result for a path rule tester query.

| Field | Type | Description |
|-------|------|-------------|
| testPath | string | The file path being tested |
| matches | MatchResult[] | Rules that match |
| nonMatches | MatchResult[] | Rules that do not match |
| unconditional | MatchResult[] | Rules with no path restriction |

### 1.15 SearchResult

| Field | Type | Description |
|-------|------|-------------|
| node | ConfigNode | The file containing the match |
| matchingLine | string | The line containing the search term |
| lineNumber | number | Line number within the file |
| context | string | Surrounding context (line before + after) |

### 1.16 NamingConflict

| Field | Type | Description |
|-------|------|-------------|
| name | string | The conflicting element name |
| nodeType | NodeType | Type of element (agent, skill, etc.) |
| higherScope | ConfigNode | The node at higher precedence scope (winner) |
| lowerScope | ConfigNode | The node at lower precedence scope (loser) |
| resolution | string | How the conflict is resolved (e.g., "project scope wins") |

### 1.17 FileTree

Directory tree structure for Atlas view.

| Field | Type | Description |
|-------|------|-------------|
| name | string | Directory or file name |
| path | string | Full path |
| scope | ConfigScope | Scope coloring |
| subsystem | ConfigSubsystem or null | Subsystem classification (null for directories) |
| type | `file` or `directory` or `missing` | Entry type |
| children | FileTree[] | Child entries (for directories) |
| node | ConfigNode or null | Associated config node (for files) |
| tooltip | string or null | Description tooltip (for missing/empty directories) |

---

## 2. API Response Contracts

### 2.1 GET /api/config

Returns the full `ConfigModel` as JSON. Used by Galaxy, Mind Map, and landing page.

```
Response: 200 OK
Body: ConfigModel (JSON serialized)
```

### 2.2 GET /api/config/tree

Returns `FileTree` roots for Atlas view.

```
Response: 200 OK
Body: {
  userScope: FileTree       // ~/.claude/ tree
  projectScope: FileTree    // .claude/ tree
  pluginScope: FileTree[]   // Plugin directory trees
  managedScope: FileTree | { accessDenied: true }
}
```

### 2.3 GET /api/config/precedence/:subsystem

Returns `PrecedenceChain` for the specified subsystem.

```
Path param: subsystem (memory | settings | rules | skills | agents | hooks | mcp)
Response: 200 OK
Body: PrecedenceChain (JSON serialized)
```

### 2.4 GET /api/config/search?q=

Returns search results across all config files.

```
Query param: q (search string, min 2 characters)
Response: 200 OK
Body: SearchResult[] (JSON serialized)
```

### 2.5 GET /api/config/test-path?path=

Returns path rule matching results.

```
Query param: path (file path relative to project root)
Response: 200 OK
Body: PathTestResult (JSON serialized)
```

---

## 3. Business Rules Encoded in Types

### BR-01: Precedence Resolution Order

Encoded in `PrecedenceChain` type and `resolvePrecedence` function:

| Subsystem | Resolution Type | Order (highest first) |
|-----------|----------------|----------------------|
| settings | override | managed > CLI > local > project > user |
| memory (CLAUDE.md) | additive | All loaded; managed > local > project > subdirectory (on-demand) > user |
| rules | override (by scope) | project > user. Path-scoped rules: on-demand. |
| skills | override (by priority) | enterprise > personal > project > plugin |
| agents | override (by priority) | CLI > project > user > plugin |
| hooks | override (by scope) | Same as settings |
| mcp | merge | User + project + plugin MCP servers merged |

### BR-02: Plugin Namespacing

Encoded in `ConfigNode.name` for plugin skills:
- Plugin skills: `pluginName:skillName` (namespaced)
- Plugin agents: `agentName` (NOT namespaced -- potential naming conflicts)
- `NamingConflict` type captures conflicts between non-namespaced plugin agents and user/project agents

### BR-03: On-Demand Items

Encoded in `ConfigNode.loadBehavior`:
- `always`: Loaded at session start (most files)
- `on-demand`: Loaded during session when triggered (subdirectory CLAUDE.md, path-scoped rules, skill content on invocation)

### BR-04: Array Merge Settings

Encoded in `PrecedenceEntry.mergeContribution`:
- `permissions.allow`: Concatenate + deduplicate across all scopes
- `permissions.deny`: Concatenate + deduplicate across all scopes
- Each merged value tagged with source scope for display

---

## 4. No SQLite Schema Changes

Config Explorer does NOT use SQLite. It reads configuration files from the filesystem and serves them via API. No new tables, no schema migrations, no storage port extensions.

The existing `@norbert/storage` package is unaffected.

---

## 5. Data Lifecycle

### 5.1 Read Path

1. User opens Config Explorer tab in dashboard
2. Dashboard fetches `GET /api/config` (or specific sub-endpoint)
3. Server's config file reader scans `~/.claude/`, `.claude/`, managed paths, plugin cache
4. For each file: classify by subsystem and scope, parse content, extract frontmatter
5. Assemble full ConfigModel (nodes, edges, precedence chains, conflicts)
6. Return as JSON response
7. Dashboard caches in Svelte store for cross-view navigation

### 5.2 Refresh

Manual refresh only in v1. User clicks refresh button -> dashboard re-fetches from API -> server re-scans filesystem.

### 5.3 No Write Path

Config Explorer is read-only. It never modifies, creates, or deletes configuration files. This is enforced at the architecture level (no write operations in the API or file reader).
