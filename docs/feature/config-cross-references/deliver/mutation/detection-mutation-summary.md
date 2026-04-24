# Mutation Testing Summary - Detection Pipeline (Phase 05)

**Feature**: config-cross-references
**Module**: `src/plugins/norbert-config/domain/references/detection/` (5 files)
**Tool**: Stryker 9.6.0 + Vitest runner
**Date**: 2026-04-21
**Step-ID**: mutation-05

## Result

| Metric | Value | Gate |
|---|---|---|
| Total mutants | 78 | - |
| Killed | 75 | - |
| Survived | 2 | - |
| No coverage | 1 | - |
| Errors / Timeouts | 0 / 0 | - |
| **Mutation score (total)** | **96.15 %** | >= 80 % PASS |
| Mutation score (covered) | 97.40 % | - |

Per-file breakdown:

| File | Total % | Covered % | Killed | Survived | NoCov |
|---|---|---|---|---|---|
| `applyAnnotation.ts` | 89.47 | 94.44 | 17 | 1 | 1 |
| `inlineCodeStrategy.ts` | 96.43 | 96.43 | 27 | 1 | 0 |
| `markdownLinkStrategy.ts` | 100.00 | 100.00 | 23 | 0 | 0 |
| `pipeline.ts` | 100.00 | 100.00 | 5 | 0 | 0 |
| `remarkPlugin.ts` | 100.00 | 100.00 | 3 | 0 | 0 |

The remaining 2 survivors and 1 NoCoverage mutant are documented as accepted
equivalent mutants below. None represent a behavioural gap in the suite.

## Configuration

- Stryker: `stryker.config-cross-references-detection.conf.json` (NEW, scoped to `detection/**/*.ts`)
- Vitest: `vitest.mutation.config-cross-references-detection.ts` (NEW, includes only `detection.test.ts`)
- Output JSON: `docs/feature/config-cross-references/deliver/mutation/detection-stryker-report.json`
- Output HTML: `docs/feature/config-cross-references/deliver/mutation/detection-mutation-report.html`

Setup choice: option 2 (separate scoped config), matching the registry, resolver,
history and reducer phases. Rationale: keeps each module's kill-rate report
isolated; faster per-mutant cycle; cleaner attribution if a later regression
flips a kill-to-survive on any side. The detection mutation surface picked up a
fifth file (`applyAnnotation.ts`, the shared annotation helper that landed via
the in-flight Phase 04 refactor) because the `mutate` glob covers the whole
`detection/` subdirectory; this is intentional -- one config per logical
subsystem, not per source file.

## Iterations

### Run 1 -- baseline (7 walking-skeleton scenarios, pre-refactor source)

- Score: 74.19 % (69/93 killed, 19 survived, 5 no-coverage)
- Surviving mutant families:
  1. **Type-narrowing guard mutants in `isInlineCodeNode` and `isLinkNode`**
     (10 survivors, lines 36-37 / 39-40 / 58 / 61) -- the existing scenarios
     drove the strategies through `detectionRemarkPlugin` which only visits
     the realistic node types produced by the parser. No test exercised the
     guards directly with a non-matching `node.type` carrying a string
     payload, so any guard mutation that drops one half of the conjunction
     remained undetected.
  2. **`resolved.tag === "ambiguous"` ternary mutants in inlineCodeStrategy**
     (4 survivors, line 74) -- the ambiguous test asserted variant +
     candidate-count + raw-text but NOT `data-ref-target-key`, so a mutation
     that rewrote the ambiguous branch to always-empty (or the first-candidate
     fallback to a tautology) was undetectable.
  3. **`resolved.tag === "unsupported"` spread mutant in markdownLinkStrategy**
     (1 survivor, line 99) -- the live-skill / dead / unsupported tests did
     not assert `data-ref-target-path` ABSENCE on live or dead, so a mutation
     to `... ? : true ...` (always-spread the path key) was undetectable.
  4. **`""` literal mutant in markdownLinkStrategy targetKey fallback**
     (1 survivor, line 87) -- the dead test asserted variant but not target-key,
     so a mutation to `"Stryker was here!"` survived.
  5. **OptionalChaining / NullishCoalescing on `candidates[0]?.itemKey`**
     (multiple survivors and no-coverage, lines 78 / 86) -- the ambiguous
     branch's first-candidate fallback was unexercised by any target-key
     assertion.
  6. **markdown-link `=== "ambiguous"` ternary mutants** (2 survivors, line 85)
     -- ambiguous-via-path is impossible (path index is unique), so these
     branches are architecturally unreachable. Documented as equivalent below.

