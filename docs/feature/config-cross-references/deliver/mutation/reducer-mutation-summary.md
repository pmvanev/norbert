# Mutation Testing Summary - ConfigNavReducer (Phase 04)

**Feature**: config-cross-references
**Module**: `src/plugins/norbert-config/domain/nav/reducer.ts`
**Tool**: Stryker 9.6.0 + Vitest runner
**Date**: 2026-04-21
**Step-ID**: mutation-04

## Result

| Metric | Value | Gate |
|---|---|---|
| Total mutants | 77 | - |
| Killed | 75 | - |
| Survived | 0 | - |
| No coverage | 2 | - |
| Errors / Timeouts | 0 / 0 | - |
| **Mutation score (total)** | **97.40 %** | >= 80 % PASS |
| Mutation score (covered) | 100.00 % | - |

The two NoCoverage mutants are on the TypeScript exhaustiveness `default:`
branch of the `switch (action.tag)` statement at line 363:

1. `default: { ... } -> default:` (ConditionalExpression)
2. `default: { ... } -> default: {}` (BlockStatement)

The branch is statically unreachable under the current `ConfigNavAction`
discriminated union (5 walking-skeleton variants, all matched). TypeScript
narrows `action` to `never` inside the default body and the `_exhaustive: never`
assignment is the compile-time enforcement that future variant additions must
add a matching case here. Reaching the branch at runtime would require an
`as any` cast in the test, which would simulate a runtime contract the type
system already forbids and add no behavioural assurance. Documented as accepted
residual; revisit when a 6th `ConfigNavAction` variant is introduced (per the
reducer header note, US-103/104/105 will land additional variants).

This mirrors the resolver Phase 02 residual and the registry Phase 01
residual: TypeScript-`never` exhaustiveness branches are an architectural
pattern across the feature.

## Configuration

- Stryker: `stryker.config-cross-references-reducer.conf.json` (NEW, scoped to reducer only)
- Vitest: `vitest.mutation.config-cross-references-reducer.ts` (NEW, includes only `reducer.test.ts`)
- Output JSON: `docs/feature/config-cross-references/deliver/mutation/reducer-stryker-report.json`
- Output HTML: `docs/feature/config-cross-references/deliver/mutation/reducer-mutation-report.html`

Setup choice: option 2 (separate scoped config), matching the registry,
resolver and history phases. Rationale: keeps each module's kill-rate report
isolated; faster per-mutant cycle (single tiny test file, ~22s end-to-end);
cleaner attribution if a later regression flips a kill-to-survive on any side.

## Iterations

### Run 1 -- baseline (12 walking-skeleton scenarios)

- Score: 76.62 % (59/77 killed, 15 survived, 3 no-coverage)
- Surviving mutant families:
  1. **NavEntry shape mutants (5 survivors)** -- L130-131 ObjectLiteral/BlockStatement
     on `makeRefClickEntry` and L248/L292/L306 StringLiteral on the
     `"refSingleClick"` / `"refCtrlClick"` action discriminator strings, plus
     L367 ObjectLiteral and StringLiteral on the `closeSplit` entry. The
     existing tests only assert `history.entries.length`; no test inspected
     the entry payload.
  2. **resolveFilterOnNav Rule 1 mutants (2 survivors)** -- L182:33 ConditionalExpression
     `existing === undefined || existing.source === null -> false` and L184:12
     ObjectLiteral on the Rule 1 return shape. The 04-06 "preserves" test
     exercises Rule 2 only; the 04-07 "resets" test exercises Rule 3 only;
     Rule 1 (no entry at all OR entry with source=null) was unexercised.
  3. **Missing-anchor guard (1 survived + 1 no-coverage)** -- L295:7
     ConditionalExpression `if (currentEntry === null) -> if (false)` and the
     guard body BlockStatement at L295:30. The 04-01 open-from-empty test
     always supplies a non-null currentEntry.
  4. **REF_TYPE_TO_SUB_TAB mapping mutants (5 survivors)** -- L146 (`agent`),
     L147 (`command`), L150 (`mcp`), L151 (`rule`), L152 (`plugin`)
     StringLiteral on each map value. Walking-skeleton scenarios cover only
     skill->'skills' and hook->'hooks'; the remaining five RefType entries
     never had cross-tab Ctrl+click coverage.
  5. **Exhaustiveness default branch (2 no-coverage)** -- L374:5 / L374:14
     ConditionalExpression / BlockStatement on the `default: { never }`
     switch arm. Statically unreachable under the discriminated union.

### Run 2 -- after first batch of mutation-coverage tests (3 added)

