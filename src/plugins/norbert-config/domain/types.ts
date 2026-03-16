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

export type ConfigScope = "user" | "project";

// ---------------------------------------------------------------------------
// EnvVar -- key-value pair for MCP server environment
// ---------------------------------------------------------------------------

export interface EnvVar {
  readonly key: string;
  readonly value: string;
}

// ---------------------------------------------------------------------------
// AgentDefinition -- parsed agent metadata from .md file
// ---------------------------------------------------------------------------

export interface AgentDefinition {
  readonly name: string;
  readonly model: string;
  readonly toolCount: number;
  readonly tools: readonly string[];
  readonly description: string;
  readonly systemPrompt: string;
  readonly filePath: string;
  readonly scope: ConfigScope;
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
  readonly warnings: readonly string[];
}

// ---------------------------------------------------------------------------
// SkillDefinition -- parsed skill/command metadata
// ---------------------------------------------------------------------------

export interface SkillDefinition {
  readonly name: string;
  readonly description: string;
  readonly filePath: string;
  readonly scope: ConfigScope;
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
  readonly filePath: string;
  readonly scope: ConfigScope;
}

// ---------------------------------------------------------------------------
// DocFile -- raw CLAUDE.md content with source attribution
// ---------------------------------------------------------------------------

export interface DocFile {
  readonly filePath: string;
  readonly content: string;
  readonly scope: ConfigScope;
}

// ---------------------------------------------------------------------------
// ReadErrorInfo -- per-file read failure
// ---------------------------------------------------------------------------

export interface ReadErrorInfo {
  readonly path: string;
  readonly error: string;
  readonly scope: ConfigScope;
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
    }
  | { readonly tag: "error"; readonly message: string };

// ---------------------------------------------------------------------------
// AggregatedConfig -- unified config across all scopes and categories
// ---------------------------------------------------------------------------

export interface AggregatedConfig {
  readonly agents: readonly AgentParseResult[];
  readonly hooks: readonly HookConfig[];
  readonly mcpServers: readonly McpServerConfig[];
  readonly skills: readonly SkillDefinition[];
  readonly rules: readonly RuleEntry[];
  readonly plugins: readonly PluginInfo[];
  readonly docs: readonly DocFile[];
  readonly errors: readonly ReadErrorInfo[];
}

// ---------------------------------------------------------------------------
// ConfigReadResult -- discriminated union for top-level config load outcome
// ---------------------------------------------------------------------------

export type ConfigReadResult =
  | { readonly tag: "loaded"; readonly config: AggregatedConfig }
  | { readonly tag: "error"; readonly message: string };

// ---------------------------------------------------------------------------
// CONFIG_SUB_TABS -- const array and derived union type for tab navigation
// ---------------------------------------------------------------------------

export const CONFIG_SUB_TABS = [
  "agents",
  "hooks",
  "skills",
  "rules",
  "mcp",
  "plugins",
  "docs",
] as const;

export type ConfigSubTab = (typeof CONFIG_SUB_TABS)[number];
