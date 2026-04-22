/**
 * Reference Registry
 *
 * Pure domain module that indexes an AggregatedConfig by item name and
 * absolute file path so cross-reference resolution (US-101) can answer
 * "is this name a real config item?" and "which entry lives at this path?"
 * in O(1).
 *
 * Driving port (architecture sec 6.1):
 *   buildRegistry(config, prevVersion) -> ReferenceRegistry   -- pure derivation
 *   lookupByName(reg, name)            -> readonly RegistryEntry[]
 *   lookupByPath(reg, path)            -> RegistryEntry | null
 *
 * Constraints:
 *   - Pure functions only (no classes, no mutation of inputs)
 *   - Readonly types throughout
 *   - No React, no Tauri, no IO
 *
 * `byName` is a multimap (name -> list of entries) so cross-scope name
 * collisions surface as multiple candidates without requiring a refactor
 * when later steps add ambiguous-resolution behaviour.
 */
import type {
  AggregatedConfig,
  AgentParseResult,
  CommandDefinition,
  ConfigScope,
  HookConfig,
  McpServerConfig,
  PluginInfo,
  RuleEntry,
  SkillDefinition,
} from "../types";

// ---------------------------------------------------------------------------
// RefType -- the kinds of config items the registry can index
// ---------------------------------------------------------------------------

export type RefType =
  | "agent"
  | "command"
  | "skill"
  | "hook"
  | "mcp"
  | "rule"
  | "plugin";

// ---------------------------------------------------------------------------
// RegistryEntry -- one indexed config item
// ---------------------------------------------------------------------------

export interface RegistryEntry {
  readonly type: RefType;
  readonly scope: ConfigScope;
  readonly source: string;
  readonly name: string;
  readonly filePath: string;
  readonly itemKey: string;
}

// ---------------------------------------------------------------------------
// ReferenceRegistry -- the indexed structure consumed by resolution/detection
// ---------------------------------------------------------------------------

export interface ReferenceRegistry {
  readonly byName: ReadonlyMap<string, readonly RegistryEntry[]>;
  readonly byFilePath: ReadonlyMap<string, RegistryEntry>;
  readonly version: number;
}

// ---------------------------------------------------------------------------
// Internal: per-collection projections to RegistryEntry
//
// Each projector is a small pure function that takes one item from an
// AggregatedConfig collection and returns the corresponding RegistryEntry.
// Keeping them named (rather than inlining a giant switch) preserves the
// "small composable functions" principle and lets new RefType additions
// land as a one-line table entry.
// ---------------------------------------------------------------------------

function makeItemKey(type: RefType, scope: ConfigScope, name: string): string {
  return `${type}:${scope}:${name}`;
}

function entryFromAgent(result: AgentParseResult): RegistryEntry | null {
  if (result.tag !== "parsed") {
    return null;
  }
  const { agent } = result;
  return {
    type: "agent",
    scope: agent.scope,
    source: agent.source,
    name: agent.name,
    filePath: agent.filePath,
    itemKey: makeItemKey("agent", agent.scope, agent.name),
  };
}

function entryFromCommand(command: CommandDefinition): RegistryEntry {
  return {
    type: "command",
    scope: command.scope,
    source: command.source,
    name: command.name,
    filePath: command.filePath,
    itemKey: makeItemKey("command", command.scope, command.name),
  };
}

function entryFromSkill(skill: SkillDefinition): RegistryEntry {
  return {
    type: "skill",
    scope: skill.scope,
    source: skill.source,
    name: skill.name,
    filePath: skill.filePath,
    itemKey: makeItemKey("skill", skill.scope, skill.name),
  };
}

function entryFromHook(hook: HookConfig): RegistryEntry {
  // Hooks have no intrinsic name field; the file path's basename is the
  // closest stable identifier (e.g., 'pre-release.sh').
  const name = basename(hook.filePath) || hook.command;
  return {
    type: "hook",
    scope: hook.scope,
    source: hook.source,
    name,
    filePath: hook.filePath,
    itemKey: makeItemKey("hook", hook.scope, name),
  };
}

