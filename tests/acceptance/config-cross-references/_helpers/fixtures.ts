/**
 * AggregatedConfig fixtures for config-cross-references acceptance tests.
 *
 * These fixtures intentionally exercise the cross-scope, cross-source
 * combinations the feature must handle:
 *   - same-named items in multiple scopes (drives the `ambiguous` ResolvedRef)
 *   - items addressable by both name and absolute file path
 *   - plugin-scope items attributed to a plugin source
 *   - dead targets (referenced but not present)
 *
 * Each helper returns a fully-formed domain object. Compose via
 * `makeAggregatedConfig({ skills: [...], commands: [...] })`.
 */

import type {
  AggregatedConfig,
  AgentDefinition,
  CommandDefinition,
  ConfigScope,
  HookConfig,
  McpServerConfig,
  PluginInfo,
  RuleEntry,
  SkillDefinition,
  EnvVarEntry,
  AgentParseResult,
  ReadErrorInfo,
} from "../../../../src/plugins/norbert-config/domain/types";

// ---------------------------------------------------------------------------
// Empty / null
// ---------------------------------------------------------------------------

export const emptyAggregatedConfig: AggregatedConfig = {
  agents: [],
  commands: [],
  hooks: [],
  mcpServers: [],
  skills: [],
  rules: [],
  plugins: [],
  envVars: [],
  errors: [],
};

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const userScopePath = (relative: string) => `~/.claude/${relative}`;
const projectScopePath = (relative: string) => `.claude/${relative}`;
const pluginScopePath = (plugin: string, relative: string) =>
  `~/.claude/plugins/${plugin}/${relative}`;

export function makeSkill(
  name: string,
  scope: ConfigScope = "user",
  pluginSource?: string,
): SkillDefinition {
  const source = scope === "plugin" ? (pluginSource ?? "unknown-plugin") : scope;
  const filePath =
    scope === "user"
      ? userScopePath(`skills/${name}/SKILL.md`)
      : scope === "project"
        ? projectScopePath(`skills/${name}/SKILL.md`)
        : pluginScopePath(pluginSource ?? "unknown-plugin", `skills/${name}/SKILL.md`);
  return {
    name,
    description: `Description for ${name}`,
    content: `# ${name}\n\nBody for ${name}`,
    filePath,
    scope,
    source,
  };
}

export function makeCommand(
  name: string,
  scope: ConfigScope = "user",
  pluginSource?: string,
  body = "",
): CommandDefinition {
  const source = scope === "plugin" ? (pluginSource ?? "unknown-plugin") : scope;
  const filePath =
    scope === "user"
      ? userScopePath(`commands/${name}.md`)
      : scope === "project"
        ? projectScopePath(`commands/${name}.md`)
        : pluginScopePath(pluginSource ?? "unknown-plugin", `commands/${name}.md`);
  return {
    name,
    description: `Description for ${name}`,
    content: body || `# ${name}\n\nBody for ${name}`,
    filePath,
    scope,
    source,
  };
}

export function makeAgent(
  name: string,
  scope: ConfigScope = "user",
  pluginSource?: string,
  systemPrompt = "",
): AgentDefinition {
  const source = scope === "plugin" ? (pluginSource ?? "unknown-plugin") : scope;
  const filePath =
    scope === "user"
      ? userScopePath(`agents/${name}.md`)
      : scope === "project"
        ? projectScopePath(`agents/${name}.md`)
        : pluginScopePath(pluginSource ?? "unknown-plugin", `agents/${name}.md`);
  return {
    name,
    persona: `${name} persona`,
    role: `${name} role`,
    model: "sonnet",
    toolCount: 0,
    tools: [],
    description: `Description for ${name}`,
    systemPrompt: systemPrompt || `# ${name} system prompt`,
    filePath,
    scope,
    source,
  };
}

