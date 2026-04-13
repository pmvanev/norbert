/**
 * Configuration Aggregator
 *
 * Pure function that transforms raw config data (files, settings, errors)
 * into a unified AggregatedConfig with scope annotations. No IO, no side effects.
 *
 * Driving port: aggregateConfig(rawConfig) -> AggregatedConfig
 */

import type {
  AgentParseResult,
  AggregatedConfig,
  CommandDefinition,
  ConfigScope,
  DocFile,
  EnvVar,
  EnvVarEntry,
  HookConfig,
  McpServerConfig,
  PluginInfo,
  ReadErrorInfo,
  RuleEntry,
  SettingsParseResult,
  SkillDefinition,
} from "./types";
import { parseAgentFile } from "./agentParser";
import { parseSettings } from "./settingsParser";
import { parseSkillFile } from "./skillParser";

// ---------------------------------------------------------------------------
// Input types -- raw data from filesystem reader
// ---------------------------------------------------------------------------

export interface FileEntry {
  readonly path: string;
  readonly content: string;
  readonly scope: ConfigScope;
  readonly source: string;
}

export interface RawPluginDetail {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly homepage: string;
  readonly installPath: string;
  readonly readme: string;
  readonly installedAt: string;
}

export interface RawClaudeConfig {
  readonly agents: readonly FileEntry[];
  readonly commands: readonly FileEntry[];
  readonly skills: readonly FileEntry[];
  readonly settings: FileEntry | null;
  readonly hooks: readonly FileEntry[];
  readonly rules: readonly FileEntry[];
  readonly claudeMdFiles: readonly FileEntry[];
  readonly installedPlugins: FileEntry | null;
  readonly pluginDetails: readonly RawPluginDetail[];
  readonly mcpFiles: readonly FileEntry[];
  readonly errors: readonly ReadErrorInfo[];
  readonly scope?: ConfigScope | "both";
}

// ---------------------------------------------------------------------------
// Filename extraction
// ---------------------------------------------------------------------------

function extractFilename(filePath: string): string {
  const segments = filePath.split(/[/\\]/);
  return segments[segments.length - 1];
}

// ---------------------------------------------------------------------------
// Agent aggregation
// ---------------------------------------------------------------------------

function aggregateAgents(agentFiles: readonly FileEntry[]): readonly AgentParseResult[] {
  return agentFiles.map(parseAgentEntry);
}

function parseAgentEntry(entry: FileEntry): AgentParseResult {
  const filename = extractFilename(entry.path);
  const result = parseAgentFile(filename, entry.content, entry.scope, entry.source);

  if (result.tag === "parsed") {
    return {
      tag: "parsed",
      agent: {
        ...result.agent,
        filePath: entry.path,
      },
    };
  }

  return {
    tag: "error",
    filePath: entry.path,
    message: result.message,
  };
}

// ---------------------------------------------------------------------------
// Command aggregation
// ---------------------------------------------------------------------------

function aggregateCommands(commandFiles: readonly FileEntry[]): readonly CommandDefinition[] {
  return commandFiles.map(parseCommandEntry);
}

function parseCommandEntry(entry: FileEntry): CommandDefinition {
  const filename = extractFilename(entry.path);
  const partial = parseSkillFile(filename, entry.content);

  return {
    ...partial,
    filePath: entry.path,
    scope: entry.scope,
    source: entry.source,
  };
}

// ---------------------------------------------------------------------------
// Skill aggregation
// ---------------------------------------------------------------------------

function aggregateSkills(skillFiles: readonly FileEntry[]): readonly SkillDefinition[] {
  return skillFiles.map(parseSkillEntry);
}

function parseSkillEntry(entry: FileEntry): SkillDefinition {
  const filename = extractFilename(entry.path);
  const partial = parseSkillFile(filename, entry.content);
  const name = deriveSkillName(entry.path, entry.content, partial.name);

  return {
    ...partial,
    name,
    filePath: entry.path,
    scope: entry.scope,
    source: entry.source,
  };
}

/**
 * Derive a meaningful skill name.
 *
 * Preference order:
 * 1. `name:` field in YAML frontmatter (authoritative when present)
 * 2. Parent directory name when the file is named SKILL.md (case-insensitive)
 * 3. The filename-derived fallback (filename without .md)
 */
function deriveSkillName(filePath: string, content: string, fallback: string): string {
  const frontmatterName = extractFrontmatterName(content);
  if (frontmatterName) {
    return frontmatterName;
  }

  if (fallback.toUpperCase() === "SKILL") {
    const parent = extractParentDirectory(filePath);
    if (parent) {
      return parent;
    }
  }

  return fallback;
}

