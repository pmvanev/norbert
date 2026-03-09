/**
 * Acceptance tests: Plugin directory structure for Claude marketplace
 *
 * Validates that the plugin/ directory contains correctly structured
 * static JSON files that Claude's plugin framework can consume.
 *
 * Driving ports: static file content validation against domain constants.
 * These tests invoke through the plugin file contents and domain functions
 * (HOOK_EVENT_NAMES, HOOK_PORT, build_hook_url) -- never internal adapters.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const PLUGIN_DIR = resolve(__dirname, "../../../plugin");
const PLUGIN_MANIFEST = resolve(PLUGIN_DIR, ".claude-plugin/plugin.json");
const HOOKS_FILE = resolve(PLUGIN_DIR, "hooks/hooks.json");
const MCP_FILE = resolve(PLUGIN_DIR, ".mcp.json");

// Domain constants -- shared artifacts that must stay consistent
const EXPECTED_EVENT_NAMES = [
  "PreToolUse",
  "PostToolUse",
  "SubagentStop",
  "Stop",
  "SessionStart",
  "UserPromptSubmit",
] as const;
const EXPECTED_PORT = 3748;

function readJsonFile(path: string): unknown {
  const content = readFileSync(path, "utf-8");
  return JSON.parse(content);
}

// @walking_skeleton
describe("Plugin package contains all required files for marketplace discovery", () => {
  it("plugin manifest is present with the name 'norbert'", () => {
    expect(existsSync(PLUGIN_MANIFEST)).toBe(true);
    const manifest = readJsonFile(PLUGIN_MANIFEST) as Record<string, unknown>;
    expect(manifest.name).toBe("norbert");
  });

  it("hook definitions are present for all 6 event types", () => {
    expect(existsSync(HOOKS_FILE)).toBe(true);
    const hooks = readJsonFile(HOOKS_FILE) as Record<string, unknown>;
    const hooksObj = hooks.hooks as Record<string, unknown>;
    expect(Object.keys(hooksObj)).toHaveLength(6);
  });

  it("MCP server definition is present for 'norbert'", () => {
    expect(existsSync(MCP_FILE)).toBe(true);
    const mcp = readJsonFile(MCP_FILE) as Record<string, unknown>;
    const servers = mcp.mcpServers as Record<string, unknown>;
    expect(servers).toHaveProperty("norbert");
  });
});

describe("Plugin manifest contains required metadata", () => {
  it.skip("plugin name is 'norbert'", () => {
    const manifest = readJsonFile(PLUGIN_MANIFEST) as Record<string, unknown>;
    expect(manifest.name).toBe("norbert");
  });

  it.skip("plugin description is present", () => {
    const manifest = readJsonFile(PLUGIN_MANIFEST) as Record<string, unknown>;
    expect(manifest.description).toBe(
      "Local-first observability for Claude Code sessions"
    );
  });

  it.skip("plugin version is present and non-empty", () => {
    const manifest = readJsonFile(PLUGIN_MANIFEST) as Record<string, unknown>;
    expect(manifest.version).toBeDefined();
    expect(typeof manifest.version).toBe("string");
    expect((manifest.version as string).length).toBeGreaterThan(0);
  });
});

describe("Hook definitions specify exactly 6 event types", () => {
  it.skip("there are exactly 6 hook entries", () => {
    const hooks = readJsonFile(HOOKS_FILE) as Record<string, unknown>;
    const hooksObj = hooks.hooks as Record<string, unknown>;
    expect(Object.keys(hooksObj)).toHaveLength(6);
  });
});

describe("Each hook entry is configured for non-blocking delivery", () => {
  it.skip("every hook is marked as asynchronous with type 'http'", () => {
    const hooks = readJsonFile(HOOKS_FILE) as Record<string, unknown>;
    const hooksObj = hooks.hooks as Record<string, unknown[]>;
    for (const [, entries] of Object.entries(hooksObj)) {
      for (const entry of entries as Array<Record<string, unknown>>) {
        expect(entry.async).toBe(true);
        expect(entry.type).toBe("http");
      }
    }
  });
});

describe("Hook URLs point to the correct receiver port", () => {
  it.skip("every hook URL targets localhost on port 3748", () => {
    const hooks = readJsonFile(HOOKS_FILE) as Record<string, unknown>;
    const hooksObj = hooks.hooks as Record<string, unknown[]>;
    for (const [, entries] of Object.entries(hooksObj)) {
      for (const entry of entries as Array<Record<string, unknown>>) {
        const url = entry.url as string;
        expect(url).toContain(`localhost:${EXPECTED_PORT}`);
      }
    }
  });
});

describe("Hook event names match the app's recognized event types", () => {
  it.skip("hooks file contains exactly the same 6 event names as the app", () => {
    const hooks = readJsonFile(HOOKS_FILE) as Record<string, unknown>;
    const hooksObj = hooks.hooks as Record<string, unknown>;
    const hookNames = Object.keys(hooksObj).sort();
    const expectedNames = [...EXPECTED_EVENT_NAMES].sort();
    expect(hookNames).toEqual(expectedNames);
  });
});

// @property
describe("Every hook URL is parseable back to a recognized event type", () => {
  it.skip("extracted event name from each URL path is a recognized event type", () => {
    const hooks = readJsonFile(HOOKS_FILE) as Record<string, unknown>;
    const hooksObj = hooks.hooks as Record<string, unknown[]>;
    for (const [eventName, entries] of Object.entries(hooksObj)) {
      for (const entry of entries as Array<Record<string, unknown>>) {
        const url = entry.url as string;
        const pathSegment = url.split("/").pop();
        expect(pathSegment).toBe(eventName);
        expect(EXPECTED_EVENT_NAMES).toContain(pathSegment);
      }
    }
  });
});

describe("MCP configuration defines the norbert server", () => {
  it.skip("server named 'norbert' with stdio transport and correct command", () => {
    const mcp = readJsonFile(MCP_FILE) as Record<string, unknown>;
    const servers = mcp.mcpServers as Record<string, Record<string, unknown>>;
    const norbert = servers.norbert;
    expect(norbert).toBeDefined();
    expect(norbert.type).toBe("stdio");
    expect(norbert.command).toBe("norbert-cc");
    expect(norbert.args).toEqual(["mcp"]);
  });
});

describe("Plugin files contain no dynamic or templated values", () => {
  it.skip("no placeholder tokens or environment variable references in any file", () => {
    const files = [PLUGIN_MANIFEST, HOOKS_FILE, MCP_FILE];
    for (const filePath of files) {
      const content = readFileSync(filePath, "utf-8");
      expect(content).not.toMatch(/\$\{/); // no ${VAR} templates
      expect(content).not.toMatch(/\{\{/); // no {{handlebars}} templates
      expect(content).not.toMatch(/process\.env/); // no env references
    }
  });
});
