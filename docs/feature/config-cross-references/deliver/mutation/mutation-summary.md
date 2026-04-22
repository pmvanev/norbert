# Mutation Testing Summary -- config-cross-references

**Feature**: config-cross-references (walking-skeleton scope)
**Phase**: DELIVER -- Phase 5 (Mutation Testing)
**Date**: 2026-04-21
**Tool**: Stryker 9.6.0 (vitest test runner)

## Target

| File | Lines |
| --- | --- |
| `src/plugins/norbert-config/domain/references/registry.ts` | whole file |

Test scope: `tests/acceptance/config-cross-references/registry.test.ts`

## Result

**Kill rate: 95.74%** -- PASS (gate: >= 80%)

| Metric | Cycle 1 | Cycle 2 (final) |
| --- | --- | --- |
| Total mutants | 94 | 94 |
| Killed | 41 | 88 |
| Survived | 34 | 3 |
| Timeout | 1 | 2 |
| No coverage | 18 | 1 |
| **Mutation score** | **44.68%** | **95.74%** |
| Score (covered) | 55.26% | 96.77% |

## Iteration

### Cycle 1 (baseline, 5 live tests)

The original five live acceptance scenarios exercised the registry through
the walking-skeleton fixtures only. Surviving mutants concentrated in:

1. Per-`RefType` projector functions whose fields were never asserted
   (command, agent, hook, mcp, rule, plugin). Only the `skill` projector
   was covered behaviourally.
2. `normalisePath` rules: backslash conversion, trailing-slash strip,
   `/./` collapse, leading `./` strip -- none had a path-asymmetry test.
3. The `entryFromAgent` `result.tag !== "parsed"` filter -- no fixture
   with an agent parse-error.
4. The `byFilePath` first-writer-wins guard (`!byFilePath.has(pathKey)`) --
   no fixture with a path collision.
5. The `basename` multi-segment behaviour and the `hook.command` fallback
   when `basename(filePath)` is empty.

### Cycle 2 (+17 new behavioural tests)

Added the following test groups to `registry.test.ts` (all live `it(...)`,
no `it.skip`):

| Group | Count | Targets |
| --- | --- | --- |
| RegistryEntry projection per RefType | 6 | Per-projector field shape (command, agent, hook, mcp, rule, plugin) |
| normalisePath equivalence rules | 5 | Backslash, trailing slash, `/./`, leading `./`, root `/` preservation |
| AgentParseResult discrimination | 2 | Error-tagged agents skipped; parsed-only agents indexed |
| byFilePath first-writer-wins | 1 | Path-collision contract |
| basename multi-segment | 2 | Deep filePath -> last segment; empty basename -> command fallback |
| Version monotonicity | 1 | Exact `+1` step pinned, not just "> 0" |
| **Total added** | **17** | |

Test count went from 5 live (3 skipped) to 22 live (3 skipped). All 22
pass against production code in 6 ms. The 3 remaining `it.skip` blocks
are out-of-scope DELIVER scenarios (not mutation-cycle gaps).

## Surviving Mutants (3) -- Documented

All three survivors are **equivalent or near-equivalent mutants** that
cannot be killed without coupling tests to internal representation. They
are accepted per the >= 80% gate and the Testing-Theater avoidance rule
in the agent contract.

### Survivor 1: `itemKey` skill prefix (line 105)

```diff
- itemKey: makeItemKey("skill", skill.scope, skill.name),
+ itemKey: makeItemKey("", skill.scope, skill.name),
```

`itemKey` is an internal disambiguator string. The skill projector's
`type` field is already asserted (`type === "skill"`), and `itemKey` is
derived from `type`. Asserting on the literal `"skill:..."` prefix inside
itemKey would be a tautological re-assertion of the type field.

### Survivors 2-3: root-path trailing-slash guard (line 190)

```diff
- if (path.length > 1 && path.endsWith("/")) {
+ if (true && path.endsWith("/")) {
+ if (path.length >= 1 && path.endsWith("/")) {
```

Both indexing and lookup pipe through the same `normalisePath`, so the
mutants produce a **symmetric** wrong normalisation for the root path:
both sides strip `"/"` to `""`, lookup still succeeds. The mutants are
behaviourally equivalent for any test that goes through both paths
(buildRegistry + lookupByPath). Killing them would require asserting on
`registry.byFilePath.keys()` directly, which couples to internal
representation.

## Other Non-Killed Mutants

- **2 Timeout** -- pre-existing infinite-loop hazards in
  `while (path.includes("/./"))` mutations that flip the condition to
  always-true. Stryker correctly classifies these as timeouts (not
  survivors) because the test runner hits the hit-limit guard.
- **1 NoCoverage** -- the `?? ""` fallback in `basename()` (line 65)
  triggers only when `String.split` returns an empty array, which is
  impossible for any string input. This is a defensive-default branch.

## Deliverables

| Path | Status |
| --- | --- |
| `stryker.config-cross-references.conf.json` | NEW |
| `vitest.mutation.config-cross-references.ts` | NEW |
| `tests/acceptance/config-cross-references/registry.test.ts` | MODIFIED (+17 tests) |
| `docs/feature/config-cross-references/deliver/mutation/stryker-report.json` | NEW |
| `docs/feature/config-cross-references/deliver/mutation/mutation-report.html` | NEW |
| `docs/feature/config-cross-references/deliver/mutation/mutation-summary.md` | NEW |

## Gate

**PASS** -- 95.74% >= 80% threshold per CLAUDE.md `per-feature` mutation strategy.