function extractFrontmatterName(content: string): string | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return null;
  }
  const nameMatch = match[1].match(/^name:\s*(.+?)\s*$/m);
  return nameMatch ? nameMatch[1].trim() : null;
}

function extractParentDirectory(filePath: string): string | null {
  const segments = filePath.split(/[/\\]/).filter((s) => s.length > 0);
  return segments.length >= 2 ? segments[segments.length - 2] : null;
}

// ---------------------------------------------------------------------------
// Settings aggregation
// ---------------------------------------------------------------------------

interface ParsedSettings {
  readonly hooks: readonly HookConfig[];
  readonly mcpServers: readonly McpServerConfig[];
  readonly rules: readonly RuleEntry[];
  readonly plugins: readonly PluginInfo[];
  readonly envVars: readonly EnvVarEntry[];
}

const EMPTY_SETTINGS: ParsedSettings = {
  hooks: [],
  mcpServers: [],
  rules: [],
  plugins: [],
  envVars: [],
};

function aggregateSettings(settingsEntry: FileEntry | null): ParsedSettings {
  if (settingsEntry === null) {
    return EMPTY_SETTINGS;
  }

  const result: SettingsParseResult = parseSettings(settingsEntry.content, settingsEntry.scope);

  if (result.tag === "error") {
    return EMPTY_SETTINGS;
  }

  return {
    hooks: annotateFilePath(result.hooks, settingsEntry),
    mcpServers: annotateFilePath(result.mcpServers, settingsEntry),
    rules: annotateFilePath(result.rules, settingsEntry),
    plugins: annotateFilePath(result.plugins, settingsEntry),
    envVars: annotateFilePath(result.envVars, settingsEntry),
  };
}

function annotateFilePath<T extends { readonly filePath: string }>(
  items: readonly T[],
  entry: FileEntry,
): readonly T[] {
  return items.map((item) => ({
    ...item,
    filePath: entry.path,
  }));
}

// ---------------------------------------------------------------------------
// Doc file aggregation
// ---------------------------------------------------------------------------

function aggregateDocs(claudeMdFiles: readonly FileEntry[]): readonly DocFile[] {
  return claudeMdFiles.map(toDocFile);
}

function toDocFile(entry: FileEntry): DocFile {
  return {
    filePath: entry.path,
    content: entry.content,
    scope: entry.scope,
  };
}

// ---------------------------------------------------------------------------
// Hook file aggregation (plugin hooks from hooks.json files)
// ---------------------------------------------------------------------------

function aggregateHookFiles(hookFiles: readonly FileEntry[]): readonly HookConfig[] {
  const allHooks: HookConfig[] = [];

  for (const entry of hookFiles) {
    try {
      const parsed = JSON.parse(entry.content);
      const hooksObj = parsed.hooks ?? parsed;
      for (const [event, handlers] of Object.entries(hooksObj)) {
        if (!Array.isArray(handlers)) continue;
        for (const handler of handlers) {
          const h = handler as Record<string, unknown>;
          // Plugin hooks can have nested { hooks: [...], matcher } or flat { type, command/url }
          const hookItems = Array.isArray(h.hooks) ? h.hooks : [h];
          for (const item of hookItems) {
            const hi = item as Record<string, unknown>;
            allHooks.push({
              event,
              command: String(hi.command ?? hi.url ?? ""),
              matchers: h.matcher ? [String(h.matcher)] : [],
              rawConfig: handler,
              filePath: entry.path,
              scope: entry.scope as ConfigScope,
              source: entry.source,
            });
          }
        }
      }
    } catch {
      // Malformed JSON — skip silently
    }
  }

  return allHooks;
}

// ---------------------------------------------------------------------------
// Rule file aggregation (markdown rules from rules/*.md files)
// ---------------------------------------------------------------------------

function aggregateRuleFiles(ruleFiles: readonly FileEntry[]): readonly RuleEntry[] {
  return ruleFiles.map((entry) => ({
    text: entry.content,
    source: entry.source,
    filePath: entry.path,
    scope: entry.scope as ConfigScope,
  }));
}

// ---------------------------------------------------------------------------
// Installed plugins aggregation
// ---------------------------------------------------------------------------

