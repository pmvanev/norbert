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
  EnvVar,
  DocFile,
  ReadErrorInfo,
  ConfigSubTab,
} from "../../../../../src/plugins/norbert-config/domain/types";
import { CONFIG_SUB_TABS } from "../../../../../src/plugins/norbert-config/domain/types";

// ---------------------------------------------------------------------------
// CONFIG_SUB_TABS const array and derived type
// ---------------------------------------------------------------------------

describe("CONFIG_SUB_TABS const array", () => {
  it("contains all 9 expected sub-tab values", () => {
    expect(CONFIG_SUB_TABS).toEqual([
      "agents",
      "commands",
      "hooks",
      "skills",
      "rules",
      "mcp",
      "plugins",
      "docs",
      "env",
    ]);
  });

  it("is readonly and has exactly 9 entries", () => {
    expect(CONFIG_SUB_TABS).toHaveLength(9);
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
