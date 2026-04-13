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
