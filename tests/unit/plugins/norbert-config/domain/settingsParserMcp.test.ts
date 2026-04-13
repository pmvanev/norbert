/**
 * Unit tests: settingsParser -- MCP server config and extractEnvVars
 *
 * Mutation-killing tests targeting:
 *   - createMcpServerConfig guard logic (lines 107-127)
 *   - extractEnvVars guard logic (lines 145-155)
 *   - Source field "settings.json" attribution
 */

import { describe, it, expect } from "vitest";
import {
  parseSettings,
  extractEnvVars,
} from "../../../../../src/plugins/norbert-config/domain/settingsParser";

// ---------------------------------------------------------------------------
// Helper: parse settings with mcpServers and return the MCP server list
// ---------------------------------------------------------------------------

function parseMcpServers(mcpServers: Record<string, unknown>) {
  const result = parseSettings(JSON.stringify({ mcpServers }));
  if (result.tag !== "parsed") throw new Error("Expected parsed result");
  return result.mcpServers;
}

// ---------------------------------------------------------------------------
// createMcpServerConfig: invalid config shapes
// ---------------------------------------------------------------------------

describe("createMcpServerConfig guard conditions", () => {
  it("server config that is an array produces invalid-config warning", () => {
    const servers = parseMcpServers({ "arr-srv": [1, 2, 3] });
    expect(servers).toHaveLength(1);
    expect(servers[0].warnings).toContain("Invalid server configuration");
    expect(servers[0].command).toBe("");
    expect(servers[0].type).toBe("");
    expect(servers[0].args).toEqual([]);
    expect(servers[0].env).toEqual([]);
    expect(servers[0].filePath).toBe("");
  });

  it("server config that is null produces invalid-config warning", () => {
    const servers = parseMcpServers({ "null-srv": null });
    expect(servers).toHaveLength(1);
    expect(servers[0].warnings).toContain("Invalid server configuration");
  });

  it("server config that is a string produces invalid-config warning", () => {
    const servers = parseMcpServers({ "str-srv": "just-a-string" });
    expect(servers).toHaveLength(1);
    expect(servers[0].warnings).toContain("Invalid server configuration");
  });

  it("server config that is a number produces invalid-config warning", () => {
    const servers = parseMcpServers({ "num-srv": 42 });
    expect(servers).toHaveLength(1);
    expect(servers[0].warnings).toContain("Invalid server configuration");
  });

  it("server config that is a boolean produces invalid-config warning", () => {
    const servers = parseMcpServers({ "bool-srv": true });
    expect(servers).toHaveLength(1);
    expect(servers[0].warnings).toContain("Invalid server configuration");
  });
});

// ---------------------------------------------------------------------------
// createMcpServerConfig: command field validation
// ---------------------------------------------------------------------------

describe("createMcpServerConfig command validation", () => {
  it("non-string command produces missing-command warning", () => {
    const servers = parseMcpServers({ "srv": { type: "stdio", command: 123 } });
    expect(servers).toHaveLength(1);
    expect(servers[0].warnings).toContain("Missing required field: command");
    expect(servers[0].command).toBe("");
  });

  it("null command produces missing-command warning", () => {
    const servers = parseMcpServers({ "srv": { type: "stdio", command: null } });
    expect(servers[0].warnings).toContain("Missing required field: command");
    expect(servers[0].command).toBe("");
  });

  it("empty string command produces missing-command warning", () => {
    const servers = parseMcpServers({ "srv": { type: "stdio", command: "" } });
    expect(servers[0].warnings).toContain("Missing required field: command");
    expect(servers[0].command).toBe("");
  });

  it("missing command field produces missing-command warning", () => {
    const servers = parseMcpServers({ "srv": { type: "stdio" } });
    expect(servers[0].warnings).toContain("Missing required field: command");
  });

  it("valid string command has no command warning", () => {
    const servers = parseMcpServers({
      "srv": { type: "stdio", command: "npx my-server" },
    });
    expect(servers[0].warnings).toEqual([]);
    expect(servers[0].command).toBe("npx my-server");
    expect(servers[0].filePath).toBe("");
  });
});

// ---------------------------------------------------------------------------
// createMcpServerConfig: type field extraction
// ---------------------------------------------------------------------------

