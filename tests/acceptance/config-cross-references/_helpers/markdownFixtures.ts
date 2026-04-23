/**
 * Markdown body fixtures for the detection pipeline tests.
 *
 * Each fixture exercises one detection rule from US-101 + ADR-001 + ADR-010:
 *   - markdownLinkToSkill: explicit md link to a known skill (live)
 *   - inlineCodeKnownAgent: inline code matching a known agent name (live)
 *   - inlineCodeUnknown: inline code that does not match any known item
 *   - bareProseKnownCommand: bare word matching a known command (must NOT be detected in v1)
 *   - fencedCodeBlockWithKnownName: fenced block containing a known item name (must NOT be detected)
 *   - markdownLinkToMissing: explicit md link to a non-existent skill (dead)
 *   - inlineCodeAmbiguous: inline code matching multiple items (ambiguous)
 *
 * Also exposes `parseMarkdown(source)` -- a thin unified+remark-parse+remark-gfm
 * pipeline used by detection acceptance scenarios. Mirrors the parser
 * react-markdown uses internally so the MDAST shape the detection plugin sees
 * during tests matches what it sees at render time.
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root as MdastRoot } from "mdast";

export const markdownLinkToSkill = `
# /release

1. Load the [nw-bdd-requirements](~/.claude/skills/nw-bdd-requirements/SKILL.md) skill
`.trim();

export const inlineCodeKnownAgent = `
After loading, invoke \`nw-solution-architect\` to continue.
Run \`ls -la\` to list the directory.
`.trim();

export const fencedCodeBlockWithKnownName = `
Here is an example of running the skill:

\`\`\`bash
echo "nw-bdd-requirements"
\`\`\`

The above does not auto-link.
`.trim();

export const bareProseKnownCommand = `
Use release to ship.
`.trim();

export const markdownLinkToMissing = `
# /old-release

Load the [nw-retired-skill](~/.claude/skills/nw-retired-skill/SKILL.md) skill.
`.trim();

export const inlineCodeAmbiguous = `
Run the \`release\` command to ship.
`.trim();

/**
 * Parse a markdown source string into an MDAST tree using the same
 * remark-parse + remark-gfm front-end react-markdown uses. Pure: returns a
 * fresh tree on every call, no shared mutable state.
 */
export function parseMarkdown(source: string): MdastRoot {
  return unified().use(remarkParse).use(remarkGfm).parse(source) as MdastRoot;
}
