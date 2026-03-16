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
  readonly source: string;
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
// Skill aggregation
// ---------------------------------------------------------------------------

function aggregateSkills(commandFiles: readonly FileEntry[]): readonly SkillDefinition[] {
  return commandFiles.map(parseSkillEntry);
}

function parseSkillEntry(entry: FileEntry): SkillDefinition {
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

  const result: SettingsParseResult = parseSettings(settingsEntry.content, settingsEntry.scope);

  if (result.tag === "error") {
    return EMPTY_SETTINGS;
  }

  return {
    hooks: annotateFilePath(result.hooks, settingsEntry),
    mcpServers: annotateFilePath(result.mcpServers, settingsEntry),
    rules: annotateFilePath(result.rules, settingsEntry),
    plugins: annotateFilePath(result.plugins, settingsEntry),
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
    mcpServers: settings.mcpServers,
    rules: settings.rules,
    plugins: settings.plugins,
    docs,
    errors,
  };
}

export type { AggregatedConfig, ReadErrorInfo };
