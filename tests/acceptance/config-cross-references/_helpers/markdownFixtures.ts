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
 */

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
