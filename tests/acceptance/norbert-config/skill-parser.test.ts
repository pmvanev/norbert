/**
 * Acceptance tests: Skill Definition Parsing (US-005)
 *
 * Validates that skill .md files (slash commands from .claude/commands/)
 * are parsed into browsable definitions with name and description.
 *
 * Driving ports: pure domain function (parseSkillFile)
 * These tests exercise the data transformation that feeds the Skills tab,
 * not the React rendering.
 *
 * Traces to: US-005 acceptance criteria (Skills sub-tab)
 */

import { describe, it, expect } from "vitest";
import {
  parseSkillFile,
  type SkillDefinition,
} from "../../../src/plugins/norbert-config/domain/skillParser";

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS
// ---------------------------------------------------------------------------

describe("Skill parsed with name from filename and description from content", () => {
  it("extracts skill name and description for the skills list", () => {
    // Given a skill file "deploy.md" with a heading and description
    const filename = "deploy.md";
    const content = [
      "# Deploy to staging",
      "",
      "This command deploys the current branch to the staging environment.",
      "",
      "## Steps",
      "",
      "1. Run tests",
      "2. Build artifacts",
      "3. Deploy to staging",
    ].join("\n");

    // When the skill file is parsed
    const result = parseSkillFile(filename, content);

    // Then the skill name is "deploy"
    expect(result.name).toBe("deploy");

    // And the description comes from the first heading
    expect(result.description).toBe("Deploy to staging");
  });
});

describe("Skill with heading-based description", () => {
  it("uses first heading as the description", () => {
    // Given a skill file with a Markdown heading as the first line
    const filename = "review-pr.md";
    const content = [
      "# Review a pull request",
      "",
      "Analyze the PR for code quality, test coverage, and design.",
    ].join("\n");

    // When the skill file is parsed
    const result = parseSkillFile(filename, content);

    // Then the description is the heading text
    expect(result.description).toBe("Review a pull request");
  });
});

describe("Skill with paragraph-based description", () => {
  it("uses first paragraph when no heading exists", () => {
    // Given a skill file with no heading, just a paragraph
    const filename = "run-tests.md";
    const content = [
      "Execute the full test suite and report results.",
      "",
      "Includes unit, integration, and acceptance tests.",
    ].join("\n");

    // When the skill file is parsed
    const result = parseSkillFile(filename, content);

    // Then the description is the first paragraph
    expect(result.description).toBe("Execute the full test suite and report results.");
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("Empty skill file produces error result", () => {
  it("returns a skill with empty description for empty content", () => {
    // Given a skill file with empty content
    const filename = "empty-command.md";
    const content = "";

    // When the skill file is parsed
    const result = parseSkillFile(filename, content);

    // Then the name is still derived from filename
    expect(result.name).toBe("empty-command");

    // And the description is empty
    expect(result.description).toBe("");
  });
});

describe("Skill name strips .md extension from filename", () => {
  it("removes the .md suffix to produce a clean skill name", () => {
    // Given a skill file with a compound filename
    const filename = "migrate-db.md";
    const content = "# Run database migrations\n\nApply pending migrations.";

    // When the skill file is parsed
    const result = parseSkillFile(filename, content);

    // Then the .md extension is removed
    expect(result.name).toBe("migrate-db");

    // And the description is extracted normally
    expect(result.description).toBe("Run database migrations");
  });
});
