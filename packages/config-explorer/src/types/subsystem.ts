/**
 * ConfigSubsystem -- discriminated union representing the 8 configuration subsystems.
 *
 * Each subsystem has its own file format, discovery mechanism, and precedence rules.
 * The discriminant field is `subsystem`.
 */

// ---------------------------------------------------------------------------
// Subsystem Variants
// ---------------------------------------------------------------------------

export interface MemorySubsystem {
  readonly subsystem: 'memory';
  readonly label: 'Memory';
  readonly filePatterns: readonly string[];
}

export interface SettingsSubsystem {
  readonly subsystem: 'settings';
  readonly label: 'Settings';
  readonly filePatterns: readonly string[];
}

export interface RulesSubsystem {
  readonly subsystem: 'rules';
  readonly label: 'Rules';
  readonly filePatterns: readonly string[];
}

export interface SkillsSubsystem {
  readonly subsystem: 'skills';
  readonly label: 'Skills';
  readonly filePatterns: readonly string[];
}

export interface AgentsSubsystem {
  readonly subsystem: 'agents';
  readonly label: 'Agents';
  readonly filePatterns: readonly string[];
}

export interface HooksSubsystem {
  readonly subsystem: 'hooks';
  readonly label: 'Hooks';
  readonly filePatterns: readonly string[];
}

export interface PluginsSubsystem {
  readonly subsystem: 'plugins';
  readonly label: 'Plugins';
  readonly filePatterns: readonly string[];
}

export interface McpSubsystem {
  readonly subsystem: 'mcp';
  readonly label: 'MCP';
  readonly filePatterns: readonly string[];
}

// ---------------------------------------------------------------------------
// Discriminated Union
// ---------------------------------------------------------------------------

export type ConfigSubsystem =
  | MemorySubsystem
  | SettingsSubsystem
  | RulesSubsystem
  | SkillsSubsystem
  | AgentsSubsystem
  | HooksSubsystem
  | PluginsSubsystem
  | McpSubsystem;

// ---------------------------------------------------------------------------
// Subsystem Name Literal
// ---------------------------------------------------------------------------

export type SubsystemName = ConfigSubsystem['subsystem'];

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

export const memorySubsystem: MemorySubsystem = {
  subsystem: 'memory',
  label: 'Memory',
  filePatterns: ['CLAUDE.md', 'CLAUDE.local.md', 'MEMORY.md'],
} as const;

export const settingsSubsystem: SettingsSubsystem = {
  subsystem: 'settings',
  label: 'Settings',
  filePatterns: ['settings.json', 'settings.local.json'],
} as const;

export const rulesSubsystem: RulesSubsystem = {
  subsystem: 'rules',
  label: 'Rules',
  filePatterns: ['.claude/rules/*.md', '~/.claude/rules/*.md'],
} as const;

export const skillsSubsystem: SkillsSubsystem = {
  subsystem: 'skills',
  label: 'Skills',
  filePatterns: ['skills/*/SKILL.md'],
} as const;

export const agentsSubsystem: AgentsSubsystem = {
  subsystem: 'agents',
  label: 'Agents',
  filePatterns: ['agents/*.md'],
} as const;

export const hooksSubsystem: HooksSubsystem = {
  subsystem: 'hooks',
  label: 'Hooks',
  filePatterns: ['settings.json', 'hooks.json'],
} as const;

export const pluginsSubsystem: PluginsSubsystem = {
  subsystem: 'plugins',
  label: 'Plugins',
  filePatterns: ['.claude-plugin/plugin.json'],
} as const;

export const mcpSubsystem: McpSubsystem = {
  subsystem: 'mcp',
  label: 'MCP',
  filePatterns: ['.mcp.json', '.claude.json'],
} as const;

// ---------------------------------------------------------------------------
// All Subsystems
// ---------------------------------------------------------------------------

export const ALL_SUBSYSTEMS: readonly ConfigSubsystem[] = [
  memorySubsystem,
  settingsSubsystem,
  rulesSubsystem,
  skillsSubsystem,
  agentsSubsystem,
  hooksSubsystem,
  pluginsSubsystem,
  mcpSubsystem,
] as const;

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const subsystemByName: Readonly<Record<SubsystemName, ConfigSubsystem>> = {
  memory: memorySubsystem,
  settings: settingsSubsystem,
  rules: rulesSubsystem,
  skills: skillsSubsystem,
  agents: agentsSubsystem,
  hooks: hooksSubsystem,
  plugins: pluginsSubsystem,
  mcp: mcpSubsystem,
};

export const subsystemFromName = (name: SubsystemName): ConfigSubsystem =>
  subsystemByName[name];

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

export const isMemory = (sub: ConfigSubsystem): sub is MemorySubsystem => sub.subsystem === 'memory';
export const isSettings = (sub: ConfigSubsystem): sub is SettingsSubsystem => sub.subsystem === 'settings';
export const isRules = (sub: ConfigSubsystem): sub is RulesSubsystem => sub.subsystem === 'rules';
export const isSkills = (sub: ConfigSubsystem): sub is SkillsSubsystem => sub.subsystem === 'skills';
export const isAgents = (sub: ConfigSubsystem): sub is AgentsSubsystem => sub.subsystem === 'agents';
export const isHooks = (sub: ConfigSubsystem): sub is HooksSubsystem => sub.subsystem === 'hooks';
export const isPlugins = (sub: ConfigSubsystem): sub is PluginsSubsystem => sub.subsystem === 'plugins';
export const isMcp = (sub: ConfigSubsystem): sub is McpSubsystem => sub.subsystem === 'mcp';
