/**
 * Unit tests: MCP file aggregation and source attribution
 *
 * Tests for aggregateMcpFiles() and source attribution on McpServerConfig.
 * Property-based tests validate structural invariants:
 *   - Source attribution is always present on every MCP server
 *   - Server count equals sum of servers across all mcp files
 *   - Malformed/empty mcp files produce zero servers, no crash
 *   - Servers from mcpFiles merge with settings.json servers
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  aggregateConfig,
  aggregateMcpFiles,
  type RawClaudeConfig,
  type FileEntry,
} from "../../../../../src/plugins/norbert-config/domain/configAggregator";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const scopeArb = fc.constantFrom("user" as const, "project" as const, "plugin" as const);

const sourceArb = fc.constantFrom(".claude.json", ".mcp.json", "discord", "slack");

/** Server name arbitrary using constantFrom for speed */
const serverNameArb = fc.constantFrom(
  "memory-server", "git-server", "db-server", "api-server", "slack-bot",
  "discord-bot", "fs-server", "search-srv", "cache-srv", "log-srv",
);

/** Generate a valid mcpServers JSON block with 1-3 servers */
const mcpServersJsonArb = fc
  .array(
    fc.tuple(
      serverNameArb,
      fc.constantFrom("stdio", "sse", "streamable-http"),
      fc.constantFrom("npx srv", "node index.js", "python main.py"),
    ),
    { minLength: 1, maxLength: 3 },
  )
  .map((servers) => {
    const obj: Record<string, unknown> = {};
    for (const [name, type, command] of servers) {
      obj[name] = { type, command, args: [] };
    }
    return JSON.stringify({ mcpServers: obj });
  });

/** Generate a FileEntry containing valid MCP server JSON */
const mcpFileEntryArb: fc.Arbitrary<FileEntry> = fc
  .tuple(mcpServersJsonArb, scopeArb, sourceArb)
  .map(([content, scope, source]) => ({
    path: `${scope === "user" ? "~/.claude" : "./.claude"}/${source}`,
    content,
    scope,
    source,
  }));

/** Generate a FileEntry with malformed JSON */
const malformedMcpFileEntryArb: fc.Arbitrary<FileEntry> = fc
  .tuple(
    fc.constantFrom("{ broken", "not json", "{,}", "[]", "null", "42"),
    scopeArb,
    sourceArb,
  )
  .map(([content, scope, source]) => ({
    path: `./.claude/${source}`,
    content,
    scope,
    source,
  }));

/** Generate a FileEntry with valid JSON but no mcpServers key */
const noMcpServersFileEntryArb: fc.Arbitrary<FileEntry> = fc
  .tuple(scopeArb, sourceArb)
  .map(([scope, source]) => ({
    path: `./.claude/${source}`,
    content: JSON.stringify({ permissions: { allow: [] } }),
    scope,
    source,
  }));

// ---------------------------------------------------------------------------
// Helper: count servers in a valid mcp file entry
// ---------------------------------------------------------------------------