function entryFromMcpServer(server: McpServerConfig): RegistryEntry {
  return {
    type: "mcp",
    scope: server.scope,
    source: server.source,
    name: server.name,
    filePath: server.filePath,
    itemKey: makeItemKey("mcp", server.scope, server.name),
  };
}

function entryFromRule(rule: RuleEntry): RegistryEntry {
  // Rules have no name field; use the file's basename for stable lookup.
  const name = basename(rule.filePath);
  return {
    type: "rule",
    scope: rule.scope,
    source: rule.source,
    name,
    filePath: rule.filePath,
    itemKey: makeItemKey("rule", rule.scope, name),
  };
}

function entryFromPlugin(plugin: PluginInfo): RegistryEntry {
  return {
    type: "plugin",
    scope: plugin.scope,
    source: plugin.name,
    name: plugin.name,
    filePath: plugin.filePath,
    itemKey: makeItemKey("plugin", plugin.scope, plugin.name),
  };
}

function basename(filePath: string): string {
  const segments = filePath.split(/[/\\]/);
  return segments[segments.length - 1] ?? "";
}

// ---------------------------------------------------------------------------
// Internal: collect all entries from an AggregatedConfig in a single pass per
// collection. Agents are filtered to the parsed branch only.
// ---------------------------------------------------------------------------

function collectEntries(config: AggregatedConfig): readonly RegistryEntry[] {
  const agents = config.agents
    .map(entryFromAgent)
    .filter((entry): entry is RegistryEntry => entry !== null);
  const commands = config.commands.map(entryFromCommand);
  const skills = config.skills.map(entryFromSkill);
  const hooks = config.hooks.map(entryFromHook);
  const mcpServers = config.mcpServers.map(entryFromMcpServer);
  const rules = config.rules.map(entryFromRule);
  const plugins = config.plugins.map(entryFromPlugin);

  return [...agents, ...commands, ...skills, ...hooks, ...mcpServers, ...rules, ...plugins];
}

// ---------------------------------------------------------------------------
// Internal: index a flat entry list into the byName multimap and byFilePath
// unique map. A build-time mutable Map is used internally; the returned
// ReadonlyMap views prevent caller mutation.
// ---------------------------------------------------------------------------

interface RegistryIndices {
  readonly byName: ReadonlyMap<string, readonly RegistryEntry[]>;
  readonly byFilePath: ReadonlyMap<string, RegistryEntry>;
}

function indexEntries(entries: readonly RegistryEntry[]): RegistryIndices {
  const byName = new Map<string, RegistryEntry[]>();
  const byFilePath = new Map<string, RegistryEntry>();

  for (const entry of entries) {
    const existing = byName.get(entry.name);
    if (existing === undefined) {
      byName.set(entry.name, [entry]);
    } else {
      existing.push(entry);
    }

    // First-writer-wins on path collisions; later steps may surface conflicts
    // as warnings but the byFilePath surface is single-valued by contract.
    if (!byFilePath.has(entry.filePath)) {
      byFilePath.set(entry.filePath, entry);
    }
  }

  return { byName, byFilePath };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a ReferenceRegistry from an AggregatedConfig.
 *
 * `prevVersion` is the version of the previous registry build; the returned
 * registry's `version` is strictly greater so downstream memoisation can
 * distinguish a fresh build from an uninitialised state.
 */
export function buildRegistry(
  config: AggregatedConfig,
  prevVersion: number,
): ReferenceRegistry {
  const entries = collectEntries(config);
  const { byName, byFilePath } = indexEntries(entries);

  return {
    byName,
    byFilePath,
    version: prevVersion + 1,
  };
}

/**
 * Look up registry entries by item name. Returns an empty array when the name
 * is unknown. Multiple entries indicate cross-scope name collisions.
 */
export function lookupByName(
  reg: ReferenceRegistry,
  name: string,
): readonly RegistryEntry[] {
  return reg.byName.get(name) ?? [];
}

/**
 * Look up the unique registry entry for an absolute file path. Returns null
 * when no entry is indexed at that path.
 */
export function lookupByPath(
  reg: ReferenceRegistry,
  path: string,
): RegistryEntry | null {
  return reg.byFilePath.get(path) ?? null;
}
