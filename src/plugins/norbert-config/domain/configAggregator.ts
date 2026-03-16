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
  ConfigScope,
  DocFile,
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
}

export interface RawClaudeConfig {
  readonly agents: readonly FileEntry[];
  readonly commands: readonly FileEntry[];
  readonly settings: FileEntry | null;
  readonly claudeMdFiles: readonly FileEntry[];
  readonly errors: readonly ReadErrorInfo[];
  readonly scope: ConfigScope | "both";
}

// ---------------------------------------------------------------------------
// Filename extraction
// ---------------------------------------------------------------------------

function extractFilename(filePath: string): string {
  const segments = filePath.split("/");
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
  const result = parseAgentFile(filename, entry.content);

  if (result.tag === "parsed") {
    return {
      tag: "parsed",
      agent: {
        ...result.agent,
        filePath: entry.path,
        scope: entry.scope,
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
// Skill aggregation
// ---------------------------------------------------------------------------

function aggregateSkills(commandFiles: readonly FileEntry[]): readonly SkillDefinition[] {
  return commandFiles.map(parseCommandEntry);
}

function parseCommandEntry(entry: FileEntry): SkillDefinition {
  const filename = extractFilename(entry.path);
  const partial = parseSkillFile(filename, entry.content);

  return {
    ...partial,
    filePath: entry.path,
    scope: entry.scope,
  };
}

// ---------------------------------------------------------------------------
// Settings aggregation
// ---------------------------------------------------------------------------

interface ParsedSettings {
  readonly hooks: readonly HookConfig[];
  readonly mcpServers: readonly McpServerConfig[];
  readonly rules: readonly RuleEntry[];
  readonly plugins: readonly PluginInfo[];
}

const EMPTY_SETTINGS: ParsedSettings = {
  hooks: [],
  mcpServers: [],
  rules: [],
  plugins: [],
};

function aggregateSettings(settingsEntry: FileEntry | null): ParsedSettings {
  if (settingsEntry === null) {
    return EMPTY_SETTINGS;
  }

  const result: SettingsParseResult = parseSettings(settingsEntry.content);

  if (result.tag === "error") {
    return EMPTY_SETTINGS;
  }

  return {
    hooks: annotateScopeOnHooks(result.hooks, settingsEntry),
    mcpServers: annotateScopeOnMcpServers(result.mcpServers, settingsEntry),
    rules: annotateScopeOnRules(result.rules, settingsEntry),
    plugins: annotateScopeOnPlugins(result.plugins, settingsEntry),
  };
}

function annotateScopeOnHooks(
  hooks: readonly HookConfig[],
  entry: FileEntry,
): readonly HookConfig[] {
  return hooks.map((hook) => ({
    ...hook,
    filePath: entry.path,
    scope: entry.scope,
  }));
}

function annotateScopeOnMcpServers(
  servers: readonly McpServerConfig[],
  entry: FileEntry,
): readonly McpServerConfig[] {
  return servers.map((server) => ({
    ...server,
    filePath: entry.path,
    scope: entry.scope,
  }));
}

function annotateScopeOnRules(
  rules: readonly RuleEntry[],
  entry: FileEntry,
): readonly RuleEntry[] {
  return rules.map((rule) => ({
    ...rule,
    filePath: entry.path,
    scope: entry.scope,
  }));
}

function annotateScopeOnPlugins(
  plugins: readonly PluginInfo[],
  entry: FileEntry,
): readonly PluginInfo[] {
  return plugins.map((plugin) => ({
    ...plugin,
    filePath: entry.path,
    scope: entry.scope,
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
// Public API
// ---------------------------------------------------------------------------

export function aggregateConfig(rawConfig: RawClaudeConfig): AggregatedConfig {
  const agents = aggregateAgents(rawConfig.agents);
  const skills = aggregateSkills(rawConfig.commands);
  const settings = aggregateSettings(rawConfig.settings);
  const docs = aggregateDocs(rawConfig.claudeMdFiles);
  const errors = rawConfig.errors;

  return {
    agents,
    skills,
    hooks: settings.hooks,
    projectHooks: [],
    mcpServers: settings.mcpServers,
    rules: settings.rules,
    plugins: settings.plugins,
    docs,
    errors,
  };
}

export type { RawClaudeConfig, AggregatedConfig, FileEntry, ReadErrorInfo };