function countServersInEntry(entry: FileEntry): number {
  try {
    const parsed = JSON.parse(entry.content);
    const servers = parsed.mcpServers;
    if (typeof servers === "object" && servers !== null && !Array.isArray(servers)) {
      return Object.keys(servers).length;
    }
    return 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Properties: aggregateMcpFiles
// ---------------------------------------------------------------------------

describe("aggregateMcpFiles properties", () => {
  it("server count equals sum of servers across all mcp file entries", () => {
    fc.assert(
      fc.property(
        fc.array(mcpFileEntryArb, { minLength: 0, maxLength: 3 }),
        (mcpFiles) => {
          const result = aggregateMcpFiles(mcpFiles);
          const expectedCount = mcpFiles.reduce(
            (sum, entry) => sum + countServersInEntry(entry),
            0,
          );
          expect(result).toHaveLength(expectedCount);
        },
      ),
      { numRuns: 30 },
    );
  });

  it("every server has non-empty source, scope, and filePath from its FileEntry", () => {
    fc.assert(
      fc.property(
        fc.array(mcpFileEntryArb, { minLength: 1, maxLength: 3 }),
        (mcpFiles) => {
          const result = aggregateMcpFiles(mcpFiles);
          for (const server of result) {
            expect(server.source).toBeTruthy();
            expect(server.scope).toBeTruthy();
            expect(server.filePath).toBeTruthy();
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it("source and scope on each server match the originating FileEntry", () => {
    fc.assert(
      fc.property(mcpFileEntryArb, (entry) => {
        const result = aggregateMcpFiles([entry]);
        for (const server of result) {
          expect(server.source).toBe(entry.source);
          expect(server.scope).toBe(entry.scope);
          expect(server.filePath).toBe(entry.path);
        }
      }),
      { numRuns: 50 },
    );
  });

  it("malformed JSON entries produce zero servers and no crash", () => {
    fc.assert(
      fc.property(
        fc.array(malformedMcpFileEntryArb, { minLength: 1, maxLength: 5 }),
        (mcpFiles) => {
          const result = aggregateMcpFiles(mcpFiles);
          expect(result).toHaveLength(0);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("entries with no mcpServers key produce zero servers", () => {
    fc.assert(
      fc.property(
        fc.array(noMcpServersFileEntryArb, { minLength: 1, maxLength: 3 }),
        (mcpFiles) => {
          const result = aggregateMcpFiles(mcpFiles);
          expect(result).toHaveLength(0);
        },
      ),
      { numRuns: 30 },
    );
  });

  it("empty mcpFiles array produces empty server list", () => {
    const result = aggregateMcpFiles([]);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseMcpFileEntry: JSON that parses as non-object returns empty
// ---------------------------------------------------------------------------

describe("parseMcpFileEntry guard: non-object JSON", () => {
  it("JSON array content produces zero servers", () => {
    const result = aggregateMcpFiles([
      { path: "/test/.mcp.json", content: '[1,2,3]', scope: "user", source: ".mcp.json" },
    ]);
    expect(result).toHaveLength(0);
  });

  it("JSON string content produces zero servers", () => {
    const result = aggregateMcpFiles([
      { path: "/test/.mcp.json", content: '"hello"', scope: "user", source: ".mcp.json" },
    ]);
    expect(result).toHaveLength(0);
  });

  it("JSON number content produces zero servers", () => {
    const result = aggregateMcpFiles([
      { path: "/test/.mcp.json", content: '42', scope: "user", source: ".mcp.json" },
    ]);
    expect(result).toHaveLength(0);
  });

  it("JSON null content produces zero servers", () => {
    const result = aggregateMcpFiles([
      { path: "/test/.mcp.json", content: 'null', scope: "user", source: ".mcp.json" },
    ]);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseMcpFileEntry: mcpServers key present but not an object
// ---------------------------------------------------------------------------

describe("parseMcpFileEntry guard: mcpServers not an object", () => {
  it("mcpServers as array produces zero servers", () => {
    const result = aggregateMcpFiles([
      { path: "/test/.mcp.json", content: JSON.stringify({ mcpServers: [1, 2] }), scope: "user", source: ".mcp.json" },
    ]);
    expect(result).toHaveLength(0);
  });

  it("mcpServers as string produces zero servers", () => {
    const result = aggregateMcpFiles([
      { path: "/test/.mcp.json", content: JSON.stringify({ mcpServers: "bad" }), scope: "user", source: ".mcp.json" },
    ]);
    expect(result).toHaveLength(0);
  });

  it("mcpServers as null produces zero servers", () => {
    const result = aggregateMcpFiles([
      { path: "/test/.mcp.json", content: JSON.stringify({ mcpServers: null }), scope: "user", source: ".mcp.json" },
    ]);
    expect(result).toHaveLength(0);
  });

  it("mcpServers as number produces zero servers", () => {
    const result = aggregateMcpFiles([
      { path: "/test/.mcp.json", content: JSON.stringify({ mcpServers: 99 }), scope: "user", source: ".mcp.json" },
    ]);
    expect(result).toHaveLength(0);
  });

  it("mcpServers as boolean produces zero servers", () => {
    const result = aggregateMcpFiles([
      { path: "/test/.mcp.json", content: JSON.stringify({ mcpServers: true }), scope: "user", source: ".mcp.json" },
    ]);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// createMcpFileServerConfig: invalid config shapes
// ---------------------------------------------------------------------------

describe("createMcpFileServerConfig guard: invalid server config", () => {
  it("server config as array produces invalid-config warning", () => {
    const result = aggregateMcpFiles([
      { path: "/f.json", content: JSON.stringify({ mcpServers: { "srv": [1, 2] } }), scope: "project", source: ".claude.json" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].warnings).toContain("Invalid server configuration");
    expect(result[0].command).toBe("");
    expect(result[0].type).toBe("");
    expect(result[0].args).toEqual([]);
    expect(result[0].env).toEqual([]);
  });

  it("server config as null produces invalid-config warning", () => {
    const result = aggregateMcpFiles([
      { path: "/f.json", content: JSON.stringify({ mcpServers: { "srv": null } }), scope: "project", source: ".claude.json" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].warnings).toContain("Invalid server configuration");
  });

  it("server config as string produces invalid-config warning", () => {
    const result = aggregateMcpFiles([
      { path: "/f.json", content: JSON.stringify({ mcpServers: { "srv": "bad" } }), scope: "project", source: ".claude.json" },
    ]);
    expect(result[0].warnings).toContain("Invalid server configuration");
  });

  it("server config as number produces invalid-config warning", () => {
    const result = aggregateMcpFiles([
      { path: "/f.json", content: JSON.stringify({ mcpServers: { "srv": 42 } }), scope: "project", source: ".claude.json" },
    ]);
    expect(result[0].warnings).toContain("Invalid server configuration");
  });

  it("server config as boolean produces invalid-config warning", () => {
    const result = aggregateMcpFiles([
      { path: "/f.json", content: JSON.stringify({ mcpServers: { "srv": true } }), scope: "project", source: ".claude.json" },
    ]);
    expect(result[0].warnings).toContain("Invalid server configuration");
  });
});

// ---------------------------------------------------------------------------
// createMcpFileServerConfig: command field validation
// ---------------------------------------------------------------------------

describe("createMcpFileServerConfig command validation", () => {
  function mcpFileWith(serverConfig: unknown): FileEntry {
    return {
      path: "/f.json",
      content: JSON.stringify({ mcpServers: { "srv": serverConfig } }),
      scope: "project",
      source: ".claude.json",
    };
  }

  it("non-string command produces missing-command warning", () => {
    const result = aggregateMcpFiles([mcpFileWith({ type: "stdio", command: 123 })]);
    expect(result[0].warnings).toContain("Missing required field: command");
    expect(result[0].command).toBe("");
  });

  it("null command produces missing-command warning", () => {
    const result = aggregateMcpFiles([mcpFileWith({ type: "stdio", command: null })]);
    expect(result[0].warnings).toContain("Missing required field: command");
    expect(result[0].command).toBe("");
  });

  it("empty string command produces missing-command warning", () => {
    const result = aggregateMcpFiles([mcpFileWith({ type: "stdio", command: "" })]);
    expect(result[0].warnings).toContain("Missing required field: command");
    expect(result[0].command).toBe("");
  });

  it("missing command field produces missing-command warning", () => {
    const result = aggregateMcpFiles([mcpFileWith({ type: "stdio" })]);
    expect(result[0].warnings).toContain("Missing required field: command");
  });

  it("valid string command has no warnings", () => {
    const result = aggregateMcpFiles([mcpFileWith({ type: "stdio", command: "npx srv" })]);
    expect(result[0].warnings).toEqual([]);
    expect(result[0].command).toBe("npx srv");
  });
});

// ---------------------------------------------------------------------------
// createMcpFileServerConfig: type field extraction
// ---------------------------------------------------------------------------

describe("createMcpFileServerConfig type extraction", () => {
  function mcpFileWith(serverConfig: unknown): FileEntry {
    return {
      path: "/f.json",
      content: JSON.stringify({ mcpServers: { "srv": serverConfig } }),
      scope: "project",
      source: ".claude.json",
    };
  }

  it("non-string type defaults to empty string", () => {
    const result = aggregateMcpFiles([mcpFileWith({ type: 42, command: "cmd" })]);
    expect(result[0].type).toBe("");
  });

  it("missing type defaults to empty string", () => {
    const result = aggregateMcpFiles([mcpFileWith({ command: "cmd" })]);
    expect(result[0].type).toBe("");
  });

  it("valid string type is preserved", () => {
    const result = aggregateMcpFiles([mcpFileWith({ type: "sse", command: "cmd" })]);
    expect(result[0].type).toBe("sse");
  });
});

// ---------------------------------------------------------------------------
// createMcpFileServerConfig: args field extraction
// ---------------------------------------------------------------------------

describe("createMcpFileServerConfig args extraction", () => {
  function mcpFileWith(serverConfig: unknown): FileEntry {
    return {
      path: "/f.json",
      content: JSON.stringify({ mcpServers: { "srv": serverConfig } }),
      scope: "project",
      source: ".claude.json",
    };
  }

  it("non-array args defaults to empty array", () => {
    const result = aggregateMcpFiles([mcpFileWith({ command: "cmd", args: "not-array" })]);
    expect(result[0].args).toEqual([]);
  });

  it("null args defaults to empty array", () => {
    const result = aggregateMcpFiles([mcpFileWith({ command: "cmd", args: null })]);
    expect(result[0].args).toEqual([]);
  });

  it("args containing non-strings are filtered out", () => {
    const result = aggregateMcpFiles([mcpFileWith({ command: "cmd", args: ["valid", 42, null, "also-valid"] })]);
    expect(result[0].args).toEqual(["valid", "also-valid"]);
  });

  it("missing args defaults to empty array", () => {
    const result = aggregateMcpFiles([mcpFileWith({ command: "cmd" })]);
    expect(result[0].args).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createMcpFileServerConfig: filePath, scope, source from FileEntry
// ---------------------------------------------------------------------------

describe("createMcpFileServerConfig attribution from FileEntry", () => {
  it("invalid server config still carries filePath, scope, source from entry", () => {
    const result = aggregateMcpFiles([
      { path: "/plugins/x/.mcp.json", content: JSON.stringify({ mcpServers: { "srv": null } }), scope: "plugin", source: "x-plugin" },
    ]);
    expect(result[0].filePath).toBe("/plugins/x/.mcp.json");
    expect(result[0].scope).toBe("plugin");
    expect(result[0].source).toBe("x-plugin");
  });

  it("valid server config carries filePath, scope, source from entry", () => {
    const result = aggregateMcpFiles([
      { path: "/home/.claude.json", content: JSON.stringify({ mcpServers: { "srv": { type: "stdio", command: "cmd" } } }), scope: "user", source: ".claude.json" },
    ]);
    expect(result[0].filePath).toBe("/home/.claude.json");
    expect(result[0].scope).toBe("user");
    expect(result[0].source).toBe(".claude.json");
  });
});

// ---------------------------------------------------------------------------
// aggregateConfig: mcpFiles merge at line 452
// ---------------------------------------------------------------------------

describe("aggregateConfig mcpFiles merge", () => {
  it("null mcpFiles on rawConfig produces only settings servers", () => {
    const settingsContent = JSON.stringify({
      mcpServers: { "s1": { type: "stdio", command: "cmd", args: [] } },
    });
    const rawConfig: RawClaudeConfig = {
      agents: [],
      commands: [],
      skills: [],
      settings: { path: "~/.claude/settings.json", content: settingsContent, scope: "user", source: "user" },
      hooks: [],
      rules: [],
      claudeMdFiles: [],
      installedPlugins: null,
      pluginDetails: [],
      mcpFiles: undefined as unknown as FileEntry[],
      errors: [],
      scope: "both",
    };
    const result = aggregateConfig(rawConfig);
    expect(result.mcpServers).toHaveLength(1);
    expect(result.mcpServers[0].name).toBe("s1");
    expect(result.mcpServers[0].source).toBe("settings.json");
  });

  it("empty mcpFiles array produces only settings servers", () => {
    const settingsContent = JSON.stringify({
      mcpServers: { "s1": { type: "stdio", command: "cmd", args: [] } },
    });
    const rawConfig: RawClaudeConfig = {
      agents: [],
      commands: [],
      skills: [],
      settings: { path: "~/.claude/settings.json", content: settingsContent, scope: "user", source: "user" },
      hooks: [],
      rules: [],
      claudeMdFiles: [],
      installedPlugins: null,
      pluginDetails: [],
      mcpFiles: [],
      errors: [],
      scope: "both",
    };
    const result = aggregateConfig(rawConfig);
    expect(result.mcpServers).toHaveLength(1);
    expect(result.mcpServers[0].source).toBe("settings.json");
  });

  it("no settings + mcpFiles produces only mcpFiles servers", () => {
    const mcpContent = JSON.stringify({
      mcpServers: { "f1": { type: "sse", command: "fcmd", args: [] } },
    });
    const rawConfig: RawClaudeConfig = {
      agents: [],
      commands: [],
      skills: [],
      settings: null,
      hooks: [],
      rules: [],
      claudeMdFiles: [],
      installedPlugins: null,
      pluginDetails: [],
      mcpFiles: [{ path: "/p/.mcp.json", content: mcpContent, scope: "project", source: ".mcp.json" }],
      errors: [],
      scope: "both",
    };
    const result = aggregateConfig(rawConfig);
    expect(result.mcpServers).toHaveLength(1);
    expect(result.mcpServers[0].name).toBe("f1");
    expect(result.mcpServers[0].source).toBe(".mcp.json");
  });

  it("multiple mcpFiles accumulate all servers with settings servers", () => {
    const settingsContent = JSON.stringify({
      mcpServers: { "s1": { type: "stdio", command: "scmd", args: [] } },
    });
    const file1 = JSON.stringify({
      mcpServers: { "f1": { type: "stdio", command: "fcmd1", args: [] } },
    });
    const file2 = JSON.stringify({
      mcpServers: {
        "f2a": { type: "sse", command: "fcmd2a", args: [] },
        "f2b": { type: "sse", command: "fcmd2b", args: [] },
      },
    });
    const rawConfig: RawClaudeConfig = {
      agents: [],
      commands: [],
      skills: [],
      settings: { path: "~/.claude/settings.json", content: settingsContent, scope: "user", source: "user" },
      hooks: [],
      rules: [],
      claudeMdFiles: [],
      installedPlugins: null,
      pluginDetails: [],
      mcpFiles: [
        { path: "/a/.mcp.json", content: file1, scope: "project", source: ".mcp.json" },
        { path: "/b/.mcp.json", content: file2, scope: "plugin", source: "slack" },
      ],
      errors: [],
      scope: "both",
    };
    const result = aggregateConfig(rawConfig);
    expect(result.mcpServers).toHaveLength(4);
    const names = result.mcpServers.map((s) => s.name);
    expect(names).toContain("s1");
    expect(names).toContain("f1");
    expect(names).toContain("f2a");
    expect(names).toContain("f2b");
  });
});

// ---------------------------------------------------------------------------
// Properties: aggregateConfig merges mcpFiles with settings servers
// ---------------------------------------------------------------------------

describe("aggregateConfig MCP merging", () => {
  it("merges MCP servers from settings and mcpFiles into single list", () => {
    const settingsContent = JSON.stringify({
      mcpServers: {
        "settings-server": { type: "stdio", command: "settings-cmd", args: [] },
      },
    });
    const mcpFileContent = JSON.stringify({
      mcpServers: {
        "file-server": { type: "sse", command: "file-cmd", args: [] },
      },
    });

    const rawConfig: RawClaudeConfig = {
      agents: [],
      commands: [],
      skills: [],
      settings: { path: "~/.claude/settings.json", content: settingsContent, scope: "user", source: "user" },
      hooks: [],
      rules: [],
      claudeMdFiles: [],
      installedPlugins: null,
      pluginDetails: [],
      mcpFiles: [
        { path: "./.claude.json", content: mcpFileContent, scope: "project", source: ".claude.json" },
      ],
      errors: [],
      scope: "both",
    };

    const result = aggregateConfig(rawConfig);
    expect(result.mcpServers).toHaveLength(2);

    const names = result.mcpServers.map((s) => s.name);
    expect(names).toContain("settings-server");
    expect(names).toContain("file-server");
  });

  it("settings-only servers have source 'settings.json'", () => {
    const settingsContent = JSON.stringify({
      mcpServers: {
        "my-server": { type: "stdio", command: "cmd", args: [] },
      },
    });

    const rawConfig: RawClaudeConfig = {
      agents: [],
      commands: [],
      skills: [],
      settings: { path: "~/.claude/settings.json", content: settingsContent, scope: "user", source: "user" },
      hooks: [],
      rules: [],
      claudeMdFiles: [],
      installedPlugins: null,
      pluginDetails: [],
      mcpFiles: [],
      errors: [],
      scope: "both",
    };

    const result = aggregateConfig(rawConfig);
    expect(result.mcpServers).toHaveLength(1);
    expect(result.mcpServers[0].source).toBe("settings.json");
  });

  it("mcpFiles servers carry source from FileEntry, not 'settings.json'", () => {
    const mcpFileContent = JSON.stringify({
      mcpServers: {
        "discord-mcp": { type: "stdio", command: "discord-cmd", args: [] },
      },
    });

    const rawConfig: RawClaudeConfig = {
      agents: [],
      commands: [],
      skills: [],
      settings: null,
      hooks: [],
      rules: [],
      claudeMdFiles: [],
      installedPlugins: null,
      pluginDetails: [],
      mcpFiles: [
        { path: "/plugins/discord/.mcp.json", content: mcpFileContent, scope: "plugin", source: "discord" },
      ],
      errors: [],
      scope: "both",
    };

    const result = aggregateConfig(rawConfig);
    expect(result.mcpServers).toHaveLength(1);
    expect(result.mcpServers[0].source).toBe("discord");
    expect(result.mcpServers[0].scope).toBe("plugin");
    expect(result.mcpServers[0].filePath).toBe("/plugins/discord/.mcp.json");
  });

  it("property: every MCP server has non-empty source attribution regardless of origin", () => {
    fc.assert(
      fc.property(
        fc.array(mcpFileEntryArb, { minLength: 0, maxLength: 3 }),
        (mcpFiles) => {
          const rawConfig: RawClaudeConfig = {
            agents: [],
            commands: [],
            skills: [],
            settings: null,
            hooks: [],
            rules: [],
            claudeMdFiles: [],
            installedPlugins: null,
            pluginDetails: [],
            mcpFiles,
            errors: [],
            scope: "both",
          };

          const result = aggregateConfig(rawConfig);
          for (const server of result.mcpServers) {
            expect(server.source).toBeTruthy();
            expect(server.scope).toBeTruthy();
            expect(server.filePath).toBeTruthy();
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
