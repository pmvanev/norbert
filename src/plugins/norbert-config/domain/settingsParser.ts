/**
 * Settings JSON Parser
 *
 * Pure function that parses a settings.json string into structured domain
 * objects: hooks, MCP servers, rules, and plugins. No IO, no side effects.
 *
 * Driving port: parseSettings(content) -> SettingsParseResult
 */

import type {
  ConfigScope,
  EnvVar,
  EnvVarEntry,
  HookConfig,
  McpServerConfig,
  PluginInfo,
  RuleEntry,
  SettingsParseResult,
} from "./types";

// ---------------------------------------------------------------------------
// JSON parsing -- safe wrapper
// ---------------------------------------------------------------------------

function safeParseJson(
  content: string,
): { readonly tag: "ok"; readonly value: Record<string, unknown> } | { readonly tag: "error"; readonly message: string } {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { tag: "error", message: "Settings must be a JSON object" };
    }
    return { tag: "ok", value: parsed as Record<string, unknown> };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON";
    return { tag: "error", message };
  }
}

// ---------------------------------------------------------------------------
// Hook extraction
// ---------------------------------------------------------------------------

function extractHooks(hooksRaw: unknown, scope: ConfigScope): readonly HookConfig[] {
  if (typeof hooksRaw !== "object" || hooksRaw === null || Array.isArray(hooksRaw)) {
    return [];
  }

  const hooksObj = hooksRaw as Record<string, unknown>;

  return Object.entries(hooksObj).flatMap(([eventType, entries]) =>
    extractHookEntries(eventType, entries, scope),
  );
}

function extractHookEntries(
  eventType: string,
  entries: unknown,
  scope: ConfigScope,
): readonly HookConfig[] {
  if (!Array.isArray(entries)) return [];

  return entries
    .filter((entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null,
    )
    .map((entry) => createHookConfig(eventType, entry, scope));
}

function createHookConfig(
  eventType: string,
  entry: Record<string, unknown>,
  scope: ConfigScope,
): HookConfig {
  const command = typeof entry.command === "string" ? entry.command : "";
  const matchers = Array.isArray(entry.matchers)
    ? entry.matchers.filter((m): m is string => typeof m === "string")
    : [];

  return {
    event: eventType,
    command,
    matchers,
    rawConfig: entry,
    filePath: "",
    scope,
    source: scope === "plugin" ? "settings" : scope,
  };
}

// ---------------------------------------------------------------------------
// MCP server extraction
// ---------------------------------------------------------------------------

function extractMcpServers(serversRaw: unknown, scope: ConfigScope): readonly McpServerConfig[] {
  if (typeof serversRaw !== "object" || serversRaw === null || Array.isArray(serversRaw)) {
    return [];
  }

  const serversObj = serversRaw as Record<string, unknown>;

  return Object.entries(serversObj).map(([name, config]) =>
    createMcpServerConfig(name, config, scope),
  );
}

function createMcpServerConfig(
  name: string,
  config: unknown,
  scope: ConfigScope,
): McpServerConfig {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return emptyServerConfig(name, scope, ["Invalid server configuration"]);
  }

  const serverObj = config as Record<string, unknown>;
  const warnings = collectServerWarnings(serverObj);

  const type = typeof serverObj.type === "string" ? serverObj.type : "";
  const command = typeof serverObj.command === "string" ? serverObj.command : "";
  const args = Array.isArray(serverObj.args)
    ? serverObj.args.filter((a): a is string => typeof a === "string")
    : [];
  const env = extractEnvVars(serverObj.env);

  return { name, type, command, args, env, filePath: "", scope, warnings };
}

function emptyServerConfig(
  name: string,
  scope: ConfigScope,
  warnings: readonly string[],
): McpServerConfig {
  return { name, type: "", command: "", args: [], env: [], filePath: "", scope, warnings };
}

function collectServerWarnings(serverObj: Record<string, unknown>): readonly string[] {
  const warnings: string[] = [];
  if (typeof serverObj.command !== "string" || serverObj.command === "") {
    warnings.push("Missing required field: command");
  }
  return warnings;
}

function extractEnvVars(envRaw: unknown): readonly EnvVar[] {
  if (typeof envRaw !== "object" || envRaw === null || Array.isArray(envRaw)) {
    return [];
  }

  const envObj = envRaw as Record<string, unknown>;

  return Object.entries(envObj)
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => ({ key, value: value as string }));
}

// ---------------------------------------------------------------------------
// Top-level env var extraction
// ---------------------------------------------------------------------------

function extractTopLevelEnvVars(envRaw: unknown, scope: ConfigScope): readonly EnvVarEntry[] {
  if (typeof envRaw !== "object" || envRaw === null || Array.isArray(envRaw)) {
    return [];
  }

  const envObj = envRaw as Record<string, unknown>;

  return Object.entries(envObj)
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => ({
      key,
      value: value as string,
      scope,
      source: "settings.json",
      filePath: "",
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

// ---------------------------------------------------------------------------
// Rules extraction
// ---------------------------------------------------------------------------

function extractRules(rulesRaw: unknown, scope: ConfigScope): readonly RuleEntry[] {
  if (!Array.isArray(rulesRaw)) return [];

  return rulesRaw
    .filter((entry): entry is string => typeof entry === "string")
    .map((text) => ({
      text,
      source: "settings.json",
      filePath: "",
      scope,
    }));
}

// ---------------------------------------------------------------------------
// Plugin extraction
// ---------------------------------------------------------------------------

function extractPlugins(pluginsRaw: unknown, scope: ConfigScope): readonly PluginInfo[] {
  if (!Array.isArray(pluginsRaw)) return [];

  return pluginsRaw
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null,
    )
    .map((entry) => ({
      name: typeof entry.name === "string" ? entry.name : "",
      version: typeof entry.version === "string" ? entry.version : "",
      description: "",
      homepage: "",
      installPath: "",
      readme: "",
      installedAt: "",
      filePath: "",
      scope,
    }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseSettings(content: string, scope: ConfigScope = "user"): SettingsParseResult {
  const jsonResult = safeParseJson(content);

  if (jsonResult.tag === "error") {
    return { tag: "error", message: jsonResult.message };
  }

  const settings = jsonResult.value;

  return {
    tag: "parsed",
    hooks: extractHooks(settings.hooks, scope),
    mcpServers: extractMcpServers(settings.mcpServers, scope),
    rules: extractRules(settings.rules, scope),
    plugins: extractPlugins(settings.plugins, scope),
    envVars: extractTopLevelEnvVars(settings.env, scope),
  };
}

export type { SettingsParseResult };
