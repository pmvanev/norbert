# Data Models: norbert-config

## Rust Backend Types

### ClaudeConfig (IPC response)

```
ClaudeConfig {
    agents: Vec<FileEntry>       -- .md files from agents/
    commands: Vec<FileEntry>     -- .md files from commands/
    settings: Option<FileEntry>  -- settings.json (null if missing)
    claude_md_files: Vec<FileEntry> -- CLAUDE.md files found
    errors: Vec<ReadError>       -- per-file read failures
}

FileEntry {
    path: String    -- absolute filesystem path
    content: String -- raw file content (UTF-8)
    scope: String   -- "user" | "project"
}

ReadError {
    path: String    -- file that failed
    error: String   -- error description
    scope: String   -- "user" | "project"
}
```

## TypeScript Domain Types

### Core Result Types

```
ConfigReadResult
  | { tag: "loaded", config: AggregatedConfig }
  | { tag: "error", message: string }

SettingsParseResult
  | { tag: "parsed", hooks: HookConfig[], mcpServers: McpServerConfig[], rules: RuleEntry[], plugins: PluginInfo[] }
  | { tag: "error", message: string }

AgentParseResult
  | { tag: "parsed", agent: AgentDefinition }
  | { tag: "error", filePath: string, message: string }
```

### Entity Types

```
AgentDefinition {
    name: string             -- derived from filename
    model: string            -- from frontmatter or "default"
    toolCount: number        -- count of declared tools
    tools: string[]          -- tool names
    description: string      -- first line/paragraph of content
    systemPrompt: string     -- full body content
    filePath: string         -- source file path
    scope: ConfigScope       -- "user" | "project"
}

HookConfig {
    event: string            -- e.g. "PreToolUse", "PostToolUse"
    command: string          -- command path
    matchers: string[]       -- matcher patterns (empty if none)
    rawConfig: unknown       -- original JSON for full display
    filePath: string         -- settings.json path
    scope: ConfigScope
}

McpServerConfig {
    name: string             -- server name (JSON key)
    type: string             -- "stdio" | "sse"
    command: string          -- executable command
    args: string[]           -- command arguments
    env: EnvVar[]            -- environment variables
    filePath: string
    scope: ConfigScope
    warnings: string[]       -- e.g. "Missing required field: command"
}

EnvVar {
    key: string
    value: string
}

SkillDefinition {
    name: string             -- derived from filename
    description: string      -- first heading or paragraph
    filePath: string
    scope: ConfigScope
}

RuleEntry {
    text: string             -- rule content
    source: string           -- "settings.json" | "CLAUDE.md"
    filePath: string         -- full path to source file
    scope: ConfigScope
}

PluginInfo {
    name: string
    version: string
    filePath: string
    scope: ConfigScope
}

DocFile {
    filePath: string         -- e.g. "./CLAUDE.md"
    content: string          -- raw Markdown content
    scope: ConfigScope
}
```

### Aggregation Types

```
ConfigScope = "user" | "project"

AggregatedConfig {
    agents: AgentParseResult[]
    hooks: HookConfig[]            -- all hooks, scope indicated per entry
    mcpServers: McpServerConfig[]
    skills: SkillDefinition[]
    rules: RuleEntry[]
    plugins: PluginInfo[]
    docs: DocFile[]
    errors: ReadErrorInfo[]
}

ReadErrorInfo {
    path: string
    error: string
    scope: ConfigScope
}
```

### Sub-Tab Enum

```
CONFIG_SUB_TABS = ["agents", "hooks", "skills", "rules", "mcp", "plugins", "docs"] as const

ConfigSubTab = typeof CONFIG_SUB_TABS[number]
```

## Data Flow

```
Rust: read ~/.claude/ + ./.claude/
  -> ClaudeConfig { agents[], commands[], settings?, claude_md_files[], errors[] }

TypeScript: parse raw contents
  -> agents[].content -> agentParser -> AgentDefinition[]
  -> settings.content -> settingsParser -> { hooks[], mcpServers[], rules[], plugins[] }
  -> commands[].content -> skillParser -> SkillDefinition[]
  -> claude_md_files -> DocFile[] (no parsing needed, pass through)

React: render parsed data
  -> ConfigViewerView holds AggregatedConfig in state
  -> Active sub-tab receives its slice of data as props
```

## Type Design Principles

- All interfaces are `readonly` (immutable data throughout)
- Discriminated unions for parse results (tag-based, not exception-based)
- `ConfigScope` annotates every entity for source attribution
- `const` arrays for known values, type unions derived from arrays (following existing patterns in domain/theme.ts and plugins/types.ts)
