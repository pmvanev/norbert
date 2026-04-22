# Mutation Testing Summary - NavHistory (Phase 03)

**Feature**: config-cross-references
**Module**: `src/plugins/norbert-config/domain/nav/history.ts`
**Tool**: Stryker 9.6.0 + Vitest runner
**Date**: 2026-04-21
**Step-ID**: mutation-03

## Result

| Metric | Value | Gate |
|---|---|---|
| Total mutants | 44 | - |
| Killed | 42 | - |
| Survived | 2 | - |
| No coverage | 0 | - |
| Errors / Timeouts | 0 / 0 | - |
| **Mutation score (total)** | **95.45 %** | >= 80 % PASS |
| Mutation score (covered) | 95.45 % | - |

The two surviving mutants are equivalent mutants on the LRU cap boundary check (`appended.length > MAX_HISTORY_ENTRIES`) at line 62. Specifically:

1. `>` -> `true` (always cap)
2. `>` -> `>=` (cap at exact equality, not just exceeding)

Both mutants are behaviourally indistinguishable from the original at any attainable input. When `appended.length === MAX_HISTORY_ENTRIES` (50), both the original and either mutant produce `appended.slice(0)` which equals `appended`. When `appended.length > MAX_HISTORY_ENTRIES`, all three branches execute the slice. The pushEntry implementation only ever appends ONE entry per call, so `appended.length` is at most `previous + 1`; combined with the LRU cap holding the prior state at <= 50, the post-append length is at most 51 and the mutated branches produce identical outputs to the original at every reachable input. Documented as accepted equivalent residual.

## Configuration

- Stryker: `stryker.config-cross-references-history.conf.json` (NEW, scoped to history only)
- Vitest: `vitest.mutation.config-cross-references-history.ts` (NEW, includes only `history.test.ts`)
- Output JSON: `docs/feature/config-cross-references/deliver/mutation/history-stryker-report.json`
- Output HTML: `docs/feature/config-cross-references/deliver/mutation/history-mutation-report.html`

Setup choice: option 2 (separate scoped config), matching the registry and resolver phases. Rationale: keeps each module's kill-rate report isolated; faster per-mutant cycle; cleaner attribution if a later regression flips a kill-to-survive on any side.

## Iterations

### Run 1 -- baseline (7 original scenarios)

- Score: 88.64 % (39/44 killed, 5 survived, 0 no-coverage)
- Surviving mutant families:
  1. `emptyHistory` sentinel literal mutants -- `entries: []` -> `["Stryker was here"]` and `headIndex: -1` -> `+1`. The original tests built histories ad-hoc instead of asserting the sentinel shape directly.
  2. `canGoBack` ConditionalExpression -- `headIndex > 0` -> `false`. The only test that touched canGoBack pinned the false case (headIndex=0); no test pinned the true case mid-stack.
  3. LRU cap ConditionalExpression / EqualityOperator on line 62 -- the existing tests exercised either well-below-cap or exactly-at-cap-with-eviction states, never the exact-equality-no-eviction boundary.

### Run 2 -- after mutation-coverage tests (3 added)

- Score: **95.45 % (42/44 killed, 2 survived, 0 no-coverage)**
- Added scenarios:
  - "emptyHistory sentinel encodes the no-head-yet state" -- pins entries=[] and headIndex=-1, kills 2 mutants
  - "canGoBack is true for any history with headIndex > 0" -- pins the positive branch, kills 1 mutant
  - "LRU cap does not evict when the resulting stack would be exactly at the cap" -- pushes onto a 49-entry history at headIndex=48 and asserts no eviction; covers (but does not kill) the 2 remaining cap-boundary mutants because the original and mutated branches produce identical output at the equality boundary
- Remaining survivors documented as equivalent mutants (above).

## Test Inventory

| Test (describe block) | Origin | Mutants killed |
|---|---|---|
| Alt+Left restores the previous navigation snapshot | original | 5 |
| Alt+Right re-advances after going back | original | 5 |
| A new cross-reference action after Alt+Left clears the forward stack | original | 7 |
| Alt+Left at the start of history is a no-op with end-of-history cue | original | 7 |
| Alt+Right at end of history is a no-op | original | 10 |
| For any sequence of navigation actions the history never exceeds 50 entries (property) | original | 3 |
| LRU eviction at cap of 50 evicts the oldest entry and shifts headIndex | original | 2 |
| emptyHistory sentinel encodes the no-head-yet state | mutation-coverage | 2 |
| canGoBack is true for any history with headIndex > 0 | mutation-coverage | 1 |
| LRU cap does not evict when the resulting stack would be exactly at the cap | mutation-coverage | 0 (covers equivalent mutants) |

Total: 10 it.cases across 10 describe blocks. Test budget for the 5 driving-port functions plus the LRU cap rule and sentinel pinning is 14 (`2 x 7`); we used 10.

## Files Touched

- NEW: `stryker.config-cross-references-history.conf.json`
- NEW: `vitest.mutation.config-cross-references-history.ts`
- MODIFIED: `tests/acceptance/config-cross-references/history.test.ts` (added 3 mutation-coverage describe blocks)
- NOT MODIFIED: `src/plugins/norbert-config/domain/nav/history.ts` (per boundary rule)
- OUTPUT: `docs/feature/config-cross-references/deliver/mutation/history-stryker-report.json`
- OUTPUT: `docs/feature/config-cross-references/deliver/mutation/history-mutation-report.html`
- OUTPUT: `docs/feature/config-cross-references/deliver/mutation/history-mutation-summary.md` (this file)
