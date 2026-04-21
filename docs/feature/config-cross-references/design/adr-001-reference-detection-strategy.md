# ADR-001: Reference Detection via Remark AST Walk (Post-Parse, Pre-Render)

- **Status**: Accepted
- **Date**: 2026-04-21
- **Deciders**: Morgan (solution-architect), Phil (user)
- **Scope**: config-cross-references feature
- **Supersedes**: none

## Context

The feature requires detecting cross-references inside markdown bodies rendered by `ConfigDetailPanel.tsx` (which uses `react-markdown` + `remark-gfm`). References can originate from:

1. Explicit markdown links whose href matches a config-scoped path pattern (`.claude/...`, `~/.claude/...`, `./*.md`, `../*.md`, absolute path).
2. Inline code spans (`` `name` ``) whose content matches a known item name.
3. (Future, OQ-4 deferred) Bare prose tokens.

Constraints:

- Detection must be a pure function: `(root: MdastRoot, registry: ReferenceRegistry) → AnnotatedRoot`. No DOM mutation. Functional paradigm (CLAUDE.md).
- Detection MUST respect the fenced-code-block exclusion rule (US-101 AC).
- Render-time detection must agree with click-time resolution (journey shared-artifact consistency rule on `reference_registry`).
- Performance: NFR-2 registry build 500ms p95 for 500 items; NFR-4 click-to-render 250ms p95.

## Decision

Use a **remark-pattern AST visitor** that runs between `react-markdown`'s parse and render passes:

- Structure the detection as a `unified`-style remark plugin invoked via `react-markdown`'s `remarkPlugins` prop.
- The plugin walks the MDAST tree:
  - `link` nodes → strategy-1 (`detectMarkdownLink`)
  - `inlineCode` nodes → strategy-2 (`detectInlineCodeName`)
  - `text` nodes inside `code`/`pre` (fenced blocks) → skipped by construction (MDAST models fenced blocks as `code` nodes whose children are treated as literals by remark; they are not visited as `text` unless inside prose).
- Matched nodes are transformed via the `data.hName` mechanism (standard unified pattern used by `remark-toc`, `remark-external-links`, etc.) — the MDAST node retains its shape but receives `data.hName = 'reference-token'` and `data.hProperties` carrying variant, target key, and raw text.
- A `components: { 'reference-token': ReferenceToken }` entry in `react-markdown` renders the node as an accessible button with the four variant styles. See architecture.md §6.2 for the exact contract and a rehype-stage fallback if needed.
- Strategy composition is data: `const DETECTION_PIPELINE: readonly DetectionStrategy[] = [detectMarkdownLink, detectInlineCodeName]`. Adding bare-prose (US-111) later is appending to the array.

## Considered Alternatives

### Alt A: Regex over the rendered HTML string
- **Pros**: Simplest. No AST dependency.
- **Cons**: Can't reliably skip content inside `<pre><code>` without re-parsing. Performance worse than AST (string-scanning full rendered output). Ugly coupling to `react-markdown`'s serialization. Fails the fenced-block exclusion AC.
- **Rejected** for correctness on fenced-block exclusion (US-101 AC critical).

### Alt B: Post-render DOM walk (after React renders, mutate text nodes)
- **Pros**: Sees the exact DOM the user sees.
- **Cons**: Breaks React reconciliation (imperative DOM mutation inside a React tree causes hydration/flush bugs). Hard to test in isolation. Imperative, not pure.
- **Rejected** for paradigm conflict (functional/immutable) and React correctness.

### Alt C: Pure-regex pass on the raw markdown string before rendering
- **Pros**: Fast.
- **Cons**: Regex would need to understand fenced-code boundaries (multiline regex with state — essentially re-implementing a markdown parser). Brittle. False positives when `` ``` `` appears inside inline code or when nested.
- **Rejected** for correctness.

### Alt D: Remark AST walk (chosen)
- **Pros**: Composable with the existing `remark-gfm` pipeline. Fenced-block exclusion is free (different AST node types). Pure transformation. Strategy pipeline is array of functions (aligns with FP paradigm).
- **Cons**: Requires one extra dependency (unist-util-visit, already transitively installed). Slightly more code than regex.
- **Chosen**.

## Consequences

### Positive
- Correct handling of code blocks and nested markdown constructs by construction.
- Pure function → trivially unit-testable with `fast-check` property tests (existing pattern in `tests/unit/plugins/norbert-config/domain/`).
- Strategy pipeline is extensible: US-111 (bare prose) is a new function added to the array behind a feature flag.
- Same AST visitor runs on the top pane and the split-bottom preview — guarantees style consistency required by `reference_token_style` shared artifact.

### Negative
- Adds `unist-util-visit` as an explicit direct dependency. MIT-licensed, mature (used by every remark plugin in the ecosystem).
- Developers contributing new detection strategies need minimal MDAST literacy.

### Quality-attribute trade-offs
- **Maintainability** ↑ (pure pipeline, testable strategies).
- **Performance**: neutral vs regex for typical markdown sizes; AST walk is O(nodes). Memoised per `(content, registryVersion)` so second renders are O(1).
- **Correctness** ↑ (fenced-block exclusion is structural, not heuristic).

## Implementation Notes (for software-crafter)

- Put the plugin at `src/plugins/norbert-config/domain/references/detection/` with one file per strategy.
- Registry lookup used inside the plugin is passed as a closure argument, not imported — keeps detection pure.
- Do **not** put the renderer component in the domain folder; it lives in `views/references/ReferenceToken.tsx`.