export function makeHook(
  name: string,
  scope: ConfigScope = "user",
): HookConfig {
  const filePath =
    scope === "user"
      ? userScopePath(`hooks/${name}`)
      : projectScopePath(`hooks/${name}`);
  return {
    event: "PreToolUse",
    command: `bash ${filePath}`,
    matchers: [],
    rawConfig: { command: `bash ${filePath}` },
    filePath,
    scope,
    source: scope === "plugin" ? "unknown-plugin" : scope,
  };
}

export function makeMcpServer(
  name: string,
  scope: ConfigScope = "user",
): McpServerConfig {
  return {
    name,
    type: "stdio",
    command: "node",
    args: ["server.js"],
    env: [],
    filePath: scope === "user" ? userScopePath("settings.json") : projectScopePath(".mcp.json"),
    scope,
    source: scope === "user" ? "settings.json" : ".mcp.json",
    warnings: [],
  };
}

export function makePlugin(name: string): PluginInfo {
  return {
    name,
    version: "1.0.0",
    description: `Plugin ${name}`,
    homepage: "",
    installPath: pluginScopePath(name, ""),
    readme: `# ${name}`,
    installedAt: "2026-01-01T00:00:00Z",
    filePath: pluginScopePath(name, "plugin.json"),
    scope: "plugin",
  };
}

export function makeRule(text: string, scope: ConfigScope = "project"): RuleEntry {
  return {
    text,
    source: scope,
    filePath: scope === "project" ? projectScopePath("CLAUDE.md") : userScopePath("CLAUDE.md"),
    scope,
  };
}

export function makeEnvVar(key: string, value: string, scope: ConfigScope = "user"): EnvVarEntry {
  return {
    key,
    value,
    scope,
    source: scope === "user" ? "~/.claude/settings.json" : ".claude/settings.json",
    filePath: scope === "user" ? userScopePath("settings.json") : projectScopePath("settings.json"),
  };
}

export function makeAggregatedConfig(parts: {
  agents?: readonly AgentDefinition[];
  commands?: readonly CommandDefinition[];
  hooks?: readonly HookConfig[];
  mcpServers?: readonly McpServerConfig[];
  skills?: readonly SkillDefinition[];
  rules?: readonly RuleEntry[];
  plugins?: readonly PluginInfo[];
  envVars?: readonly EnvVarEntry[];
  errors?: readonly ReadErrorInfo[];
}): AggregatedConfig {
  const wrapAgents = (xs: readonly AgentDefinition[] = []): readonly AgentParseResult[] =>
    xs.map((agent) => ({ tag: "parsed" as const, agent }));
  return {
    agents: wrapAgents(parts.agents),
    commands: parts.commands ?? [],
    hooks: parts.hooks ?? [],
    mcpServers: parts.mcpServers ?? [],
    skills: parts.skills ?? [],
    rules: parts.rules ?? [],
    plugins: parts.plugins ?? [],
    envVars: parts.envVars ?? [],
    errors: parts.errors ?? [],
  };
}

// ---------------------------------------------------------------------------
// Common scenarios
// ---------------------------------------------------------------------------

/**
 * Walking-skeleton baseline: /release command on project scope referencing
 * a user-scope skill nw-bdd-requirements and a project-scope hook pre-release.sh.
 */
export const walkingSkeletonConfig: AggregatedConfig = makeAggregatedConfig({
  commands: [
    makeCommand(
      "release",
      "project",
      undefined,
      "# /release\n\n1. Load the [nw-bdd-requirements](~/.claude/skills/nw-bdd-requirements/SKILL.md) skill\n2. Run [pre-release.sh](.claude/hooks/pre-release.sh)\n",
    ),
  ],
  skills: [
    makeSkill("nw-bdd-requirements", "user"),
    makeSkill("nw-discovery-methodology", "project"),
  ],
  hooks: [makeHook("pre-release.sh", "project")],
});

/**
 * Ambiguous-reference scenario: command 'release' in BOTH project and user scope.
 */
export const ambiguousReleaseConfig: AggregatedConfig = makeAggregatedConfig({
  commands: [
    makeCommand("release", "project", undefined, "# project release"),
    makeCommand("release", "user", undefined, "# user release"),
  ],
});