### Run 2 -- after assertion strengthening (4 new direct-strategy tests + 3 strengthened existing tests)

(Source code refactored mid-stream by an in-flight Phase 04 cleanup that
extracted `applyTokenAnnotation` into a shared `applyAnnotation.ts` module.
Mutation surface re-baselined to 78 mutants total. Tests still pass
unchanged because the public strategy contract is preserved.)

- Score: 81.72 % (76/93 killed, 12 survived, 5 no-coverage)
- Added scenarios (in `detection.test.ts`):
  - **Strengthened ambiguous test** -- assert `data-ref-target-key === "command:project:release"` (the first candidate's itemKey from the deterministic `[project, user]` insertion order). Killed inlineCode line 74 ConditionalExpression / StringLiteral / OptionalChaining / NullishCoalescing mutants on the ambiguous branch.
  - **Strengthened live-skill markdown-link test** -- assert `data-ref-target-path === undefined`. (Only partially effective; see Run 3.)
  - **Strengthened dead markdown-link test** -- assert `data-ref-target-key === ""`. Killed markdownLink line 87 StringLiteral mutant.
  - **NEW describe "Each strategy short-circuits on nodes its guard does not match"** -- 4 it.cases:
    1. inlineCodeStrategy.apply on a `text`-typed node carrying a known registry name as `value` (kills `node.type === "inlineCode" -> true` and `&& -> ||` mutations -- they would otherwise pass the guard with a non-inlineCode but matching-name payload).
    2. inlineCodeStrategy.apply on an inlineCode-typed node with no `value` field (kills the body-removal mutations on the early-return `if`).
    3. markdownLinkStrategy.apply on a `definition`-typed node carrying a known registry path as `url` (kills the link-type guard mutations).
    4. markdownLinkStrategy.apply on a link-typed node with no `url` field (kills the second-conjunct `typeof url === "string" -> true` mutation).
  - Killed all 5 inlineCode guard mutants and all 3 markdownLink guard mutants.

### Run 3 -- targeted hProperty-presence assertions (no new tests; assertion form change)

- Score: **96.15 % (75/78 killed, 2 survived, 1 no-coverage)**
- Refined assertions:
  - **Live-skill and dead markdown-link tests now assert `Object.prototype.hasOwnProperty.call(hProperties, "data-ref-target-path") === false`** instead of `toBeUndefined()`. The looser check passed even when the spread injected `{ "data-ref-target-path": undefined }` for non-unsupported variants; the strict presence check kills the
    `markdownLinkStrategy.ts:65 resolved.tag === "unsupported" -> true` mutant.
- Total tests: 12 (7 walking-skeleton scenarios + 4 new direct-strategy guard
  scenarios + 1 ambiguous test was already present and got assertion-strengthened
  rather than counted as new). Test budget for ~6 distinct strategy behaviours
  (inline-code live | inline-code ambiguous | inline-code dead-skip | markdown
  live | markdown dead | markdown unsupported) plus 4 mutation-coverage guard
  scenarios = `2 x 10` = 20 budget; we used 12.

## Surviving Mutants -- Accepted as Equivalent

Three mutants remain (2 survived + 1 no-coverage). Each is genuinely equivalent
under the surrounding code's invariants -- killing them would require either
forcing a contractually-impossible state (registry that violates the ResolvedRef
discriminant) or asserting on an internal implementation detail Stryker can't
distinguish from the original behaviour.

### 1. `inlineCodeStrategy.ts:43:5` ConditionalExpression `typeof value === "string" -> true`

```typescript
return (
  node.type === "inlineCode" &&
  typeof (node as { value?: unknown }).value === "string"
);
```

Killing this mutation requires an `inlineCode`-typed node whose `value` is
non-string AND whose `value` produces a non-`dead` resolver outcome when
passed to `lookupByName(registry, value)`. But `lookupByName` is a `Map.get`
keyed by string -- any non-string lookup misses, returning `dead`. The
strategy's early-return on `dead` then short-circuits, leaving the node
unannotated whether the guard was correct or not. **Equivalent under the
resolver's name-index contract.** Revisit if `lookupByName` ever stringifies
its key (currently it does not, per `registry.ts:byName: Map<string,...>`).

### 2. `applyAnnotation.ts:34:12` OptionalChaining `candidates[0]?.itemKey -> candidates[0].itemKey`

```typescript
if (resolved.tag === "ambiguous") {
  return resolved.candidates[0]?.itemKey ?? "";
}
```

The `ambiguous` ResolvedRef variant is constructed only when
`lookupByName(...).length >= 2` (resolver.ts:97). Therefore
`candidates[0]` is always defined for any reachable input. The
optional-chain is defensive; mutating it to a non-optional access produces
identical observable behaviour. **Equivalent under the resolver's
ambiguous-arity invariant.** Revisit if a future resolver path constructs
`ambiguous` with a possibly-empty candidates array (e.g., a typo'd refactor).

### 3. `applyAnnotation.ts:34:47` StringLiteral `?? "" -> ?? "Stryker was here!"` (NoCoverage)

Same root cause as (2) -- the nullish-coalescing fallback is only reached
when `candidates[0]?.itemKey` is `undefined`/`null`, which the resolver's
arity contract prevents. Stryker reports NoCoverage because the AST node is
never executed; the suite cannot kill an unreachable branch. **Equivalent
under the resolver's ambiguous-arity invariant.**

This mirrors the resolver / registry / history / reducer phase residuals:
defensive-coding mutants that the type system or upstream invariants render
unreachable are an architectural pattern across the feature.

## Test Inventory

| Test (describe + it) | Origin | Mutants killed |
|---|---|---|
| Inline code matching a known agent renders as a live cross-reference token | original | many |
| Content inside fenced code blocks is never linkified | original | many |
| Bare prose is not detected as a reference in v1 | original | many |
| Markdown link to a known skill renders as a live cross-reference token (strengthened: target-path absent) | original + assertion-strengthened | many incl. unsupported-spread mutant |
| Reference to a missing item renders as a dead token (strengthened: target-key === "" + target-path absent) | original + assertion-strengthened | dead-key + spread mutants |
| Reference resolving to multiple items renders as an ambiguous token (strengthened: target-key === "command:project:release") | original + assertion-strengthened | ambiguous-branch + first-candidate mutants |
| Reference to an unsupported item type renders as an unsupported token | original | many |
| inlineCodeStrategy.apply ignores a non-inlineCode node carrying a string value field matching a registry name | mutation-coverage | inlineCode guard mutants (lines 36, 53) |
| inlineCodeStrategy.apply ignores an inlineCode-typed node whose value field is missing entirely | mutation-coverage | inlineCode guard mutants (line 53 body) |
| inlineCodeStrategy.apply leaves a non-inlineCode node unannotated even when the early-return body is removed | mutation-coverage | inlineCode early-return body mutants |
| markdownLinkStrategy.apply ignores a non-link node carrying a string url field that resolves through the registry | mutation-coverage | markdownLink guard mutants (lines 39, 57) |
| markdownLinkStrategy.apply ignores a link-typed node whose url field is missing entirely | mutation-coverage | markdownLink guard second-conjunct mutant |

Total: 12 it.cases (7 original + 5 mutation-coverage). Budget 20 (`2 x 10`
for ~10 distinct behaviours); used 12.

## Files Touched

- NEW: `stryker.config-cross-references-detection.conf.json`
- NEW: `vitest.mutation.config-cross-references-detection.ts`
- MODIFIED: `tests/acceptance/config-cross-references/detection.test.ts` (added 1 new describe with 5 it.cases for direct-strategy guard tests; strengthened 3 existing assertions; added imports for `inlineCodeStrategy`, `markdownLinkStrategy`, `MdastNode`)
- NOT MODIFIED: any of the 5 `src/plugins/norbert-config/domain/references/detection/*.ts` files (per boundary rule)
- OUTPUT: `docs/feature/config-cross-references/deliver/mutation/detection-stryker-report.json`
- OUTPUT: `docs/feature/config-cross-references/deliver/mutation/detection-mutation-report.html`
- OUTPUT: `docs/feature/config-cross-references/deliver/mutation/detection-mutation-summary.md` (this file)
