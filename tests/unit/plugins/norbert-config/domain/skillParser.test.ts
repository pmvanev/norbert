/**
 * Unit tests: Skill Definition Parser
 *
 * Property-based tests for the parseSkillFile pure function.
 * Verifies invariants that hold across all valid inputs.
 *
 * Traces to: Step 05-01 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseSkillFile } from "../../../../../src/plugins/norbert-config/domain/skillParser";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generate a valid .md filename */
const filenameArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => /^[a-z][a-z0-9-]*$/.test(s))
  .map((s) => `${s}.md`);

/** Generate a Markdown heading line */
const headingArb = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter((s) => s.trim().length > 0 && !s.includes("\n"))
  .map((s) => `# ${s.trim()}`);

/** Generate a non-empty paragraph line (no heading prefix) */
const paragraphArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0 && !s.startsWith("#") && !s.includes("\n"));

/** Generate body content after the first line */
const bodyArb = fc
  .array(
    fc.string({ minLength: 0, maxLength: 80 }),
    { minLength: 0, maxLength: 5 },
  )
  .map((lines) => lines.join("\n"));

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe("parseSkillFile properties", () => {
  it("name is always the filename without .md extension", () => {
    fc.assert(
      fc.property(filenameArb, headingArb, (filename, heading) => {
        const content = heading;
        const result = parseSkillFile(filename, content);
        const expectedName = filename.replace(/\.md$/, "");
        expect(result.name).toBe(expectedName);
      }),
    );
  });

  it("description is never undefined", () => {
    fc.assert(
      fc.property(filenameArb, fc.string(), (filename, content) => {
        const result = parseSkillFile(filename, content);
        expect(result.description).toBeDefined();
        expect(typeof result.description).toBe("string");
      }),
    );
  });

  it("heading content is used as description when present", () => {
    fc.assert(
      fc.property(filenameArb, headingArb, bodyArb, (filename, heading, body) => {
        const content = body ? `${heading}\n\n${body}` : heading;
        const result = parseSkillFile(filename, content);
        const headingText = heading.replace(/^#\s+/, "");
        expect(result.description).toBe(headingText);
      }),
    );
  });

  it("first paragraph is used as description when no heading exists", () => {
    fc.assert(
      fc.property(filenameArb, paragraphArb, bodyArb, (filename, paragraph, body) => {
        const content = body ? `${paragraph}\n\n${body}` : paragraph;
        const result = parseSkillFile(filename, content);
        expect(result.description).toBe(paragraph.trim());
      }),
    );
  });

  it("empty content produces empty description", () => {
    fc.assert(
      fc.property(filenameArb, (filename) => {
        const result = parseSkillFile(filename, "");
        expect(result.description).toBe("");
      }),
    );
  });
});
