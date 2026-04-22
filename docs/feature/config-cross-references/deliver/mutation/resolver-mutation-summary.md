# Mutation Testing Summary - Resolver (Phase 02)

**Feature**: config-cross-references
**Module**: `src/plugins/norbert-config/domain/references/resolver.ts`
**Tool**: Stryker 9.6.0 + Vitest runner
**Date**: 2026-04-21
**Step-ID**: mutation-02

## Result

| Metric | Value | Gate |
|---|---|---|
| Total mutants | 73 | - |
| Killed | 71 | - |
| Survived | 0 | - |
| No coverage | 2 | - |
| Errors / Timeouts | 0 / 0 | - |
| **Mutation score (total)** | **97.26 %** | >= 80 % PASS |
| Mutation score (covered) | 100.00 % | - |

The single remaining gap is on the TypeScript exhaustiveness `default:` branch of the `switch (ref.kind)` statement -- two `NoCoverage` mutants on the `default` case body. The branch is statically unreachable under the current `Reference` discriminated union (`name | path`) because TypeScript narrows `ref` to `never` inside it. Reaching it would require an `as any` cast in the test, which would simulate a runtime contract the type system already forbids and add no behavioural assurance. Documented as accepted residual; revisit when a third `Reference.kind` is introduced.

## Configuration

- Stryker: `stryker.config-cross-references-resolver.conf.json` (NEW, scoped to resolver only)
- Vitest: `vitest.mutation.config-cross-references-resolver.ts` (NEW, includes only `resolver.test.ts`)
- Output JSON: `docs/feature/config-cross-references/deliver/mutation/resolver-stryker-report.json`
- Output HTML: `docs/feature/config-cross-references/deliver/mutation/resolver-mutation-report.html`

Setup choice: option 2 (separate scoped config). Rationale: keeps the registry's existing `stryker.config-cross-references.conf.json` and its kill-rate report intact; faster per-mutant cycle (single tiny test file); cleaner attribution if a later regression flips a kill-to-survive on either side.

## Iterations

### Run 1 -- baseline (4 original scenarios only)

- Score: 67.12 % (49/73 killed, 18 survived, 6 no-coverage)
- Surviving mutant families:
  1. `extractDotClaudeCategory` L100 / L104 boundary mutants -- only one path-miss case (the unsupported one) was tested, leaving the `claudeIndex === -1` early-return and the `next === undefined / next === ""` guards uncovered.
  2. `resolvePathReference` L128 `&&` and conditional-true mutants -- the `unsupported` test entered with `category = "unknown-kind"` (NOT in the supported set), so the supported-AND-missing-from-registry branch was never exercised.
  3. L132 / L74-81 string-literal and array-literal mutants on `SUPPORTED_CATEGORIES` and the join separator -- the existing assertion only checked that the reason contained `"unknown-kind"`, not the canonical category names or the `", "` separator.
  4. L136 dead-from-path object/string mutants -- no path-miss test that hit a non-`.claude/` location existed.

### Run 2 -- after first batch of mutation-coverage tests (5 added)

- Score: 94.52 % (69/73 killed, 2 survived, 2 no-coverage)
- Added it.skip-style scenarios (kept live):
  - "Resolving a path that does not lie under .claude returns the dead outcome" with `/tmp/random/file.txt`
  - "Resolving a path that ends exactly at .claude with no segment after returns the dead outcome" parametrized over `~/.claude` and `~/.claude/`
  - "Resolving a path under a SUPPORTED .claude category that misses the registry returns the dead outcome (not unsupported)" with `~/.claude/skills/never-registered/SKILL.md`
  - "The unsupported reason names every supported category and the offending category, joined by ', '"
- Remaining survivors: two L100 ConditionalExpression / BlockStatement mutants on the `if (claudeIndex === -1) return null` early-return guard. Mutating to `if (false)` or empty body still yielded `dead` for the existing inputs because their first segments (`tmp` after the empty leading-slash split, `agents`) either re-entered the second guard or fell through the supported-category branch.

### Run 3 -- after targeted L100 case (1 added)

- Score: **97.26 % (71/73 killed, 0 survived, 2 no-coverage)**
- Added `tmp/random/file.txt` (no leading slash, first segment `tmp` not in SUPPORTED_CATEGORIES) to the parametrized L100 test. Skipping the early return on this input would yield `next = "tmp"`, trip the unsupported branch, and diverge from the dead expectation -- killing both L100 mutants.

## Test Inventory

| Test (describe block) | Origin | Mutants killed |
|---|---|---|
| live name match | original | 9 |
| ambiguous name match | original | 7 |
| dead name match | original | 7 |
| unsupported path | original | 26 |
| dead path (no .claude) -- parametrized x3 | mutation-coverage | 5 |
| dead path (.claude with no segment after) -- parametrized x2 | mutation-coverage | 6 |
| dead path under supported category, not in registry | mutation-coverage | 2 |
| unsupported reason names every category + ", " separator | mutation-coverage | 7 |

Total: 11 it.cases across 8 describe blocks. Test budget for the 4 distinct outcome-branches plus the 4 boundary-rule clarifications is 16 (`2 x 8`); we used 11.

## Files Touched

- NEW: `stryker.config-cross-references-resolver.conf.json`
- NEW: `vitest.mutation.config-cross-references-resolver.ts`
- MODIFIED: `tests/acceptance/config-cross-references/resolver.test.ts` (added 4 mutation-coverage describe blocks)
- NOT MODIFIED: `src/plugins/norbert-config/domain/references/resolver.ts` (per boundary rule)
- OUTPUT: `docs/feature/config-cross-references/deliver/mutation/resolver-stryker-report.json`
- OUTPUT: `docs/feature/config-cross-references/deliver/mutation/resolver-mutation-report.html`
- OUTPUT: `docs/feature/config-cross-references/deliver/mutation/resolver-mutation-summary.md` (this file)
