/**
 * Acceptance tests: Configuration Aggregation (US-001, US-005, US-006, US-007)
 *
 * Validates that raw config data from .claude/ directories is aggregated
 * into a unified, scope-annotated structure ready for all 7 tabs.
 * Covers full directory parsing, partial directories, per-file error
 * isolation, and dual-scope merging.
 *
 * Driving ports: pure domain function (aggregateConfig)
 * These tests exercise the data aggregation that feeds the Configuration
 * Viewer, not the React rendering or Rust filesystem reader.
 *
 * Traces to: US-001, US-005, US-006, US-007 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import {
  aggregateConfig,
  type RawClaudeConfig,
  type AggregatedConfig,
  type FileEntry,
  type ReadErrorInfo,
} from "../../../src/plugins/norbert-config/domain/configAggregator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fileEntry = (path: string, content: string, scope: "user" | "project"): FileEntry => ({
  path,
  content,
  scope,
});

const readError = (path: string, error: string, scope: "user" | "project"): ReadErrorInfo => ({
  path,
  error,
  scope,
});

const emptyConfig = (scope: "user" | "project"): RawClaudeConfig => ({
  agents: [],
  commands: [],
  settings: null,
  claudeMdFiles: [],
  errors: [],
  scope,
});

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User sees all configuration categories from .claude/ directory", () => {
  it("aggregates agents, hooks, skills, rules, MCP servers, and docs into unified view", () => {
    // Given a .claude/ directory with agents, commands, settings, and CLAUDE.md
    const rawConfig: RawClaudeConfig = {
      agents: [
        fileEntry(
          "~/.claude/agents/software-crafter.md",
          "---\nmodel: opus-4\ntools:\n  - Bash\n  - Read\n---\n\nYou are a software crafter.",
          "user",
        ),
        fileEntry(
          "~/.claude/agents/reviewer.md",
          "---\nmodel: sonnet-4\n---\n\nReview code for quality.",
          "user",
        ),
      ],
      commands: [
        fileEntry(
          "~/.claude/commands/deploy.md",
          "# Deploy to staging\n\nDeploy the current branch.",
          "user",
        ),
      ],
      settings: fileEntry(
        "~/.claude/settings.json",
        JSON.stringify({
          hooks: {
            PreToolUse: [{ command: "/usr/local/bin/norbert-hook", matchers: ["Bash"] }],
          },
          mcpServers: {
            "fs-server": { type: "stdio", command: "npx", args: ["@anthropic/mcp-filesystem"] },
          },
          rules: ["Use TypeScript strict mode"],
        }),
        "user",
      ),
      claudeMdFiles: [
        fileEntry("./CLAUDE.md", "# Norbert\n\nLocal-first observability app.", "project"),
      ],
      errors: [],
      scope: "both",
    };

    // When the raw config is aggregated
    const aggregated = aggregateConfig(rawConfig);

    // Then 2 agent definitions are available
    expect(aggregated.agents).toHaveLength(2);

    // And 1 skill definition is available
    expect(aggregated.skills).toHaveLength(1);

    // And 1 hook binding is available
    expect(aggregated.hooks).toHaveLength(1);

    // And 1 MCP server is available
    expect(aggregated.mcpServers).toHaveLength(1);

    // And 1 rule is available
    expect(aggregated.rules).toHaveLength(1);

    // And 1 doc file is available
    expect(aggregated.docs).toHaveLength(1);

    // And no errors occurred
    expect(aggregated.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS
// ---------------------------------------------------------------------------

describe("Missing subdirectories produce empty lists, not errors", () => {
  it("returns empty agents and skills when no agent or command files exist", () => {
    // Given a .claude/ directory with only settings.json (no agents/ or commands/)
    const rawConfig: RawClaudeConfig = {
      ...emptyConfig("user"),
      settings: fileEntry(
        "~/.claude/settings.json",
        JSON.stringify({ hooks: {}, mcpServers: {} }),
        "user",
      ),
    };

    // When the raw config is aggregated
    const aggregated = aggregateConfig(rawConfig);

    // Then agents list is empty
    expect(aggregated.agents).toEqual([]);

    // And skills list is empty
    expect(aggregated.skills).toEqual([]);

    // And no errors are reported
    expect(aggregated.errors).toEqual([]);
  });
});

describe("Both user and project scopes aggregated with source annotations", () => {
  it("combines agents from user and project scopes with scope annotation", () => {
    // Given agents exist in both user (~/.claude/) and project (./.claude/) scopes
    const rawConfig: RawClaudeConfig = {
      agents: [
        fileEntry(
          "~/.claude/agents/global-crafter.md",
          "---\nmodel: opus-4\n---\n\nGlobal crafter agent.",
          "user",
        ),
        fileEntry(
          "./.claude/agents/project-helper.md",
          "---\nmodel: sonnet-4\n---\n\nProject-specific helper.",
          "project",
        ),
      ],
      commands: [],
      settings: null,
      claudeMdFiles: [],
      errors: [],
      scope: "both",
    };

    // When the raw config is aggregated
    const aggregated = aggregateConfig(rawConfig);

    // Then both agents are present
    expect(aggregated.agents).toHaveLength(2);

    // And each carries its source scope
    const userAgent = aggregated.agents.find(
      (a) => a.tag === "parsed" && a.agent.scope === "user",
    );
    const projectAgent = aggregated.agents.find(
      (a) => a.tag === "parsed" && a.agent.scope === "project",
    );
    expect(userAgent).toBeDefined();
    expect(projectAgent).toBeDefined();
  });
});

describe("Doc files passed through with scope and path", () => {
  it("includes CLAUDE.md files with their source paths and scopes", () => {
    // Given CLAUDE.md files at project root and in .claude/
    const rawConfig: RawClaudeConfig = {
      ...emptyConfig("both"),
      claudeMdFiles: [
        fileEntry("./CLAUDE.md", "# Norbert\n\nProject instructions.", "project"),
        fileEntry("~/.claude/CLAUDE.md", "# Memory Index\n\nUser memory.", "user"),
      ],
    };

    // When the raw config is aggregated
    const aggregated = aggregateConfig(rawConfig);

    // Then 2 doc files are available
    expect(aggregated.docs).toHaveLength(2);

    // And each carries its file path and scope
    expect(aggregated.docs[0].filePath).toBe("./CLAUDE.md");
    expect(aggregated.docs[0].scope).toBe("project");
    expect(aggregated.docs[1].filePath).toBe("~/.claude/CLAUDE.md");
    expect(aggregated.docs[1].scope).toBe("user");
  });
});

describe("Agents from both scopes combined in aggregated result", () => {
  it("merges user-level and project-level agent lists", () => {
    // Given 2 user agents and 1 project agent
    const rawConfig: RawClaudeConfig = {
      agents: [
        fileEntry("~/.claude/agents/a.md", "---\nmodel: opus-4\n---\n\nAgent A.", "user"),
        fileEntry("~/.claude/agents/b.md", "---\nmodel: opus-4\n---\n\nAgent B.", "user"),
        fileEntry("./.claude/agents/c.md", "---\nmodel: sonnet-4\n---\n\nAgent C.", "project"),
      ],
      commands: [],
      settings: null,
      claudeMdFiles: [],
      errors: [],
      scope: "both",
    };

    // When the raw config is aggregated
    const aggregated = aggregateConfig(rawConfig);

    // Then all 3 agents are in the result
    expect(aggregated.agents).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("Per-file read errors isolated from successful reads", () => {
  it("returns successful agents alongside errors for unreadable files", () => {
    // Given 3 agent files where 1 produced a read error
    const rawConfig: RawClaudeConfig = {
      agents: [
        fileEntry("~/.claude/agents/good-1.md", "---\nmodel: opus-4\n---\n\nGood agent.", "user"),
        fileEntry("~/.claude/agents/good-2.md", "---\nmodel: sonnet-4\n---\n\nAnother good agent.", "user"),
      ],
      commands: [],
      settings: null,
      claudeMdFiles: [],
      errors: [
        readError("~/.claude/agents/broken.md", "Permission denied", "user"),
      ],
      scope: "user",
    };

    // When the raw config is aggregated
    const aggregated = aggregateConfig(rawConfig);

    // Then 2 agents are successfully parsed
    expect(aggregated.agents).toHaveLength(2);

    // And 1 error is reported for the unreadable file
    expect(aggregated.errors).toHaveLength(1);
    expect(aggregated.errors[0].path).toContain("broken.md");
    expect(aggregated.errors[0].error).toBe("Permission denied");
  });
});

describe("Settings parse error does not break agent and skill lists", () => {
  it("returns agents and skills even when settings.json is malformed", () => {
    // Given agents and commands are readable but settings.json is malformed
    const rawConfig: RawClaudeConfig = {
      agents: [
        fileEntry("~/.claude/agents/crafter.md", "---\nmodel: opus-4\n---\n\nA crafter.", "user"),
      ],
      commands: [
        fileEntry("~/.claude/commands/deploy.md", "# Deploy\n\nDeploy to staging.", "user"),
      ],
      settings: fileEntry(
        "~/.claude/settings.json",
        "{ invalid json }",
        "user",
      ),
      claudeMdFiles: [],
      errors: [],
      scope: "user",
    };

    // When the raw config is aggregated
    const aggregated = aggregateConfig(rawConfig);

    // Then agents are still parsed
    expect(aggregated.agents).toHaveLength(1);

    // And skills are still parsed
    expect(aggregated.skills).toHaveLength(1);

    // And hooks/mcpServers/rules are empty due to the parse error
    expect(aggregated.hooks).toEqual([]);
    expect(aggregated.mcpServers).toEqual([]);
    expect(aggregated.rules).toEqual([]);
  });
});

describe("Completely empty config produces all-empty aggregated result", () => {
  it("returns empty lists for all categories when .claude/ has no files", () => {
    // Given no files exist in .claude/ at all
    const rawConfig: RawClaudeConfig = emptyConfig("both");

    // When the raw config is aggregated
    const aggregated = aggregateConfig(rawConfig);

    // Then all categories are empty
    expect(aggregated.agents).toEqual([]);
    expect(aggregated.skills).toEqual([]);
    expect(aggregated.hooks).toEqual([]);
    expect(aggregated.mcpServers).toEqual([]);
    expect(aggregated.rules).toEqual([]);
    expect(aggregated.plugins).toEqual([]);
    expect(aggregated.docs).toEqual([]);
    expect(aggregated.errors).toEqual([]);
  });
});

describe("Read errors carry scope annotation", () => {
  it("preserves the scope on error entries for source attribution", () => {
    // Given a read error from the project scope
    const rawConfig: RawClaudeConfig = {
      ...emptyConfig("both"),
      errors: [
        readError("./.claude/agents/broken.md", "File not found", "project"),
      ],
    };

    // When the raw config is aggregated
    const aggregated = aggregateConfig(rawConfig);

    // Then the error carries the project scope
    expect(aggregated.errors).toHaveLength(1);
    expect(aggregated.errors[0].scope).toBe("project");
  });
});
