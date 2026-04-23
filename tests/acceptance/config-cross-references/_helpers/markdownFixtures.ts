/**
 * Markdown body fixtures + parser helper for the detection pipeline tests.
 *
 * Fixtures:
 *   - fencedCodeBlockWithKnownName: fenced block containing a known item name
 *     (must NOT be detected -- v1 strategies skip MDAST `code` nodes per
 *     architecture §6.2 / ADR-001)
 *
 * Most detection scenarios inline their source markdown directly in the test
 * (e.g., `parseMarkdown("Invoke `nw-solution-architect` here.")`) because the
 * exact prose under test is part of the assertion's documentation. Fixtures
 * are reserved for sources whose multi-line structure (fenced blocks, frontmatter,
 * etc.) is awkward to inline.
 *
 * `parseMarkdown(source)` is a thin unified+remark-parse+remark-gfm pipeline
 * mirroring the parser react-markdown uses internally, so the MDAST shape the
 * detection plugin sees during tests matches what it sees at render time.
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root as MdastRoot } from "mdast";

export const fencedCodeBlockWithKnownName = `
Here is an example of running the skill:

\`\`\`bash
echo "nw-bdd-requirements"
\`\`\`

The above does not auto-link.
`.trim();

/**
 * Parse a markdown source string into an MDAST tree using the same
 * remark-parse + remark-gfm front-end react-markdown uses. Pure: returns a
 * fresh tree on every call, no shared mutable state.
 */
export function parseMarkdown(source: string): MdastRoot {
  return unified().use(remarkParse).use(remarkGfm).parse(source) as MdastRoot;
}
