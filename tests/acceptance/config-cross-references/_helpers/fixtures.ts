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
import {
  emptyHistory as emptyHistoryConst,
  type NavEntry,
  type NavHistory,
} from "../../../../src/plugins/norbert-config/domain/nav/history";
import {
  buildRegistry,
  lookupByName,
  type ReferenceRegistry,
  type RegistryEntry,
} from "../../../../src/plugins/norbert-config/domain/references/registry";
import {
  resolve,
  type ResolvedRef,
} from "../../../../src/plugins/norbert-config/domain/references/resolver";
import type { ConfigNavState } from "../../../../src/plugins/norbert-config/domain/nav/reducer";

/**
 * Re-export of the domain sentinel. Tests import `emptyHistory` from this
 * fixtures module so all helpers and arrange-blocks share a single source.
 */
export const emptyHistory: NavHistory = emptyHistoryConst;

/**
 * Build a 4-entry NavHistory with distinct opaque entries (k: 'e0'..'e3') and
 * the supplied `headIndex`. Used by US-104 walking-skeleton scenarios.
 *
 * Throws `RangeError` when `headIndex` falls outside `0..3` so an invalid
 * input fails fast at the call site rather than producing a NavHistory that
 * silently violates ADR-006 invariant 1 (0 <= headIndex < entries.length).
 */
export function makeHistoryWith4Entries(headIndex: number): NavHistory {
  if (headIndex < 0 || headIndex >= 4) {
    throw new RangeError(
      `makeHistoryWith4Entries: headIndex must be 0..3, got ${headIndex}`,
    );
  }
  const entries: readonly NavEntry[] = [
    { k: "e0" },
    { k: "e1" },
    { k: "e2" },
    { k: "e3" },
  ];
  return { entries, headIndex };
}

/**
 * Build a 50-entry sequence of distinct opaque NavEntries (k: 'e0'..'e49').
 * Used by US-104 LRU-cap scenarios that need a history sitting exactly at
 * MAX_HISTORY_ENTRIES so the next pushEntry exercises eviction (ADR-006).
 */
export function makeFiftyEntries(): readonly NavEntry[] {
  return Array.from({ length: 50 }, (_, i) => ({ k: `e${i}` }));
}

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

// Bulk fixtures (NFR-2 performance scenarios)

const range = (n: number): readonly number[] =>
  Array.from({ length: n }, (_, i) => i);

/**
 * 500-item AggregatedConfig: 100 each of skills, commands, agents, hooks, and
 * mcpServers. Names are unique across the entire 500-item set because the
 * per-category prefix disambiguates them (skill-0..99, command-0..99, etc.),
 * so a registry built from this config has byName.size === 500.
 *
 * Used by the NFR-2 acceptance scenario in registry.test.ts to validate the
 * O(N) algorithmic shape of buildRegistry against a realistic-scale input.
 */
export function make500ItemConfig(): AggregatedConfig {
  const skills = range(100).map((i) => makeSkill(`skill-${i}`, "user"));
  const commands = range(100).map((i) => makeCommand(`command-${i}`, "project"));
  const agents = range(100).map((i) => makeAgent(`agent-${i}`, "user"));
  const hooks = range(100).map((i) => makeHook(`hook-${i}.sh`, "project"));
  const mcpServers = range(100).map((i) => makeMcpServer(`mcp-${i}`, "user"));
  return makeAggregatedConfig({ skills, commands, agents, hooks, mcpServers });
}

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

// ---------------------------------------------------------------------------
// ConfigNavReducer fixtures (Phase 04)
// ---------------------------------------------------------------------------

/**
 * Empty starting nav state. Used by reducer scenarios as the baseline before
 * arranging step-specific overrides via spread. `selectedItemKey === null`
 * means refSingleClick has no current anchor; tests that need a top pane
 * should set `selectedItemKey` AND pass a matching `currentEntry` in the
 * action payload.
 *
 * `activeSubTab: 'commands'` mirrors the walking-skeleton config's anchor
 * (the `/release` command), keeping fixture state aligned with how a real
 * Configuration view would arrive at a refSingleClick on a skill or hook.
 */
export const initialNavState: ConfigNavState = {
  activeSubTab: "commands",
  selectedItemKey: null,
  splitState: null,
  history: emptyHistoryConst,
  filter: { bySubTab: {} },
  filterResetCue: null,
  endOfHistory: null,
  popover: null,
};

/**
 * Resolve a name through a registry to a ResolvedRef. Reducer scenarios use
 * this to build the action payload from a fixture name like
 * `refTo(reg, 'nw-bdd-requirements')` rather than constructing Reference
 * literals inline. Mirrors how the Provider would build the action from a
 * detection-annotated link click.
 */
export function refTo(registry: ReferenceRegistry, name: string): ResolvedRef {
  return resolve({ kind: "name", value: name }, registry);
}

/**
 * Build the registry-and-current-entry pair the walking-skeleton reducer
 * scenario needs. The current entry is the `/release` command (project scope);
 * the target is resolved on demand via {@link refTo}.
 *
 * Throws when the expected `release` command is not found in the registry --
 * the fixture and the walking-skeleton config must stay in sync.
 */
export function makeWalkingSkeletonReducerArrangement(): {
  readonly registry: ReferenceRegistry;
  readonly releaseEntry: RegistryEntry;
} {
  const registry = buildRegistry(walkingSkeletonConfig, 0);
  const releaseMatches = lookupByName(registry, "release");
  const releaseEntry = releaseMatches[0];
  if (releaseEntry === undefined) {
    throw new Error(
      "walkingSkeletonConfig must contain a 'release' command for reducer fixtures",
    );
  }
  return { registry, releaseEntry };
}