- Score: 96.10 % (74/77 killed, 1 survived, 2 no-coverage)
- Added scenarios:
  - **"Cross-reference history entries record the originating action and target itemKey"**
    -- one combined scenario that drives all four pushers (refSingleClick
    open-from-empty, refSingleClick bottom-replace, refCtrlClick, closeSplit)
    and asserts the tail entry's `action` discriminator and `targetItemKey`.
    Killed all 5 NavEntry shape survivors.
  - **"Ctrl+click into a destination sub-tab with no active filter preserves state and emits no cue"**
    -- exercises Rule 1 left operand (`existing === undefined`). Killed L184
    and reduced L182 to a single survivor (the right operand was still
    unexercised).
  - **"Single-click on a live reference with no current anchor is a complete no-op"**
    -- exercises the missing-anchor guard with currentEntry===null and
    splitState===null. Killed L295:7 and covered (still 0-survivor) L295:30.
  - **"Cross-tab Ctrl+click maps each RefType to its canonical Configuration sub-tab"**
    -- parametrised `it.each` over the 5 unmapped RefType entries (agent,
    command, mcp, rule, plugin), each building a single-item AggregatedConfig
    and asserting the post-state activeSubTab matches the canonical sub-tab
    id. Killed all 5 mapping survivors.
- Remaining survivors: L191:33 ConditionalExpression
  `existing === undefined || existing.source === null -> existing === undefined || false`.
  The right operand is unexercised because the new Rule 1 test pinned the
  left operand only.

### Run 3 -- after targeted Rule 1 right-operand test (1 added)

- Score: **97.40 % (75/77 killed, 0 survived, 2 no-coverage)**
- Added scenario:
  - **"Ctrl+click into a destination sub-tab whose existing filter has source=null preserves state and emits no cue"**
    -- destination sub-tab carries an entry whose `source` is null while a
    non-default sort is preserved (the user has explicitly cleared the source
    filter). Target source is non-null. Per ADR-007 a null source is "no
    source filter" and Rule 1 must short-circuit -- preserving the filter
    object reference and emitting no cue. Killed the L191:33 right-operand
    mutant.
- Remaining: 2 NoCoverage mutants on the TypeScript exhaustiveness default
  branch (documented as accepted equivalent above).

## Test Inventory

| Test (describe block) | Origin | Mutants killed |
|---|---|---|
| Single-click on a live reference opens a vertical split with the target previewed | original | 13 |
| Single-click in an open split replaces the bottom pane only | original | 4 |
| Ctrl+click across sub-tabs switches sub-tab, list selection, and detail in one atomic update | original | 16 |
| Ctrl+click within the same sub-tab swaps only the list selection and detail | original | 0 (covered 22) |
| Ctrl+click closes any open split as part of the commit | original | 1 |
| Ctrl+click preserves a filter that already shows the target | original | 4 |
| Ctrl+click resets the destination filter when it would hide the target | original | 7 |
| Single-click on a dead reference is a complete no-op | original | 2 |
| Ctrl+click on a dead reference is a complete no-op | original | 2 |
| Manual list-row selection does not push a history entry | original | 3 |
| Manual sub-tab switch does not push a history entry | original | 3 |
| Close button collapses the split back to a single pane | original | 4 |
| Cross-reference history entries record action + targetItemKey (4-step) | mutation-coverage | 7 |
| Ctrl+click into destination with no active filter (Rule 1 left operand) | mutation-coverage | 1 |
| Ctrl+click into destination with source=null filter (Rule 1 right operand) | mutation-coverage | 1 |
| Single-click with no current anchor is a complete no-op (missing-anchor guard) | mutation-coverage | 2 |
| Cross-tab Ctrl+click maps each RefType to its canonical sub-tab (parametrised x5) | mutation-coverage | 5 |

Total: 17 it.cases (12 original + 5 mutation-coverage; the cross-tab map case
is one parametrised describe with 5 it.each entries) across 17 describe
blocks. Test budget for the 5 reducer driving-port action variants plus the 5
mutation-coverage rules (Rule 1 left, Rule 1 right, missing-anchor, NavEntry
shape, RefType mapping) is 20 (`2 x 10`); we used 17.

## Files Touched

- NEW: `stryker.config-cross-references-reducer.conf.json`
- NEW: `vitest.mutation.config-cross-references-reducer.ts`
- MODIFIED: `tests/acceptance/config-cross-references/reducer.test.ts` (added 5 mutation-coverage describe blocks; added imports for `AggregatedConfig`, `ConfigSubTab`, `RefType`, `buildRegistry`, `resolve`, `makeAgent`, `makeAggregatedConfig`, `makeCommand`, `makeMcpServer`, `makePlugin`, `makeRule`)
- NOT MODIFIED: `src/plugins/norbert-config/domain/nav/reducer.ts` (per boundary rule)
- OUTPUT: `docs/feature/config-cross-references/deliver/mutation/reducer-stryker-report.json`
- OUTPUT: `docs/feature/config-cross-references/deliver/mutation/reducer-mutation-report.html`
- OUTPUT: `docs/feature/config-cross-references/deliver/mutation/reducer-mutation-summary.md` (this file)