function aggregateInstalledPlugins(
  entry: FileEntry | null,
  details: readonly RawPluginDetail[],
): readonly PluginInfo[] {
  if (entry === null) return [];

  // Build a lookup from plugin name to detail
  const detailMap = new Map<string, RawPluginDetail>();
  for (const d of details) {
    detailMap.set(d.name, d);
  }

  try {
    const parsed = JSON.parse(entry.content);
    const plugins = parsed.plugins ?? {};
    const result: PluginInfo[] = [];

    for (const [name, entries] of Object.entries(plugins)) {
      const arr = entries as Array<{ version?: string }>;
      if (arr.length > 0) {
        const detail = detailMap.get(name);
        result.push({
          name,
          version: String(arr[0].version ?? "unknown"),
          description: detail?.description ?? "",
          homepage: detail?.homepage ?? "",
          installPath: detail?.installPath ?? "",
          readme: detail?.readme ?? "",
          installedAt: detail?.installedAt ?? "",
          filePath: entry.path,
          scope: entry.scope as ConfigScope,
        });
      }
    }

    return result;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// MCP file aggregation
// ---------------------------------------------------------------------------

export function aggregateMcpFiles(mcpFiles: readonly FileEntry[]): readonly McpServerConfig[] {
  return mcpFiles.flatMap(parseMcpFileEntry);
}

function parseMcpFileEntry(entry: FileEntry): readonly McpServerConfig[] {
  try {
    const parsed = JSON.parse(entry.content);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return [];
    }

    const serversRaw = (parsed as Record<string, unknown>).mcpServers;
    if (typeof serversRaw !== "object" || serversRaw === null || Array.isArray(serversRaw)) {
      return [];
    }

    const serversObj = serversRaw as Record<string, unknown>;
    return Object.entries(serversObj).map(([name, config]) =>
      createMcpFileServerConfig(name, config, entry),
    );
  } catch {
    return [];
  }
}

function createMcpFileServerConfig(
  name: string,
  config: unknown,
  entry: FileEntry,
): McpServerConfig {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return {
      name,
      type: "",
      command: "",
      args: [],
      env: [],
      filePath: entry.path,
      scope: entry.scope,
      source: entry.source,
      warnings: ["Invalid server configuration"],
    };
  }

  const serverObj = config as Record<string, unknown>;
  const warnings: string[] = [];
  if (typeof serverObj.command !== "string" || serverObj.command === "") {
    warnings.push("Missing required field: command");
  }

  const type = typeof serverObj.type === "string" ? serverObj.type : "";
  const command = typeof serverObj.command === "string" ? serverObj.command : "";
  const args = Array.isArray(serverObj.args)
    ? serverObj.args.filter((a): a is string => typeof a === "string")
    : [];
  const env = extractMcpEnvVars(serverObj.env);

  return {
    name,
    type,
    command,
    args,
    env,
    filePath: entry.path,
    scope: entry.scope,
    source: entry.source,
    warnings,
  };
}

function extractMcpEnvVars(envRaw: unknown): readonly EnvVar[] {
  if (typeof envRaw !== "object" || envRaw === null || Array.isArray(envRaw)) {
    return [];
  }

  const envObj = envRaw as Record<string, unknown>;
  return Object.entries(envObj)
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => ({ key, value: value as string }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function aggregateConfig(rawConfig: RawClaudeConfig): AggregatedConfig {
  const agents = aggregateAgents(rawConfig.agents);
  const commands = aggregateCommands(rawConfig.commands);
  const skills = aggregateSkills(rawConfig.skills ?? []);
  const settings = aggregateSettings(rawConfig.settings);
  const docs = aggregateDocs(rawConfig.claudeMdFiles);
  const errors = [...rawConfig.errors];

  // Merge hooks from settings.json + plugin hooks.json files
  const pluginHooks = aggregateHookFiles(rawConfig.hooks ?? []);
  const allHooks = [...settings.hooks, ...pluginHooks];

  // Merge rules from settings.json + plugin rules/*.md files
  const pluginRules = aggregateRuleFiles(rawConfig.rules ?? []);
  const allRules = [...settings.rules, ...pluginRules];

  // Plugins from installed_plugins.json, enriched with plugin details
  const installedPlugins = aggregateInstalledPlugins(
    rawConfig.installedPlugins ?? null,
    rawConfig.pluginDetails ?? [],
  );
  const allPlugins = [...settings.plugins, ...installedPlugins];

  return {
    agents,
    commands,
    skills,
    hooks: allHooks,
    mcpServers: [...settings.mcpServers, ...aggregateMcpFiles(rawConfig.mcpFiles ?? [])],
    rules: allRules,
    plugins: allPlugins,
    envVars: settings.envVars,
    docs,
    errors,
  };
}

export type { AggregatedConfig, ReadErrorInfo };
