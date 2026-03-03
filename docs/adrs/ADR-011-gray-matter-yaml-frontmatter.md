# ADR-011: gray-matter for YAML Frontmatter Parsing

## Status
Proposed

## Context
Config Explorer must parse YAML frontmatter from Markdown files across three subsystems: rules (`.claude/rules/*.md` with `paths:` field), skills (`SKILL.md` with `name:`, `description:`, `skills:`, `allowed-tools:`, `hooks:` fields), and agents (`agents/*.md` with `name:`, `tools:`, `skills:`, `model:`, `hooks:` fields). Frontmatter is delimited by `---` markers at the top of each file, containing YAML key-value pairs. The parser must reliably separate frontmatter data from Markdown body content.

## Decision
Use gray-matter 4.x for YAML frontmatter extraction.

gray-matter is the standard Node.js library for parsing front matter from strings. It returns `{ data, content, matter }` -- structured data (YAML parsed to object), body content (Markdown after frontmatter), and raw frontmatter string. It handles edge cases: missing frontmatter, invalid YAML (returns error), empty files, and files with no `---` delimiters.

## Alternatives Considered

### Alternative 1: js-yaml + custom regex splitting
- Pro: js-yaml is a reliable YAML parser. Custom regex (`/^---\n([\s\S]*?)\n---/`) splits frontmatter.
- Con: Regex-based frontmatter extraction is fragile: edge cases with `---` inside YAML values, Windows line endings (`\r\n`), files without trailing newline after closing `---`.
- Con: Must compose two tools (regex + js-yaml) manually. gray-matter does both in one call.
- Rejection: Composing regex + js-yaml manually introduces avoidable edge-case bugs.

### Alternative 2: Hand-written parser
- Pro: Zero dependencies. Full control over parsing behavior.
- Con: YAML frontmatter parsing is a solved problem. Reimplementing handles dozens of edge cases (multi-line values, lists, nested objects, special characters, encoding).
- Con: Maintenance burden for a non-differentiating component.
- Rejection: Unjustifiable when a battle-tested library with 51M+ weekly downloads exists.

### Alternative 3: remark + remark-frontmatter (Markdown AST approach)
- Pro: Full Markdown AST with frontmatter as a node type. Powers the unified/remark ecosystem.
- Con: Heavy dependency chain (~15 packages). Overkill when only frontmatter extraction is needed.
- Con: Learning curve for the unified plugin pipeline.
- Rejection: Massive over-engineering. gray-matter does the exact job needed with 1 dependency.

## Consequences
- Positive: Battle-tested library (51M+ weekly npm downloads) with comprehensive edge-case handling
- Positive: Returns structured `{ data, content }` -- exactly what the content parser needs
- Positive: Handles missing frontmatter gracefully (returns empty `data` and full content as body)
- Positive: MIT licensed
- Negative: One transitive dependency (js-yaml) -- minimal impact
- Negative: Fixed to gray-matter's YAML parsing behavior (uses js-yaml defaults)
