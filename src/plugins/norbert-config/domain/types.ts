/// Domain algebraic types for the norbert-config plugin.
///
/// Pure type definitions and const arrays -- no runtime side effects,
/// no IO imports. All interfaces are readonly (immutable data throughout).
///
/// Discriminated unions use `tag` field for type narrowing:
/// - ConfigReadResult: 'loaded' | 'error'
/// - SettingsParseResult: 'parsed' | 'error'
/// - AgentParseResult: 'parsed' | 'error'

// ---------------------------------------------------------------------------
// ConfigScope -- source attribution for every config entity
// ---------------------------------------------------------------------------

export type ConfigScope = "user" | "project" | "plugin";

// ---------------------------------------------------------------------------
// EnvVar -- key-value pair for MCP server environment
// ---------------------------------------------------------------------------

export interface EnvVar {
  readonly key: string;
  readonly value: string;
}

// ---------------------------------------------------------------------------
// EnvVarEntry -- top-level environment variable with scope attribution
// ---------------------------------------------------------------------------

export interface EnvVarEntry {
  readonly key: string;
  readonly value: string;
  readonly scope: ConfigScope;
  readonly source: string;
  readonly filePath: string;
}

// ---------------------------------------------------------------------------
// AgentDefinition -- parsed agent metadata from .md file
// ---------------------------------------------------------------------------

export interface AgentDefinition {
  readonly name: string;
  readonly persona: string;
  readonly role: string;
  readonly model: string;
  readonly toolCount: number;
  readonly tools: readonly string[];
  readonly description: string;
  readonly systemPrompt: string;
  readonly filePath: string;
  readonly scope: ConfigScope;
  readonly source: string;
}

// ---------------------------------------------------------------------------
// HookConfig -- a single hook binding from settings.json
// ---------------------------------------------------------------------------

export interface HookConfig {
  readonly event: string;
  readonly command: string;
  readonly matchers: readonly string[];
  readonly rawConfig: unknown;
  readonly filePath: string;
  readonly scope: ConfigScope;
  readonly source: string;
}

// ---------------------------------------------------------------------------
// McpServerConfig -- MCP server connection details
// ---------------------------------------------------------------------------

export interface McpServerConfig {
  readonly name: string;
  readonly type: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env: readonly EnvVar[];
  readonly filePath: string;
  readonly scope: ConfigScope;
  readonly source: string;
  readonly warnings: readonly string[];
}

// ---------------------------------------------------------------------------
// CommandDefinition -- parsed command metadata from .claude/commands/*.md
// ---------------------------------------------------------------------------

export interface CommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly content: string;
  readonly filePath: string;
  readonly scope: ConfigScope;
  readonly source: string;
}

// ---------------------------------------------------------------------------
// SkillDefinition -- parsed skill metadata from plugin skills/
// ---------------------------------------------------------------------------

export interface SkillDefinition {
  readonly name: string;
  readonly description: string;
  readonly content: string;
  readonly filePath: string;
  readonly scope: ConfigScope;
  readonly source: string;
}

// ---------------------------------------------------------------------------
// RuleEntry -- a single rule from settings.json or CLAUDE.md
// ---------------------------------------------------------------------------

export interface RuleEntry {
  readonly text: string;
  readonly source: string;
  readonly filePath: string;
  readonly scope: ConfigScope;
}

// ---------------------------------------------------------------------------
// PluginInfo -- installed plugin metadata
// ---------------------------------------------------------------------------

export interface PluginInfo {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly homepage: string;
  readonly installPath: string;
  readonly readme: string;
  readonly installedAt: string;
  readonly filePath: string;
  readonly scope: ConfigScope;
}

// ---------------------------------------------------------------------------
// ReadErrorInfo -- per-file read failure
// ---------------------------------------------------------------------------

export interface ReadErrorInfo {
  readonly path: string;
  readonly error: string;
  readonly scope: ConfigScope;
  readonly source: string;
}

// ---------------------------------------------------------------------------
// AgentParseResult -- discriminated union for agent parsing outcome
// ---------------------------------------------------------------------------

export type AgentParseResult =
  | { readonly tag: "parsed"; readonly agent: AgentDefinition }
  | { readonly tag: "error"; readonly filePath: string; readonly message: string };

// ---------------------------------------------------------------------------
// SettingsParseResult -- discriminated union for settings parsing outcome
// ---------------------------------------------------------------------------

export type SettingsParseResult =
  | {
      readonly tag: "parsed";
      readonly hooks: readonly HookConfig[];
      readonly mcpServers: readonly McpServerConfig[];
      readonly rules: readonly RuleEntry[];
      readonly plugins: readonly PluginInfo[];
      readonly envVars: readonly EnvVarEntry[];
    }
  | { readonly tag: "error"; readonly message: string };

// ---------------------------------------------------------------------------
// AggregatedConfig -- unified config across all scopes and categories
// ---------------------------------------------------------------------------

export interface AggregatedConfig {
  readonly agents: readonly AgentParseResult[];
  readonly commands: readonly CommandDefinition[];
  readonly hooks: readonly HookConfig[];
  readonly mcpServers: readonly McpServerConfig[];
  readonly skills: readonly SkillDefinition[];
  readonly rules: readonly RuleEntry[];
  readonly plugins: readonly PluginInfo[];
  readonly envVars: readonly EnvVarEntry[];
  readonly errors: readonly ReadErrorInfo[];
}

// ---------------------------------------------------------------------------
// ConfigReadResult -- discriminated union for top-level config load outcome
// ---------------------------------------------------------------------------

export type ConfigReadResult =
  | { readonly tag: "loaded"; readonly config: AggregatedConfig }
  | { readonly tag: "error"; readonly message: string };

// ---------------------------------------------------------------------------
// SelectedConfigItem -- discriminated union for the detail panel selection
// ---------------------------------------------------------------------------

export type SelectedConfigItem =
  | { readonly tag: "agent"; readonly agent: AgentDefinition }
  | { readonly tag: "command"; readonly command: CommandDefinition }
  | { readonly tag: "hook"; readonly hook: HookConfig }
  | { readonly tag: "mcp"; readonly server: McpServerConfig }
  | { readonly tag: "skill"; readonly skill: SkillDefinition }
  | { readonly tag: "rule"; readonly rule: RuleEntry }
  | { readonly tag: "plugin"; readonly plugin: PluginInfo }
  | { readonly tag: "env"; readonly envVar: EnvVarEntry };

// ---------------------------------------------------------------------------
// CONFIG_SUB_TABS -- const array and derived union type for tab navigation
// ---------------------------------------------------------------------------

export const CONFIG_SUB_TABS = [
  "agents",
  "commands",
  "hooks",
  "skills",
  "rules",
  "mcp",
  "plugins",
  "env",
] as const;

export type ConfigSubTab = (typeof CONFIG_SUB_TABS)[number];