describe("createMcpServerConfig type extraction", () => {
  it("non-string type defaults to empty string", () => {
    const servers = parseMcpServers({ "srv": { type: 42, command: "cmd" } });
    expect(servers[0].type).toBe("");
  });

  it("missing type defaults to empty string", () => {
    const servers = parseMcpServers({ "srv": { command: "cmd" } });
    expect(servers[0].type).toBe("");
  });

  it("valid string type is preserved", () => {
    const servers = parseMcpServers({ "srv": { type: "sse", command: "cmd" } });
    expect(servers[0].type).toBe("sse");
  });
});

// ---------------------------------------------------------------------------
// createMcpServerConfig: args field extraction
// ---------------------------------------------------------------------------

describe("createMcpServerConfig args extraction", () => {
  it("non-array args defaults to empty array", () => {
    const servers = parseMcpServers({
      "srv": { type: "stdio", command: "cmd", args: "not-array" },
    });
    expect(servers[0].args).toEqual([]);
  });

  it("null args defaults to empty array", () => {
    const servers = parseMcpServers({
      "srv": { type: "stdio", command: "cmd", args: null },
    });
    expect(servers[0].args).toEqual([]);
  });

  it("args containing non-strings are filtered out", () => {
    const servers = parseMcpServers({
      "srv": {
        type: "stdio",
        command: "cmd",
        args: ["valid", 42, null, "also-valid", true, undefined],
      },
    });
    expect(servers[0].args).toEqual(["valid", "also-valid"]);
  });

  it("args with only strings preserves all", () => {
    const servers = parseMcpServers({
      "srv": { type: "stdio", command: "cmd", args: ["--flag", "value"] },
    });
    expect(servers[0].args).toEqual(["--flag", "value"]);
  });

  it("missing args field defaults to empty array", () => {
    const servers = parseMcpServers({ "srv": { type: "stdio", command: "cmd" } });
    expect(servers[0].args).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createMcpServerConfig: source attribution
// ---------------------------------------------------------------------------

describe("createMcpServerConfig source attribution", () => {
  it("source is always 'settings.json'", () => {
    const servers = parseMcpServers({
      "srv": { type: "stdio", command: "cmd", args: [] },
    });
    expect(servers[0].source).toBe("settings.json");
  });

  it("invalid config also has source 'settings.json'", () => {
    const servers = parseMcpServers({ "srv": null });
    expect(servers[0].source).toBe("settings.json");
  });

  it("scope from parseSettings propagates to server config", () => {
    const result = parseSettings(
      JSON.stringify({ mcpServers: { "srv": { type: "stdio", command: "cmd" } } }),
      "project",
    );
    if (result.tag !== "parsed") throw new Error("Expected parsed result");
    expect(result.mcpServers[0].scope).toBe("project");
  });
});

// ---------------------------------------------------------------------------
// extractEnvVars: guard conditions
// ---------------------------------------------------------------------------

describe("extractEnvVars guard conditions", () => {
  it("null input returns empty array", () => {
    expect(extractEnvVars(null)).toEqual([]);
  });

  it("undefined input returns empty array", () => {
    expect(extractEnvVars(undefined)).toEqual([]);
  });

  it("array input returns empty array", () => {
    expect(extractEnvVars(["key", "value"])).toEqual([]);
  });

  it("string input returns empty array", () => {
    expect(extractEnvVars("not-an-object")).toEqual([]);
  });

  it("number input returns empty array", () => {
    expect(extractEnvVars(42)).toEqual([]);
  });

  it("boolean input returns empty array", () => {
    expect(extractEnvVars(true)).toEqual([]);
  });

  it("valid object extracts string key-value pairs", () => {
    const result = extractEnvVars({ API_KEY: "secret", PORT: "3000" });
    expect(result).toEqual([
      { key: "API_KEY", value: "secret" },
      { key: "PORT", value: "3000" },
    ]);
  });

  it("filters out non-string values from env object", () => {
    const result = extractEnvVars({
      GOOD: "yes",
      BAD_NUM: 42,
      BAD_NULL: null,
      ALSO_GOOD: "ok",
      BAD_BOOL: true,
    });
    expect(result).toEqual([
      { key: "GOOD", value: "yes" },
      { key: "ALSO_GOOD", value: "ok" },
    ]);
  });

  it("empty object returns empty array", () => {
    expect(extractEnvVars({})).toEqual([]);
  });
});
