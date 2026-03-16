/**
 * Unit tests: norbert-config domain types
 *
 * Verifies that all algebraic data types are importable from domain/types
 * and that discriminated unions work correctly with tag-based narrowing.
 *
 * Traces to: Step 01-01 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import type {
  ConfigScope,
  AgentDefinition,
  HookConfig,
  McpServerConfig,
  EnvVar,
  SkillDefinition,
  RuleEntry,
  PluginInfo,
  DocFile,
  ReadErrorInfo,
  AggregatedConfig,
  ConfigReadResult,
  SettingsParseResult,
  AgentParseResult,
  ConfigSubTab,
} from "../../../../../src/plugins/norbert-config/domain/types";
import { CONFIG_SUB_TABS } from "../../../../../src/plugins/norbert-config/domain/types";

// ---------------------------------------------------------------------------
// Discriminated union: ConfigReadResult
// ---------------------------------------------------------------------------

describe("ConfigReadResult discriminated union", () => {
  it("narrows to loaded variant with tag", () => {
    const result: ConfigReadResult = {
      tag: "loaded",
      config: {
        agents: [],
        hooks: [],
        projectHooks: [],
        mcpServers: [],
        skills: [],
        rules: [],
        plugins: [],
        docs: [],
        errors: [],
      },
    };

    expect(result.tag).toBe("loaded");
    if (result.tag === "loaded") {
      expect(result.config.agents).toEqual([]);
    }
  });

  it("narrows to error variant with tag", () => {
    const result: ConfigReadResult = {
      tag: "error",
      message: "Failed to read config",
    };

    expect(result.tag).toBe("error");
    if (result.tag === "error") {
      expect(result.message).toBe("Failed to read config");
    }
  });
});

// ---------------------------------------------------------------------------
// Discriminated union: SettingsParseResult
// ---------------------------------------------------------------------------

describe("SettingsParseResult discriminated union", () => {
  it("narrows to parsed variant with structured data", () => {
    const result: SettingsParseResult = {
      tag: "parsed",
      hooks: [],
      mcpServers: [],
      rules: [],
      plugins: [],
    };

    expect(result.tag).toBe("parsed");
    if (result.tag === "parsed") {
      expect(result.hooks).toEqual([]);
      expect(result.mcpServers).toEqual([]);
      expect(result.rules).toEqual([]);
      expect(result.plugins).toEqual([]);
    }
  });

  it("narrows to error variant with message", () => {
    const result: SettingsParseResult = {
      tag: "error",
      message: "Invalid JSON",
    };

    expect(result.tag).toBe("error");
    if (result.tag === "error") {
      expect(result.message).toBe("Invalid JSON");
    }
  });
});

// ---------------------------------------------------------------------------
// Discriminated union: AgentParseResult
// ---------------------------------------------------------------------------

describe("AgentParseResult discriminated union", () => {
  it("narrows to parsed variant with agent definition", () => {
    const agent: AgentDefinition = {
      name: "test-agent",
      model: "opus-4",
      toolCount: 2,
      tools: ["Bash", "Read"],
      description: "A test agent",
      systemPrompt: "You are a test agent.",
      filePath: "~/.claude/agents/test-agent.md",
      scope: "user",
    };

    const result: AgentParseResult = { tag: "parsed", agent };

    expect(result.tag).toBe("parsed");
    if (result.tag === "parsed") {
      expect(result.agent.name).toBe("test-agent");
      expect(result.agent.scope).toBe("user");
    }
  });

  it("narrows to error variant with filePath and message", () => {
    const result: AgentParseResult = {
      tag: "error",
      filePath: "broken.md",
      message: "Empty content",
    };

    expect(result.tag).toBe("error");
    if (result.tag === "error") {
      expect(result.filePath).toBe("broken.md");
      expect(result.message).toBe("Empty content");
    }
  });
});

// ---------------------------------------------------------------------------
// CONFIG_SUB_TABS const array and derived type
// ---------------------------------------------------------------------------

describe("CONFIG_SUB_TABS const array", () => {
  it("contains all 7 expected sub-tab values", () => {
    expect(CONFIG_SUB_TABS).toEqual([
      "agents",
      "hooks",
      "skills",
      "rules",
      "mcp",
      "plugins",
      "docs",
    ]);
  });

  it("is readonly and has exactly 7 entries", () => {
    expect(CONFIG_SUB_TABS).toHaveLength(7);
  });
});

// ---------------------------------------------------------------------------
// Entity types: structural verification
// ---------------------------------------------------------------------------

describe("Entity types are structurally correct", () => {
  it("EnvVar has key and value", () => {
    const envVar: EnvVar = { key: "TOKEN", value: "abc123" };
    expect(envVar.key).toBe("TOKEN");
    expect(envVar.value).toBe("abc123");
  });

  it("ReadErrorInfo has path, error, and scope", () => {
    const err: ReadErrorInfo = {
      path: "/some/file.md",
      error: "Permission denied",
      scope: "project",
    };
    expect(err.path).toBe("/some/file.md");
    expect(err.scope).toBe("project");
  });

  it("DocFile has filePath, content, and scope", () => {
    const doc: DocFile = {
      filePath: "./CLAUDE.md",
      content: "# Project",
      scope: "project",
    };
    expect(doc.filePath).toBe("./CLAUDE.md");
    expect(doc.scope).toBe("project");
  });
});
