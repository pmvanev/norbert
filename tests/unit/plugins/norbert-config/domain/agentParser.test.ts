/**
 * Unit tests: Agent Definition Parser
 *
 * Property-based tests for the parseAgentFile pure function.
 * Verifies invariants that hold across all valid inputs.
 *
 * Traces to: Step 03-01 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  parseAgentFile,
  type AgentParseResult,
} from "../../../../../src/plugins/norbert-config/domain/agentParser";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generate a valid .md filename */
const filenameArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => /^[a-z][a-z0-9-]*$/.test(s))
  .map((s) => `${s}.md`);

/** Generate a valid YAML frontmatter model value */
const modelArb = fc.constantFrom("opus-4", "sonnet-4", "haiku-4");

/** Generate a list of tool names */
const toolsArb = fc.array(
  fc.constantFrom("Bash", "Read", "Write", "Edit", "Glob", "Grep"),
  { minLength: 0, maxLength: 6 },
);

/** Generate body content (non-empty) */
const bodyArb = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => s.trim().length > 0);

/** Build a full agent file with frontmatter */
function buildAgentContent(
  model: string,
  tools: string[],
  body: string,
): string {
  const toolLines =
    tools.length > 0
      ? ["tools:", ...tools.map((t) => `  - ${t}`)].join("\n")
      : "";
  const frontmatter = [`---`, `model: ${model}`, toolLines, `---`]
    .filter(Boolean)
    .join("\n");
  return `${frontmatter}\n\n${body}`;
}

// ---------------------------------------------------------------------------
// Properties: Result tag is always "parsed" or "error"
// ---------------------------------------------------------------------------

describe("parseAgentFile result tag", () => {
  it("always returns a valid discriminated union tag", () => {
    fc.assert(
      fc.property(filenameArb, fc.string(), (filename, content) => {
        const result = parseAgentFile(filename, content);
        expect(["parsed", "error"]).toContain(result.tag);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Properties: Well-formed input always parses successfully
// ---------------------------------------------------------------------------

describe("parseAgentFile with valid frontmatter", () => {
  it("always produces a parsed result with correct agent name", () => {
    fc.assert(
      fc.property(
        filenameArb,
        modelArb,
        toolsArb,
        bodyArb,
        (filename, model, tools, body) => {
          const content = buildAgentContent(model, tools, body);
          const result = parseAgentFile(filename, content);

          expect(result.tag).toBe("parsed");
          if (result.tag !== "parsed") return;

          // Name is filename without .md extension
          const expectedName = filename.replace(/\.md$/, "");
          expect(result.agent.name).toBe(expectedName);
        },
      ),
    );
  });

  it("always extracts the correct model", () => {
    fc.assert(
      fc.property(
        filenameArb,
        modelArb,
        toolsArb,
        bodyArb,
        (filename, model, tools, body) => {
          const content = buildAgentContent(model, tools, body);
          const result = parseAgentFile(filename, content);

          expect(result.tag).toBe("parsed");
          if (result.tag !== "parsed") return;
          expect(result.agent.model).toBe(model);
        },
      ),
    );
  });

  it("toolCount always equals tools array length", () => {
    fc.assert(
      fc.property(
        filenameArb,
        modelArb,
        toolsArb,
        bodyArb,
        (filename, model, tools, body) => {
          const content = buildAgentContent(model, tools, body);
          const result = parseAgentFile(filename, content);

          expect(result.tag).toBe("parsed");
          if (result.tag !== "parsed") return;
          expect(result.agent.toolCount).toBe(result.agent.tools.length);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Properties: Name derivation invariant
// ---------------------------------------------------------------------------

describe("agent name derivation", () => {
  it("name is always non-empty when filename is valid .md", () => {
    fc.assert(
      fc.property(filenameArb, modelArb, bodyArb, (filename, model, body) => {
        const content = buildAgentContent(model, [], body);
        const result = parseAgentFile(filename, content);

        expect(result.tag).toBe("parsed");
        if (result.tag !== "parsed") return;
        expect(result.agent.name.length).toBeGreaterThan(0);
      }),
    );
  });

  it("name never contains .md extension", () => {
    fc.assert(
      fc.property(filenameArb, modelArb, bodyArb, (filename, model, body) => {
        const content = buildAgentContent(model, [], body);
        const result = parseAgentFile(filename, content);

        expect(result.tag).toBe("parsed");
        if (result.tag !== "parsed") return;
        expect(result.agent.name).not.toMatch(/\.md$/);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Properties: Empty content always errors
// ---------------------------------------------------------------------------

describe("parseAgentFile with empty content", () => {
  it("always returns error for empty string", () => {
    fc.assert(
      fc.property(filenameArb, (filename) => {
        const result = parseAgentFile(filename, "");
        expect(result.tag).toBe("error");
        if (result.tag !== "error") return;
        expect(result.filePath).toBe(filename);
        expect(result.message.length).toBeGreaterThan(0);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Persona extraction: articles are not persona names
// ---------------------------------------------------------------------------

describe("persona extraction skips articles", () => {
  it("treats 'the' as part of the role, not as a persona name", () => {
    const content = "You are the solution architect for this project.";
    const result = parseAgentFile("architect.md", content);
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;
    expect(result.agent.persona).toBe("");
    expect(result.agent.role).toBe("the solution architect for this project");
  });

  it("treats 'a' as part of the role, not as a persona name", () => {
    const content = "You are a code review specialist.";
    const result = parseAgentFile("reviewer.md", content);
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;
    expect(result.agent.persona).toBe("");
    expect(result.agent.role).toBe("a code review specialist");
  });

  it("treats 'an' as part of the role, not as a persona name", () => {
    const content = "You are an expert debugger.";
    const result = parseAgentFile("debugger.md", content);
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;
    expect(result.agent.persona).toBe("");
    expect(result.agent.role).toBe("an expert debugger");
  });

  it("preserves real persona names like Zeus", () => {
    const content = "You are Zeus, a builder of agents.";
    const result = parseAgentFile("nw-agent-builder.md", content);
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;
    expect(result.agent.persona).toBe("Zeus");
    expect(result.agent.role).toBe("builder of agents");
  });
});

// ---------------------------------------------------------------------------
// Properties: No frontmatter defaults
// ---------------------------------------------------------------------------

describe("parseAgentFile without frontmatter", () => {
  it("uses default model and empty tools when no frontmatter present", () => {
    fc.assert(
      fc.property(filenameArb, bodyArb, (filename, body) => {
        // Ensure body doesn't start with --- to avoid accidental frontmatter
        const safeBody = body.startsWith("---") ? `X${body}` : body;
        const result = parseAgentFile(filename, safeBody);

        expect(result.tag).toBe("parsed");
        if (result.tag !== "parsed") return;
        expect(result.agent.model).toBe("default");
        expect(result.agent.toolCount).toBe(0);
        expect(result.agent.tools).toEqual([]);
      }),
    );
  });
});
