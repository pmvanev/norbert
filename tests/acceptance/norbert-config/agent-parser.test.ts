/**
 * Acceptance tests: Agent Definition Parsing (US-002)
 *
 * Validates that agent .md files are parsed into browsable definitions
 * with name, model, tools, description, and system prompt extracted
 * from Markdown with YAML frontmatter.
 *
 * Driving ports: pure domain function (parseAgentFile)
 * These tests exercise the data transformation that feeds agent cards,
 * not the React rendering.
 *
 * Traces to: US-002 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import {
  parseAgentFile,
  type AgentParseResult,
} from "../../../src/plugins/norbert-config/domain/agentParser";

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User browses agent definitions and sees key metadata", () => {
  it("parses agent file into definition with name, model, tools, and description", () => {
    // Given an agent definition file "nw-functional-software-crafter.md"
    // with model "opus-4", 12 tools, and a description
    const filename = "nw-functional-software-crafter.md";
    const content = [
      "---",
      "model: opus-4",
      "tools:",
      "  - Bash",
      "  - Read",
      "  - Write",
      "  - Edit",
      "  - Glob",
      "  - Grep",
      "  - WebFetch",
      "  - TodoRead",
      "  - TodoWrite",
      "  - MultiEdit",
      "  - NotebookRead",
      "  - NotebookEdit",
      "---",
      "",
      "You are a functional software crafter specializing in pure functions.",
      "",
      "## Core Principles",
      "",
      "Write pure functions with no side effects.",
    ].join("\n");

    // When the agent file is parsed
    const result = parseAgentFile(filename, content);

    // Then parsing succeeds with a complete agent definition
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    // And the agent name is derived from the filename
    expect(result.agent.name).toBe("nw-functional-software-crafter");

    // And the model is "opus-4"
    expect(result.agent.model).toBe("opus-4");

    // And 12 tools are listed
    expect(result.agent.toolCount).toBe(12);
    expect(result.agent.tools).toContain("Bash");
    expect(result.agent.tools).toContain("Edit");

    // And the description shows the first line of content
    expect(result.agent.description).toContain("functional software crafter");

    // And the system prompt contains the full body
    expect(result.agent.systemPrompt).toContain("Core Principles");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS
// ---------------------------------------------------------------------------

describe("Agent name derived from filename", () => {
  it("strips .md extension to produce the agent name", () => {
    // Given an agent file named "quick-review.md"
    const filename = "quick-review.md";
    const content = [
      "---",
      "model: sonnet-4",
      "---",
      "",
      "Review code for quality issues.",
    ].join("\n");

    // When the agent file is parsed
    const result = parseAgentFile(filename, content);

    // Then the agent name is "quick-review"
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;
    expect(result.agent.name).toBe("quick-review");
  });
});

describe("Agent with minimal metadata shows sensible defaults", () => {
  it("shows default model and inherited tools when frontmatter has no model or tools", () => {
    // Given an agent file with no model or tools declaration
    const filename = "simple-helper.md";
    const content = "Help the user with simple tasks.\n\nBe concise and helpful.";

    // When the agent file is parsed
    const result = parseAgentFile(filename, content);

    // Then parsing succeeds
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    // And the model shows "default"
    expect(result.agent.model).toBe("default");

    // And tools are empty (inherited)
    expect(result.agent.toolCount).toBe(0);
    expect(result.agent.tools).toEqual([]);
  });
});

describe("Agent with declared tools shows tool count and names", () => {
  it("extracts all tool names and counts them", () => {
    // Given an agent file with 3 declared tools
    const filename = "code-reviewer.md";
    const content = [
      "---",
      "model: opus-4",
      "tools:",
      "  - Read",
      "  - Grep",
      "  - Glob",
      "---",
      "",
      "Review code for bugs and style issues.",
    ].join("\n");

    // When the agent file is parsed
    const result = parseAgentFile(filename, content);

    // Then the tool count is 3
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;
    expect(result.agent.toolCount).toBe(3);
    expect(result.agent.tools).toEqual(["Read", "Grep", "Glob"]);
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("Empty agent file produces parse error", () => {
  it("returns error result for empty content", () => {
    // Given an agent file with empty content
    const filename = "broken-agent.md";
    const content = "";

    // When the agent file is parsed
    const result = parseAgentFile(filename, content);

    // Then a parse error is returned
    expect(result.tag).toBe("error");
    if (result.tag !== "error") return;
    expect(result.filePath).toBe("broken-agent.md");
    expect(result.message).toBeTruthy();
  });
});

describe("Agent with no frontmatter but valid content still parses", () => {
  it("treats entire content as system prompt with default metadata", () => {
    // Given an agent file with content but no YAML frontmatter delimiters
    const filename = "plain-agent.md";
    const content = [
      "You are a helpful assistant.",
      "",
      "## Instructions",
      "",
      "Be thorough and accurate.",
    ].join("\n");

    // When the agent file is parsed
    const result = parseAgentFile(filename, content);

    // Then parsing succeeds with defaults
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;
    expect(result.agent.name).toBe("plain-agent");
    expect(result.agent.model).toBe("default");
    expect(result.agent.toolCount).toBe(0);

    // And the entire content is the system prompt
    expect(result.agent.systemPrompt).toContain("helpful assistant");
    expect(result.agent.systemPrompt).toContain("Instructions");
  });
});
