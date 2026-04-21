# ADR-010: Bare-Prose Detection OFF by Default in v1 (Resolves OQ-4)

- **Status**: Accepted
- **Date**: 2026-04-21
- **Deciders**: Morgan, Phil
- **Scope**: config-cross-references feature v1

## Context

OQ-4 asked which detection strategies participate in v1 and in what priority. R2 risk (DISCUSS) and ALT-4 already argued for OFF-by-default bare prose due to false-positive risk: common English words (`release`, `setup`, `build`) are common config names, and "wiping" detection over bare prose risks highlighting non-reference prose as references.

## Decision

**v1 detection pipeline (ordered)**:

1. **Explicit markdown links** (`[label](.claude/... | ~/.claude/... | ./*.md | ../*.md | /abs/...)`) — highest-confidence, always on.
2. **Inline code spans** whose text matches a known item name from the registry — on.
3. **Bare prose** — **off**. Exact strategy deferred to US-111 (R3) with its own spike.

Code blocks (fenced ```) are excluded by the AST visitor by construction (see ADR-001).

### Strategy contract

Each strategy is a pure function:

```ts
// in domain/references/detection/types.ts
type DetectionStrategy = (
  node: MdastNode,
  registry: ReferenceRegistry,
  ctx: DetectionContext,
) => readonly Reference[];  // 0..N references

const DETECTION_PIPELINE: readonly DetectionStrategy[] = [
  detectMarkdownLink,
  detectInlineCodeName,
];
```

`detectBareProse` will later slot into the array behind a feature flag read from `DetectionContext` (which is sourced from a user setting added in R3).

## Considered Alternatives

### Alt A: Bare prose always on
- **Cons**: High false-positive risk on names like `release`, `build`, `test`. First false positive destroys trust.
- **Rejected**.

### Alt B: Bare prose on only inside a curated "Related:" section
- **Pros**: Low false-positive rate.
- **Cons**: Requires authors to adopt a convention. Doesn't help existing docs.
- **Deferred** to US-111 — good candidate strategy there.

### Alt C: Bare prose opt-in via a user setting
- **Pros**: Power users can turn it on.
- **Cons**: Introduces a settings surface in v1 that the feature can ship without. Adds a flag to every render decision.
- **Deferred** to US-111.

### Alt D: OFF by default, deferred to US-111 (chosen)
- **Chosen**.

## Consequences

### Positive
- Zero false-positive risk from bare prose in v1.
- Explicit markdown links and inline code cover the 80%+ case documented in US-101 domain examples.
- US-111 can tackle bare prose as a dedicated story with its own UX exploration and (likely) user setting.

### Negative
- Power users writing docs without explicit links or backticked names will not see those references linkified. This is a discoverability gap, but it's the v1 trade-off.

### Quality-attribute trade-offs
- **Correctness / trust** ↑↑.
- **Convenience** ↓ for legacy docs. Addressed in R3.

## Implementation Notes (for software-crafter)

- The pipeline is a const array. Adding a strategy for v2 is appending a function and (optionally) wiring a setting gate.
- Do NOT introduce any setting infrastructure for this in v1. When US-111 arrives, the setting can live inside the plugin's own config (same mechanism the parent `norbert-config` uses for its own settings if/when needed).
- Performance: each strategy MUST be O(nodes) worst case. No nested loops over the registry per node.
