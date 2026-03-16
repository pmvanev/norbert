/**
 * Skill Definition Parser
 *
 * Pure function that parses skill .md files into SkillDefinition values.
 * No IO, no side effects.
 *
 * Driving port: parseSkillFile(filename, content) -> SkillParseResult
 */

import type { SkillDefinition } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEADING_REGEX = /^#\s+(.+)$/;

/** Strip the .md extension from a filename to derive the skill name. */
function extractSkillName(filename: string): string {
  return filename.replace(/\.md$/, "");
}

/** Extract description from content: heading text if present, otherwise first non-empty line. */
function extractDescription(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return "";
  }

  const firstLine = trimmed.split("\n")[0].trim();
  const headingMatch = firstLine.match(HEADING_REGEX);

  return headingMatch ? headingMatch[1].trim() : firstLine;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a skill Markdown file into a SkillDefinition.
 *
 * - Name is derived from the filename (without .md extension).
 * - Description is extracted from the first heading or first paragraph.
 * - Empty files produce an empty description.
 */
export function parseSkillFile(
  filename: string,
  content: string,
): Pick<SkillDefinition, "name" | "description"> {
  return {
    name: extractSkillName(filename),
    description: extractDescription(content),
  };
}

export type { SkillDefinition };
