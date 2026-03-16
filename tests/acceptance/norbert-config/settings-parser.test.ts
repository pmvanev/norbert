/**
 * Acceptance tests: Settings Parsing -- Hooks, MCP Servers, Rules, Plugins (US-003, US-004, US-005)
 *
 * Validates that settings.json is parsed into structured domain objects
 * for hooks, MCP servers, rules, and plugins. Covers happy paths,
 * missing sections, malformed JSON, and field validation.
 *
 * Driving ports: pure domain function (parseSettings)
 * These tests exercise the data transformation that feeds multiple tabs,
 * not the React rendering.
 *
 * Traces to: US-003, US-004, US-005 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import {
  parseSettings,
  type SettingsParseResult,
} from "../../../src/plugins/norbert-config/domain/settingsParser";

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User views hook bindings to verify configuration", () => {
  it("parses settings into structured hook definitions with event, command, and matchers", () => {
    // Given settings.json with 3 hook bindings configured
    const settingsJson = JSON.stringify({
      hooks: {
        PreToolUse: [
          {
            command: "/usr/local/bin/norbert-hook",
            matchers: ["Bash", "Write", "Edit", "MultiEdit"],
          },
        ],
        PostToolUse: [
          {
            command: "/usr/local/bin/norbert-hook",
            matchers: ["Bash", "Write", "Edit", "MultiEdit"],
          },
        ],
        Notification: [
          {
            command: "/usr/local/bin/norbert-hook",
          },
        ],
      },
    });

    // When settings are parsed
    const result = parseSettings(settingsJson);

    // Then parsing succeeds
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    // And 3 hook bindings are extracted
    expect(result.hooks).toHaveLength(3);

    // And the PreToolUse hook shows the command and matchers
    const preToolUse = result.hooks.find((h) => h.event === "PreToolUse");
    expect(preToolUse).toBeDefined();
    expect(preToolUse!.command).toBe("/usr/local/bin/norbert-hook");
    expect(preToolUse!.matchers).toEqual(["Bash", "Write", "Edit", "MultiEdit"]);

    // And the Notification hook shows no matchers
    const notification = result.hooks.find((h) => h.event === "Notification");
    expect(notification).toBeDefined();
    expect(notification!.matchers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Hooks
// ---------------------------------------------------------------------------

describe("Hook with no matchers displays no matcher indication", () => {
  it("returns empty matchers array for hooks without matcher patterns", () => {
    // Given a hook binding with no matchers declared
    const settingsJson = JSON.stringify({
      hooks: {
        Notification: [
          { command: "/usr/local/bin/norbert-hook" },
        ],
      },
    });

    // When settings are parsed
    const result = parseSettings(settingsJson);

    // Then the hook has an empty matchers list
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;
    expect(result.hooks[0].matchers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: MCP Servers
// ---------------------------------------------------------------------------

describe("MCP server parsed with connection details and environment", () => {
  it("extracts name, type, command, args, and env vars from server config", () => {
    // Given settings.json with 2 MCP servers configured
    const settingsJson = JSON.stringify({
      mcpServers: {
        "filesystem-server": {
          type: "stdio",
          command: "npx",
          args: ["@anthropic/mcp-filesystem", "/home/ravi/projects"],
        },
        "github-server": {
          type: "stdio",
          command: "npx",
          args: ["@anthropic/mcp-github"],
          env: {
            GITHUB_TOKEN: "ghp_abc123def456",
          },
        },
      },
    });

    // When settings are parsed
    const result = parseSettings(settingsJson);

    // Then 2 MCP servers are extracted
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;
    expect(result.mcpServers).toHaveLength(2);

    // And filesystem-server shows type, command, and args
    const fsServer = result.mcpServers.find((s) => s.name === "filesystem-server");
    expect(fsServer).toBeDefined();
    expect(fsServer!.type).toBe("stdio");
    expect(fsServer!.command).toBe("npx");
    expect(fsServer!.args).toContain("/home/ravi/projects");

    // And github-server shows env var with key and value
    const ghServer = result.mcpServers.find((s) => s.name === "github-server");
    expect(ghServer).toBeDefined();
    expect(ghServer!.env).toEqual([{ key: "GITHUB_TOKEN", value: "ghp_abc123def456" }]);
  });
});

describe("MCP server with missing command field shows warning", () => {
  it("includes a warning about the missing required field", () => {
    // Given an MCP server entry missing the "command" field
    const settingsJson = JSON.stringify({
      mcpServers: {
        "broken-server": {
          type: "stdio",
        },
      },
    });

    // When settings are parsed
    const result = parseSettings(settingsJson);

    // Then the server card includes a warning
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;
    expect(result.mcpServers).toHaveLength(1);
    expect(result.mcpServers[0].name).toBe("broken-server");
    expect(result.mcpServers[0].warnings).toContain("Missing required field: command");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Rules and Plugins
// ---------------------------------------------------------------------------

describe("Rules extracted from settings with source annotation", () => {
  it("parses rules array from settings.json", () => {
    // Given settings.json with 3 rules configured
    const settingsJson = JSON.stringify({
      rules: [
        "Always use TypeScript strict mode",
        "Follow functional programming paradigm",
        "Write tests before implementation",
      ],
    });

    // When settings are parsed
    const result = parseSettings(settingsJson);

    // Then 3 rules are extracted
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;
    expect(result.rules).toHaveLength(3);
    expect(result.rules[0].text).toBe("Always use TypeScript strict mode");
    expect(result.rules[1].text).toBe("Follow functional programming paradigm");
  });
});

describe("Plugins extracted from settings", () => {
  it("parses plugin entries from settings.json", () => {
    // Given settings.json with 2 plugins listed
    const settingsJson = JSON.stringify({
      plugins: [
        { name: "norbert-session", version: "1.0.0" },
        { name: "norbert-usage", version: "1.2.0" },
      ],
    });

    // When settings are parsed
    const result = parseSettings(settingsJson);

    // Then 2 plugins are extracted
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;
    expect(result.plugins).toHaveLength(2);
    expect(result.plugins[0].name).toBe("norbert-session");
    expect(result.plugins[1].version).toBe("1.2.0");
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("Malformed settings file returns parse error with message", () => {
  it("returns error result for invalid content", () => {
    // Given settings.json with a syntax error (missing comma)
    const malformedJson = '{ "hooks": { "PreToolUse": [ { "command": "/bin/hook" "matchers": [] } ] } }';

    // When settings are parsed
    const result = parseSettings(malformedJson);

    // Then a parse error is returned
    expect(result.tag).toBe("error");
    if (result.tag !== "error") return;
    expect(result.message).toBeTruthy();
  });
});

describe("Missing hooks section returns empty hooks list", () => {
  it("returns empty hooks array when hooks key is absent", () => {
    // Given settings.json with no hooks section
    const settingsJson = JSON.stringify({
      mcpServers: {},
    });

    // When settings are parsed
    const result = parseSettings(settingsJson);

    // Then hooks list is empty
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;
    expect(result.hooks).toEqual([]);
  });
});

describe("Missing MCP servers section returns empty servers list", () => {
  it("returns empty mcpServers array when mcpServers key is absent", () => {
    // Given settings.json with no mcpServers section
    const settingsJson = JSON.stringify({
      hooks: {},
    });

    // When settings are parsed
    const result = parseSettings(settingsJson);

    // Then MCP servers list is empty
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;
    expect(result.mcpServers).toEqual([]);
  });
});
