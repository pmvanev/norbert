# Evolution Record: config-cross-references (walking skeleton)

**Date**: 2026-04-21
**Wave**: DELIVER (walking-skeleton scope only)
**Paradigm**: functional

## Feature

Cross-reference navigation for the Configuration view — make config-item names
and absolute file paths inside aggregated config content clickable so the user
can jump between related items. Architecture spans a pure-domain
`ReferenceRegistry`, a `ReferenceResolver`, a token-detection pipeline, a
navigation reducer with history, and a `ConfigNavProvider` React adapter.

## Scope Shipped This Wave

**Walking skeleton only**: the foundational `ReferenceRegistry` pure-domain
module (architecture §6.1). Five steps, one per acceptance scenario:

| Step | Behaviour |
|------|-----------|
| 01-01 | `buildRegistry` empty-config contract (empty maps, version > 0) |
| 01-02 | Index all seven `AggregatedConfig` collections into `byName` multimap |
| 01-03 | Populate `byFilePath` with structural path normalisation |
| 01-04 | Preserve multi-scope name collisions as multiple candidates |
| 01-05 | NFR-2 — 500-item build completes synchronously under 100 ms |

**Explicitly deferred** to follow-on DELIVER waves:

- **R1** (US-101..US-110): React/Provider layer, navigation reducer, history,
  split layout, ambiguity popover, instrumentation sink, NavAnnouncer ARIA
  live region, Alt+Left/Right scoped binding, focus-flow ordering.
- **R2** (US-111..US-113): bare-prose detection strategy 3, focus-test
  determinism hardening, scope-precedence default highlighting.
- **R3** (US-114..): persisted history across restarts, additional detection
  strategies, dashboard wiring for the outcome KPIs.

## Wave Timeline

| Wave | Commit | Notes |
|------|--------|-------|
| DISCUSS | `6a15fdf` | User stories, journey, outcome KPIs, 7 OQs raised |
| DESIGN | `a169be1` | Architecture, C4 L1+L2+L3, 10 ADRs, Atlas independent review |
| DISTILL | `0beb0ba` | Acceptance tests authored (registry slice live + downstream skipped) |
| DELIVER 01-01 | `d5a0110` | Stub `ReferenceRegistry` public surface |
| DELIVER 01-02 | `233dfb8` | Index `AggregatedConfig` into `byName` |
| DELIVER 01-03 | `11ee7ff` | `byFilePath` with path normalisation |
| DELIVER 01-04 | `24427dd` | Activate ambiguous-name lookup scenario |
| DELIVER 01-05 | `9ea69a4` | NFR-2 500-item registry build |
| DELIVER refactor-01 | `55ca0c6` | L1-L4 sweep on walking skeleton |
| DELIVER mutation-01 | `d22b234` | Stryker run, +17 behavioural tests, 95.74% kill rate |

## What This Enables

The registry is the gating dependency for everything downstream:

- **Resolver** (architecture §6.3) — consumes `lookupByName` for ambiguous
  candidates and `lookupByPath` for absolute-href resolution. Now
  unblocked.
- **Detection pipeline** (§6.2) — strategy-1 markdown link detection and
  strategy-2 inline-code detection both call `lookupByName`. Now unblocked.
- **`ConfigNavProvider`** (§6.6) — holds the live registry reference, gates
  detection memoisation on `registry.version`. Public surface is now stable.

The next DELIVER wave can begin at `walking-skeleton.md` step 6 (resolver
test), then proceed through history, reducer, detection, NavAnnouncer,
scope-precedence pre-highlight, and finally Provider + instrumentation.

## Quality Summary

| Dimension | Result |
|-----------|--------|
| Live acceptance scenarios | 5 (one per step) + 17 mutation-driven behaviourals |
| Skipped scenarios | 3 (architecturally out-of-scope, flagged in roadmap I1) |
| Mutation kill rate | **95.74%** (88/94 mutants killed; gate ≥ 80%) |
| Surviving mutants | 3 — documented as equivalent (itemKey type-prefix, root-`/` symmetric trailing-slash ×2) |
| DES execution log entries | 35 (5 steps × 5 phases + refactor-01 × 5 + mutation-01 × 5) |
| Reviews (DELIVER) | 2 — pass-1 TDD/Theater approved (1 LOW); pass-2 API/maintainability approved (4 LOW) |
| Reviews (upstream) | 4 — PO (DISCUSS), SA + Atlas independent (DESIGN), AD (DISTILL), all approved |
| Architectural rules | dependency-cruiser clean; domain has no `node:*` imports |
| FP paradigm | Pure functions only; readonly types throughout; no classes; no input mutation |
| Public API drift vs §6.1 | Zero — `buildRegistry`, `lookupByName`, `lookupByPath` match the contract verbatim |

## Open Debt

Four LOW findings from review pass 2, all comment/documentation additions
that do not affect runtime behaviour. Accepted as walking-skeleton-wave debt:

1. `buildRegistry` JSDoc lacks the "pass 0 on first call" initialisation
   convention.
2. `entryFromPlugin` sets `source: plugin.name` (correct per spec) without
   an inline rationale.
3. `make500ItemConfig` fixture omits `rules` and `plugins` from the load
   profile (5 of 7 RefTypes loaded; coverage maintained via mutation pass
   tests for the missing two).
4. `normalisePath` does not flag `~user/` and Windows drive-letter paths
   as known v1 gaps.

These will be addressed in the resolver/detection wave when the consumer
code naturally surfaces comment needs around the registry surface.

## Outside-In TDD Notes

The walking-skeleton roadmap anchored on **one** live scenario (`buildRegistry`
empty-config) and un-skipped one additional scenario per step. This produced
a clean RED → GREEN cycle for steps 01-01 through 01-03. Steps 01-04 and 01-05
recorded "RED passed without production change" — the array-push `byName`
accumulator from 01-02 already satisfied the multi-scope collision contract,
and the indexing pipeline already handled the 500-item load. Review pass 1
explicitly verified this is a genuine walking-skeleton artefact (deletion
test confirms the live scenarios are bound to production behaviour) and not
Fixture Theater — both scenarios fail if the relevant indexing code is
removed.

## Housekeeping

A stale DES marker `.nwave/des/des-task-active-otel-first-metrics--` from a
prior abandoned `otel-first-metrics` delivery session was left in the
working tree. Removed during DELIVER kickoff and the deletion is committed
as part of this finalize step. The corresponding evolution archive
(`otel-first-metrics-evolution.md`) was already in place from that prior
session; no other artefacts referenced the marker.

## Files Touched

### Production
- `src/plugins/norbert-config/domain/references/registry.ts` (NEW, 292 lines)

### Tests
- `tests/acceptance/config-cross-references/registry.test.ts` (NEW)
- `tests/acceptance/config-cross-references/_helpers/fixtures.ts` (NEW, includes `make500ItemConfig`)

### Mutation tooling
- `stryker.config-cross-references.conf.json` (NEW)
- `vitest.mutation.config-cross-references.ts` (NEW)

### DELIVER artefacts
- `docs/feature/config-cross-references/deliver/roadmap.json`
- `docs/feature/config-cross-references/deliver/roadmap-review.yaml`
- `docs/feature/config-cross-references/deliver/execution-log.json`
- `docs/feature/config-cross-references/deliver/review-pass-1.yaml`
- `docs/feature/config-cross-references/deliver/review-pass-2.yaml`
- `docs/feature/config-cross-references/deliver/mutation/mutation-summary.md`
- `docs/feature/config-cross-references/deliver/mutation/stryker-report.json`
- `docs/feature/config-cross-references/deliver/mutation/mutation-report.html`

## Next Wave Pointer

Continue from `walking-skeleton.md` step 6 onward:

1. `resolver.test.ts` (US-101 ambiguous + dead branches against the registry)
2. `navHistory` LRU 50 module (US-104)
3. Navigation reducer (US-103, US-105, US-106 — pure transitions)
4. Detection strategies 1 + 2 (markdown link + inline code)
5. `NavAnnouncer` ARIA live region (DESIGN §6.8)
6. Scope-precedence pre-highlight (OQ-5)
7. `ConfigNavProvider` + instrumentation effect (US-110, KPI sink)

The registry's `version` field is the memoisation key for the detection
pipeline; downstream consumers should gate on it rather than on config
object identity.

---

## Phase 02 — Reference Resolver (2026-04-22)

**Wave segment**: DELIVER (resolver slice — driving port for detection and the navigation reducer)
**Paradigm**: functional
**Crafter**: nw-functional-software-crafter

### Scope Shipped

The pure-domain `ReferenceResolver` module (architecture §6.3) plus two new
shared constants exported from `registry.ts`. Four TDD steps, one per
ResolvedRef outcome, followed by a refactor pass, a mutation pass, and a
consolidated remediation closing all open review findings:

| Step | Behaviour |
|------|-----------|
| 02-01 | Stub `resolve` + `live` outcome for single-name match against the registry |
| 02-02 | `ambiguous` outcome when name lookup returns ≥ 2 candidates (deterministic ordering) |
| 02-03 | `dead` outcome when both name and path lookups miss; `searchedScopes` populated from registry coverage |
| 02-04 | `unsupported` outcome when a path-shaped reference points under `.claude/<unknown-category>/`; supported-category paths still resolve as `live` |

### Wave Timeline

| Wave | Commit | Notes |
|------|--------|-------|
| DELIVER 02-01 | `156c93d` | Stub `resolve` live outcome; deviation from §6.3 `Reference` shape documented in module docstring |
| DELIVER 02-02 | `7131597` | Ambiguous outcome activated; deterministic across builds |
| DELIVER 02-03 | `3cc3203` | Dead outcome with `searchedScopes` from `ConfigScope` literal union |
| DELIVER 02-04 | `ca55fc6` | Unsupported outcome; `.claude/<category>/` heuristic with reason string |
| DELIVER refactor-02 | `2eded1e` | L1 + L4 sweep — extracted `resolveNameReference` / `resolvePathReference` / `extractDotClaudeCategory` helpers; `resolve` reduced to a three-line dispatcher with `never`-typed exhaustiveness check |
| DELIVER mutation-02 | `82dd330` | Stryker run on resolver only (separate scoped config); 97.26% kill rate (71/73) after three iterations |
| DELIVER remediation-02 | `4e45f44` | Consolidated remediation closing 6 review findings (1 MEDIUM + 2 LOW from pass 1; 3 MEDIUM + 1 LOW from pass 2) |

### What This Enables

The resolver is the gating dependency for the navigation surfaces:

- **Detection pipeline** (architecture §6.2 / ADR-001) — produces `Reference`
  values directly from MDAST (`inlineCode.value` → `{ kind: 'name' }`,
  `link.url` → `{ kind: 'path' }`) and feeds them through `resolve()` to
  decide which `ReferenceToken` variant to render. Now unblocked.
- **`ConfigNavReducer`** (§6.4) — consumes the `ResolvedRef` discriminated
  union to drive UI behaviour: `live` opens preview / commits navigation,
  `ambiguous` opens the disambiguation popover (ADR-004), `dead` shows the
  tooltip with `searchedScopes`, `unsupported` shows the typed `category`
  in the tooltip without parsing a reason string.

### Quality Summary

| Dimension | Result |
|-----------|--------|
| Live acceptance scenarios | 11 (4 outcome scenarios + 4 mutation-coverage describe blocks; 7 `it` cases beyond the original 4) |
| Mutation kill rate | **97.26%** (71/73 mutants killed; gate ≥ 80%) |
| NoCoverage mutants | 2 — both on the `default:` branch of the `switch (ref.kind)` exhaustiveness check; statically unreachable under the current discriminated union (TS narrows to `never`) |
| Surviving mutants | 0 |
| DES execution log entries | 9 steps × 5 phases = 45 with 7 `NOT_APPLICABLE` skips on RED phases for refactor / mutation / remediation passes; 2 BACKFILL PREPARE entries for 02-02 and 02-04 |
| Reviews (DELIVER) | 2 — pass-1 TDD/Theater approved (1 MEDIUM + 2 LOW); pass-2 API/maintainability approved (3 MEDIUM + 1 LOW); all 6 closed in commit `4e45f44` |
| DES integrity | 9/9 steps complete (verify_deliver_integrity passes after backfill) |
| Architectural rules | dependency-cruiser clean; resolver imports only `ConfigScope` (type-only) and registry items; no `node:*`, no React, no Tauri |
| FP paradigm | Pure functions only; readonly types throughout; `never`-typed exhaustiveness check; no input mutation |
| Public API drift vs §6.3 | **Deliberate** — see "Architecture deviation" below |

### Architecture Deviation

The shipped `Reference` shape diverged from architecture §6.3 as a deliberate
design improvement that emerged during implementation. The original spec was
`{ kind: 'markdown-link' | 'inline-code', rawText, resolveHint }`; the
shipped shape is `{ kind: 'name' | 'path', value }`. The original
`unsupported` arm carried only `{ path, reason }`; the shipped arm adds a
typed `category` field. The reasoning — source-syntax belongs at the
detection layer per ADR-001, not at the resolver; lookup-strategy is the
resolver's only concern — was reviewed and approved in
`roadmap-review-phase-02.yaml` (reviewer agreement) and
`review-pass-2-phase-02.yaml` (typed-category recommendation), and is
back-propagated to `docs/feature/config-cross-references/design/architecture.md`
§6.3 with a `Changed Assumptions` block as part of this finalize step.

### Notable Engineering Decisions

- **Shared `REGISTRY_SCOPES` and `REGISTRY_CATEGORIES`** exported from
  `registry.ts` and imported by the resolver. Eliminates the silent-divergence
  hazard between the resolver's hardcoded `searchedScopes` / supported-category
  list and the registry's actual surface coverage. Closes review pass-2 MEDIUM
  findings 2 and 3 in a single move; downstream consumers (detection, future
  ScopePrecedence) get the same source of truth.
- **Typed `category` field on the `unsupported` arm** (rather than embedding
  the unrecognised category in a parseable substring of `reason`). UI
  consumers like the dead-token tooltip and disambiguation popover can read
  `category` as a first-class datum; `reason` remains for human-readable
  context. Closes review pass-2 MEDIUM finding 1; types-as-documentation.
- **Refactor-02 pass before mutation testing**, not after — the
  `resolveNameReference` / `resolvePathReference` / `extractDotClaudeCategory`
  helper extraction made the mutation-coverage gaps (boundary conditions on
  `claudeIndex === -1`, `next === undefined / next === ""`, the `&&` in the
  unsupported branch) much easier to reason about and target precisely.
- **Backfilled 2 PREPARE entries** for steps 02-02 and 02-04 with
  `BACKFILL:`-prefixed framing in the `d` field. The PREPARE work was
  performed (file reads, contract review) but the DES CLI was not called at
  the time. Honesty about the original logging gap rather than silent
  reconstruction; the timestamps reflect the backfill point, not the
  original action.

### Outside-In TDD Notes

All four resolver scenarios are exercised exclusively through the `resolve()`
driving port — the three post-refactor internal helpers
(`resolveNameReference`, `resolvePathReference`, `extractDotClaudeCategory`)
are not exported and not referenced by any test. Pass-1 review verified
deletion tests for every step: reverting the relevant branch in the
production code causes the primary tag assertion to fail (live → dead;
ambiguous → dead; dead → live; unsupported → dead). No Testing Theater
patterns present.

### Open Debt

The four LOW findings from Phase 01 review pass 2 (registry comment /
documentation additions) remain open from the walking-skeleton wave; nothing
new from Phase 02 since all six pass-1 + pass-2 findings closed in commit
`4e45f44`. The three deferred `it.skip` scenarios in `registry.test.ts`
(unknown-name returns empty list, version increments on rebuild,
cross-scope collision via `makeAggregatedConfig`) are still in scope for a
future polish wave — they were architecturally deferred at DISTILL and have
not regressed.

### Files Touched

#### Production
- `src/plugins/norbert-config/domain/references/resolver.ts` (NEW)
- `src/plugins/norbert-config/domain/references/registry.ts` (MODIFIED — exports `REGISTRY_SCOPES` and `REGISTRY_CATEGORIES`)

#### Tests
- `tests/acceptance/config-cross-references/resolver.test.ts` (NEW — 11 `it` cases across 8 describe blocks)

#### Mutation tooling
- `stryker.config-cross-references-resolver.conf.json` (NEW — scoped to resolver only; keeps registry's existing config + report intact)
- `vitest.mutation.config-cross-references-resolver.ts` (NEW — includes only `resolver.test.ts`)

#### DELIVER artefacts
- `docs/feature/config-cross-references/deliver/roadmap.json` (extended with Phase 02)
- `docs/feature/config-cross-references/deliver/roadmap-review-phase-02.yaml` (NEW)
- `docs/feature/config-cross-references/deliver/review-pass-1-phase-02.yaml` (NEW)
- `docs/feature/config-cross-references/deliver/review-pass-2-phase-02.yaml` (NEW)
- `docs/feature/config-cross-references/deliver/execution-log.json` (extended; includes 2 BACKFILL PREPARE entries)
- `docs/feature/config-cross-references/deliver/mutation/resolver-mutation-summary.md` (NEW)
- `docs/feature/config-cross-references/deliver/mutation/resolver-stryker-report.json` (NEW)
- `docs/feature/config-cross-references/deliver/mutation/resolver-mutation-report.html` (NEW)

#### Architecture back-propagation (this finalize)
- `docs/feature/config-cross-references/design/architecture.md` (§6.3 + new "Changed Assumptions" block + changelog entry)

### Next Wave Pointer

Continue from `walking-skeleton.md` step 7:

1. `history.test.ts` — pure LRU-50 stack module (US-104, ADR-006)
2. Navigation reducer (US-103, US-105, US-106 — pure transitions; consumes `ResolvedRef`)
3. Detection strategies 1 + 2 (markdown link + inline code; produces `Reference` values for `resolve()`)
4. `NavAnnouncer` ARIA live region (DESIGN §6.8)
5. Scope-precedence pre-highlight (OQ-5)
6. `ConfigNavProvider` + instrumentation effect (US-110, KPI sink)

The resolver's `ResolvedRef` discriminated union is the contract surface for
the navigation reducer; downstream consumers should switch exhaustively on
`tag` rather than testing for individual field presence.

---

## Phase 03 — NavHistory LRU-50 (2026-04-22)

**Wave segment**: DELIVER (navigation history slice — powers Alt+Left / Alt+Right per ADR-006)
**Paradigm**: functional
**Crafter**: nw-functional-software-crafter

### Scope Shipped

The pure-domain `NavHistory` module (architecture §6.5) at
`src/plugins/norbert-config/domain/nav/history.ts`. Public surface:
`pushEntry`, `goBack`, `goForward`, `canGoBack`, `canGoForward`, plus the
`NavEntry` and `NavHistory` types, the `MAX_HISTORY_ENTRIES` constant, and
the `emptyHistory` sentinel. Seven TDD steps, one per behaviour, followed by
a refactor pass, a mutation pass, and a consolidated remediation closing all
open review findings:

| Step | Behaviour |
|------|-----------|
| 03-01 | Stub `NavHistory` module surface + `goBack` happy path (decrement headIndex) |
| 03-02 | `goForward` happy path (increment headIndex, symmetric to `goBack`) |
| 03-03 | `pushEntry` truncates the forward tail before appending (validation-only — earlier code already satisfies the contract) |
| 03-04 | `goBack` at start of history is a no-op + `canGoBack` predicate (validation-only — guard in place from 03-01) |
| 03-05 | `goForward` at end of history is a no-op + `canGoForward` predicate |
| 03-06 | LRU-50 invariant as a property test — weighted action arbitrary, default `numRuns=100`, `minLength: 60` ensures sequences breach the cap |
| 03-07 | LRU eviction example — pushing onto a 50-entry history evicts `entries[0]` and pins `headIndex` at 49 (validation-only — 03-06 already implements the cap) |

### Wave Timeline

| Wave | Commit | Notes |
|------|--------|-------|
| DELIVER 03-01 | `3e5e7d6` | Stub module + `goBack`; `headIndex: -1` sentinel for `emptyHistory` |
| DELIVER 03-02 | `327582b` | `goForward` happy path |
| DELIVER 03-03 | `ccc4b45` | `pushEntry` truncates forward stack — validation-only un-skip |
| DELIVER 03-04 | `b09f540` | `goBack` at start no-op + `canGoBack` — validation-only un-skip |
| DELIVER 03-05 | `34f469e` | `goForward` at end no-op + `canGoForward` |
| DELIVER 03-06 | `cd683b3` | LRU-50 property test — weighted action arbitrary 3:1:1 push:back:forward |
| DELIVER 03-07 | `a264c4d` | LRU eviction example — validation-only un-skip |
| DELIVER refactor-03 | `e26f8f0` | L1 + L4 sweep — extracted `enforceLruCap` helper; `pushEntry` reduced to a three-line composition |
| DELIVER mutation-03 | `0aa938b` | Stryker run on history only (separate scoped config); 95.45% kill rate (42/44) |
| DELIVER remediation-03 | `a34f72b` | Consolidated remediation closing all Phase 03 review findings + the long-standing dep-cruiser §4 enforcement gap |

### What This Enables

The history module is the last pure-domain prerequisite before the navigation
state machine:

- **`ConfigNavReducer`** (architecture §6.4) — can now consume `NavHistory`
  for the `historyBack` / `historyForward` action transitions: `historyBack`
  reduces to `goBack(state.history)`, `historyForward` to
  `goForward(state.history)`. Now unblocked.
- **`ConfigNavProvider`** (§6.6) — can use `canGoBack` / `canGoForward` to
  gate the Alt+Left / Alt+Right end-of-history audible cue; the predicates
  give the keyboard handler a single conditional with no state decoding. Now
  unblocked.

### Quality Summary

| Dimension | Result |
|-----------|--------|
| Live acceptance scenarios | 10 (7 outcome scenarios + 3 mutation-coverage describe blocks) |
| Mutation kill rate | **95.45%** (42/44 mutants killed; gate ≥ 80%) |
| Surviving mutants | 2 — both equivalent on the LRU cap boundary check (`appended.length > MAX_HISTORY_ENTRIES` → `true` and → `>=`); behaviourally indistinguishable from the original at every reachable input because `pushEntry` only ever appends one entry per call |
| Property test quality | `numRuns=100` default, `minLength: 60`, weighted action arbitrary 3:1:1 (push:back:forward), `size: "max"` for value complexity — sequences routinely exceed the 50-cap; not loop-of-one |
| DES execution log entries | 16 steps complete (10 in Phase 03 — 7 TDD + refactor-03 + mutation-03 + remediation-03) |
| Reviews (DELIVER) | 2 — pass-1 TDD/Theater approved (1 MEDIUM closed via remediation, 1 LOW); pass-2 API/maintainability approved (3 LOW); all addressed |
| DES integrity | 16/16 steps complete (verify_deliver_integrity passes); PREPARE logged for all 7 Phase 03 steps via DES CLI |
| Architectural rules | dependency-cruiser now enforces 3 architecture §4 rules for `src/plugins/norbert-config/domain/**`; module clean |
| FP paradigm | Pure functions only; readonly types throughout; no classes; no input mutation; LRU eviction expressed in three readable lines |
| Public API drift vs §6.5 | Zero — `pushEntry`, `goBack`, `goForward`, `canGoBack`, `canGoForward` match the contract verbatim |

### Notable Engineering Decisions

- **Property test (03-06) uses a weighted action arbitrary** — 3:1:1
  push:back:forward — with `minLength: 60` and `size: "max"` so the sequence
  routinely exceeds the 50-cap and truly exercises the eviction logic. Default
  `numRuns=100`. Inline comment documents the weighting rationale; explicitly
  guards against the loop-of-one Testing Theater pattern called out in
  pass-1 review.
- **`headIndex: -1` sentinel for `emptyHistory`** — encodes "no head yet" as
  the only representable state where `entries.length === 0`. The sentinel
  handles the empty-history edge across all five functions without
  special-casing: `pushEntry` yields `headIndex 0`; `goBack` and `goForward`
  no-op via existing guards; `canGoBack` and `canGoForward` both return
  `false`. Eliminates a null/undefined branch in every consumer. Pass-2 review
  validated as mathematically sound across all functions.
- **3 of 7 steps were validation-only** (03-03, 03-04, 03-07) — RED passed
  without production change because earlier steps already implemented the
  contract correctly. Pass-1 review explicitly verified this is genuine via
  per-step deletion tests (revert the relevant code in production → primary
  assertion fails) and not Fixture Theater. Validation-only is a legitimate
  outside-in artefact when an earlier step's incidental implementation
  already satisfies a later scenario's contract.
- **`enforceLruCap` extracted in refactor-03** — L1 + L4 sweep before mutation
  testing. The pure helper isolates the cap-boundary logic from the
  truncate-then-append pipeline, making the surviving cap-equality mutants
  trivially provable as equivalent during the mutation run.
- **PREPARE phase logged for all 7 Phase 03 steps via DES CLI** — closes the
  Phase 02 process gap (which had required retrospective `BACKFILL:` PREPARE
  entries for steps 02-02 and 02-04). No backfill required for Phase 03.

### Outside-In TDD Notes

All seven Phase 03 scenarios are exercised exclusively through the five
public driving-port functions — the `enforceLruCap` helper extracted in
refactor-03 is not exported and not referenced by any test. Pass-1 review
verified deletion tests for every step including the three validation-only
steps: reverting the relevant guard or branch causes the primary assertion
to fail (truncation revert → forward tail leaks; lower-bound guard revert →
`headIndex` decrements to -1; LRU cap revert → `entries.length` reaches 51).
No Testing Theater patterns present. Property test (03-06) is the
counterexample to the loop-of-one anti-pattern: 100 runs over weighted
sequences of 60+ actions, with the `MAX_HISTORY_ENTRIES` invariant asserted
on every reduced state.

### Long-Standing Gap Closed

Dependency-cruiser config now actually enforces architecture §4 rules for
`src/plugins/norbert-config/domain/**`:

- `no-tauri-from-config-domain` — forbids `@tauri-apps/*` imports
- `no-react-from-config-domain` — forbids `react` and `react-dom` imports
- `no-views-from-config-domain` — forbids imports from
  `src/plugins/norbert-config/views/**`

The three phases of this feature (registry / resolver / nav) were FP-clean
by discipline only until this remediation — the prior config covered only
the phosphor domain in `norbert-usage`. Pass-1 review's MEDIUM finding
(`.dependency-cruiser.cjs no rule for norbert-config/domain/**`) flagged the
gap explicitly, and remediation-03 closes it for all three phases at once.
The fourth rule from architecture §4 (`detection-strategies-isolated`) is
deferred until the detection module exists in the next wave.

### Open Debt

Carried forward from earlier phases — no net new Phase 03 debt:

- **Phase 01 LOWs** (×4): `buildRegistry` JSDoc lacks initialisation
  convention; `entryFromPlugin` source inline rationale; `make500ItemConfig`
  fixture missing `rules` and `plugins`; `normalisePath` does not flag
  `~user/` and Windows drive-letter paths as v1 gaps.
- **Phase 02 LOW** (×1): `NavEntry` (this module) vs `HistoryEntry` (ADR-006
  spec) terminology drift — one-line type alias bridge to land at the
  reducer integration step.
- **Deferred `it.skip` scenarios** (×3) in `registry.test.ts` (unknown-name
  returns empty list, version increments on rebuild, cross-scope collision
  via `makeAggregatedConfig`) — not in walking-skeleton scope, still in
  scope for a future polish wave, no regressions.

### Files Touched

#### Production
- `src/plugins/norbert-config/domain/nav/history.ts` (NEW)

#### Tests
- `tests/acceptance/config-cross-references/history.test.ts` (NEW — 10 `it` cases across 10 describe blocks)
- `tests/acceptance/config-cross-references/_helpers/fixtures.ts` (MODIFIED — adds `makeHistoryWith4Entries`, `emptyHistory`, `makeFiftyEntries`)

#### Mutation tooling
- `stryker.config-cross-references-history.conf.json` (NEW — scoped to history only)
- `vitest.mutation.config-cross-references-history.ts` (NEW — includes only `history.test.ts`)

#### Architectural enforcement
- `.dependency-cruiser.cjs` (MODIFIED — adds 3 forbidden rules covering `src/plugins/norbert-config/domain/**`)

#### DELIVER artefacts
- `docs/feature/config-cross-references/deliver/roadmap.json` (extended with Phase 03)
- `docs/feature/config-cross-references/deliver/roadmap-review-phase-03.yaml` (NEW)
- `docs/feature/config-cross-references/deliver/review-pass-1-phase-03.yaml` (NEW)
- `docs/feature/config-cross-references/deliver/review-pass-2-phase-03.yaml` (NEW)
- `docs/feature/config-cross-references/deliver/execution-log.json` (extended)
- `docs/feature/config-cross-references/deliver/mutation/history-mutation-summary.md` (NEW)
- `docs/feature/config-cross-references/deliver/mutation/history-stryker-report.json` (NEW)
- `docs/feature/config-cross-references/deliver/mutation/history-mutation-report.html` (NEW)

### Next Wave Pointer

Continue from `walking-skeleton.md` step 8 onward:

1. `reducer.test.ts` — pure `ConfigNavReducer` covering all action
   transitions; brings registry, resolver, and history together into the
   navigation state machine (US-103, US-105, US-106)
2. Detection strategies 1 + 2 (markdown link + inline code; produces
   `Reference` values for `resolve()`)
3. `NavAnnouncer` ARIA live region (DESIGN §6.8)
4. React `ConfigNavProvider` + first user-visible scenario (US-110, KPI sink)

The `canGoBack` / `canGoForward` predicates are the contract surface for the
Provider's Alt+Left / Alt+Right end-of-history cue; consumers should call
the predicates rather than re-deriving the bound check from `headIndex` and
`entries.length`.

---

## Phase 04 — ConfigNavReducer (2026-04-22)

**Wave segment**: DELIVER (navigation state machine — the action-driven core that the Provider will dispatch into)
**Paradigm**: functional
**Crafter**: nw-functional-software-crafter

### Scope Shipped

The pure-domain `ConfigNavReducer` module (architecture §6.4) at
`src/plugins/norbert-config/domain/nav/reducer.ts`. Public surface:
`reduce()` driving port, `ConfigNavState`, `ConfigNavAction` discriminated
union (5 walking-skeleton variants), `SplitState` (ADR-009 fixed-shape
2-pane record), `FilterByTab`, and `DisambiguationState` (forward-declaration
stub for the future ambiguity popover). Internal helpers `resolveFilterOnNav`
and `refTypeToSubTab`. Twelve TDD steps, one per behaviour, followed by a
refactor pass, a mutation pass, and a consolidated remediation closing all
open review findings:

| Step | Behaviour |
|------|-----------|
| 04-01 | Stub reducer surface + `refSingleClick` open-from-empty (split with topRef from current selection, bottomRef from target, +1 history entry) |
| 04-02 | `refSingleClick` in open split replaces `bottomRef` only, preserving `topRef` |
| 04-03 | `refCtrlClick` across sub-tabs is atomic — single returned state with `activeSubTab`, `selectedItemKey`, `splitState: null`, and history all updated together |
| 04-04 | `refCtrlClick` within same sub-tab swaps selection only (validation-only — 04-03's unconditional sub-tab assignment is idempotent) |
| 04-05 | `refCtrlClick` closes any open split as part of the commit (validation-only — 04-03 already sets `splitState: null` unconditionally) |
| 04-06 | `refCtrlClick` preserves a filter that already shows the target (ADR-007 Rule 2) |
| 04-07 | `refCtrlClick` resets a destination filter that would hide the target + emits `filterResetCue` (ADR-007 Rule 3) |
| 04-08 | `refSingleClick` on a dead `ResolvedRef` is a complete no-op (validation-only — early-return guard from 04-01) |
| 04-09 | `refCtrlClick` on a dead `ResolvedRef` is a complete no-op (validation-only — early-return guard from 04-03) |
| 04-10 | `selectItem` updates focus without pushing history (ADR-008) |
| 04-11 | `switchSubTab` updates active sub-tab and resets `selectedItemKey` to null without pushing history (ADR-008) |
| 04-12 | `closeSplit` collapses the split to null and pushes one history entry (ADR-008) |

### Wave Timeline

| Wave | Commit | Notes |
|------|--------|-------|
| DELIVER 04-01 | `157adc7` | Stub module + `refSingleClick` open-from-empty foundation |
| DELIVER 04-02 | `65e6795` | `refSingleClick` bottom-replace branch when split is open |
| DELIVER 04-03 | `3828031` | `refCtrlClick` atomic cross-tab — single returned state with all 4 fields |
| DELIVER 04-04 | `f09f491` | `refCtrlClick` same-tab — validation-only un-skip |
| DELIVER 04-05 | `02af33e` | `refCtrlClick` closes open split — validation-only un-skip |
| DELIVER 04-06 | `307a29d` | `refCtrlClick` preserves matching filter (ADR-007 Rule 2) |
| DELIVER 04-07 | `7e9fb21` | `refCtrlClick` resets mismatched filter + cue (ADR-007 Rule 3) |
| DELIVER 04-08 | `862ef2a` | `refSingleClick` on dead — validation-only un-skip |
| DELIVER 04-09 | `b8995f7` | `refCtrlClick` on dead — validation-only un-skip |
| DELIVER 04-10 | `60a8197` | `selectItem` no history push (ADR-008) |
| DELIVER 04-11 | `df23209` | `switchSubTab` no history push + reset selection (ADR-008) |
| DELIVER 04-12 | `d97aa13` | `closeSplit` collapses + pushes history (ADR-008) |
| DELIVER refactor-04 | `74dfc54` | L1 + L3 + L2 sweep — extracted `handleRefSingleClick` / `handleRefCtrlClick` / `resolveFilterOnNav` / `refTypeToSubTab`; reducer reduced to a flat dispatcher with `never`-typed exhaustiveness check |
| DELIVER mutation-04 | `9fca024` | Stryker run on reducer only (separate scoped config); 97.40% kill rate (75/77) after three iterations |
| DELIVER remediation-04 | `d9eb7a6` | Consolidated remediation closing the HIGH `switchSubTab` `splitState` bug + 4 polish closures |

### What This Enables

The navigation state machine is now complete. Three pure-domain prerequisites
(registry, resolver, history) are composed into a single dispatchable reducer:

- **`ConfigNavProvider`** (architecture §6.6) — can now wrap the reducer with
  React Context + `useReducer`, dispatching `ConfigNavAction` values from DOM
  event handlers and exposing the state to the Configuration view tree. The
  Provider's keyboard handler reads `canGoBack` / `canGoForward` from the
  embedded `NavHistory`; click handlers translate DOM events into
  `refSingleClick` / `refCtrlClick` actions. Now unblocked.
- **Detection step (walking-skeleton step 9)** — the remark plugin that
  detects references inside markdown content; produces `Reference` values for
  `resolve()`. The reducer's action surface is the consumer.
- **NavAnnouncer (walking-skeleton step 10)** — the ARIA live region that
  reads `filterResetCue` and `endOfHistory` transients and announces them.
  The reducer is the producer of both transients.
- **First user-visible scenario (walking-skeleton step 11)** — Provider +
  detection + announcer wired together. **This is where the Configuration
  tab finally gets actual clickable references in the UI for the first time.**

### Quality Summary

| Dimension | Result |
|-----------|--------|
| Live acceptance scenarios | 17 (12 outcome scenarios + 5 mutation-coverage describe blocks; the cross-tab map case is one parametrised describe with 5 `it.each` entries, totalling 21 `it` cases across 17 describe blocks) |
| Mutation kill rate | **97.40%** (75/77 mutants killed; gate ≥ 80%) |
| NoCoverage mutants | 2 — both on the `default:` branch of the `switch (action.tag)` exhaustiveness check; statically unreachable under the discriminated union (TS narrows to `never`). Mirrors the Phase 01 registry and Phase 02 resolver residuals — TypeScript-`never` exhaustiveness branches are an architectural pattern across the feature. |
| Surviving mutants | 0 |
| DES execution log entries | 28 roadmap steps complete (12 Phase 04 TDD + refactor-04 + mutation-04 + remediation-04, with synthetic IDs for the three non-TDD steps); PREPARE logged for all 12 Phase 04 steps via DES CLI |
| Reviews (DELIVER) | 2 — pass-1 TDD/Theater approved (2 LOW); pass-2 API/maintainability initially **rejected** with 1 HIGH + 2 MEDIUM + 2 LOW; all 5 closed in remediation commit `d9eb7a6` |
| DES integrity | 28/28 steps complete (verify_deliver_integrity passes) |
| Architectural rules | dependency-cruiser clean; reducer imports only `ConfigSubTab`, `RefType`, `RegistryEntry` (type-only), `ResolvedRef` (type-only), and `pushEntry` / `NavEntry` / `NavHistory` from history; no `node:*`, no React, no Tauri |
| FP paradigm | Pure functions only; readonly types throughout; `never`-typed exhaustiveness check; no input mutation; atomic single-return updates per ADR-002 |
| Public API drift vs §6.4 | One known deviation — see "Notable Engineering Decisions" below (`refSingleClick.currentEntry` payload) |

### Notable Engineering Decisions

- **`refSingleClick` action carries `currentEntry: RegistryEntry | null`** as
  an action payload because the reducer needs the spatial anchor for the
  open-from-empty case (no existing split, no current `selectedItemKey` that
  resolves to an entry — the Provider must supply the click-target's owning
  list-row entry directly). This deviates from ADR-002's canonical action
  table, which expected the reducer to read the anchor from state. The
  deviation is documented in the module JSDoc; back-propagation to the ADR
  is deferred to a future polish wave when the bottom-replace path's
  `currentEntry`-ignored semantics get the same treatment. No Provider
  ergonomics impact — the click handler always knows the row it came from.
- **`refCtrlClick` atomic update per architecture §6.7** — six fields
  (`activeSubTab`, `selectedItemKey`, `splitState`, `history`, `filter`,
  `filterResetCue`) are updated in a single returned state with no
  intermediate render. Atomicity is by construction: one return statement
  composes the next state. The 2-slot fixed-shape `SplitState` (ADR-009)
  makes a third pane a compile-time impossibility, eliminating an entire
  class of split-management bugs at the type level.
- **`resolveFilterOnNav` helper implements ADR-007 mismatch-only-clears
  semantics** — only the destination sub-tab's `source` filter clears,
  other sub-tab filters are preserved (spread through unchanged), and the
  destination's `sort` dimension is preserved (the user's chosen order
  survives a cross-reference navigation). Three rules in order: no filter
  to act on (Rule 1), filter already shows target (Rule 2), mismatch (Rule
  3 — clear + emit cue). Inline in `reducer.ts` for now; extraction to
  `domain/nav/filter.ts` per ADR-007's implementation note is open debt
  for a future refactor wave.
- **`popover` field type widened to `DisambiguationState | null` with a
  forward-declaration stub** — done in remediation after pass-2 review
  flagged the literal-`null` typing as an avoidable cascade when the
  future `openDisambiguation` action lands. Defining the type now (with
  `null` initialised at every construction site) makes that future action
  a purely additive change instead of an interface widening that would
  cascade to every `ConfigNavState` construction site including
  `initialNavState`.
- **NavEntry provenance key renamed `action` → `source`** — done in
  remediation to align with ADR-008's contract (every history entry carries
  `{ source: 'refSingleClick' | 'refCtrlClick' | 'closeSplit' | ... }`).
  NavEntry is opaque so no runtime error existed today, but the
  NavAnnouncer step (walking-skeleton step 10) will expect `source` and
  would have found `action` — silent mismatch caught at the right time.
- **4 of 12 steps were validation-only** (04-04, 04-05, 04-08, 04-09) —
  RED passed without production change because earlier steps already
  implemented the contract correctly. 04-04 and 04-05 ride 04-03's
  unconditional field assignments (`activeSubTab` is idempotent on same-tab
  targets; `splitState: null` is set unconditionally regardless of prior
  split). 04-08 and 04-09 ride the early-return live-tag guards from 04-01
  and 04-03. Pass-1 review explicitly verified each is genuine via deletion
  tests (revert the relevant guard or branch in production → primary
  assertion fails) and not Fixture Theater.
- **PREPARE phase logged for all 12 Phase 04 steps via DES CLI** — closes a
  recurring concern from prior phases (Phase 02 had required retrospective
  `BACKFILL:` PREPARE entries for 02-02 and 02-04). Phase 03 closed the
  habit gap; Phase 04 sustains it across a 12-step phase. No backfill
  required.

### Real Bug Caught By Review Pass 2

`switchSubTab` was missing `splitState: null` despite architecture §6.4
specifying the effect as `activeSubTab, selectedItemKey=null, splitState=null`.
The reducer implementation spread `...state` and overrode only `activeSubTab`
and `selectedItemKey`, leaving `splitState` intact. A user who manually
tab-switches while a preview split is open would have seen the split persist
with a top-pane reference now belonging to a different sub-tab — a
stale-split UI bug. No test caught it because the `switchSubTab` test did
not arrange an open split as a pre-condition. The HIGH-severity catch in
pass-2 review validates the double-review investment in the rigor profile —
a behavioural bug would have shipped through to the Provider integration
wave otherwise. Closed in remediation commit `d9eb7a6` with a new test that
arranges open split before `switchSubTab` and asserts `next.splitState ===
null`.

### Outside-In TDD Notes

All 17 Phase 04 scenarios (12 original + 5 mutation-coverage) are exercised
exclusively through the `reduce()` driving port — the four internal helpers
(`handleRefSingleClick`, `handleRefCtrlClick`, `resolveFilterOnNav`,
`refTypeToSubTab` / `REF_TYPE_TO_SUB_TAB`) are not exported and not
referenced by any test. Pass-1 review verified deletion tests for every
step including the four validation-only steps: reverting the relevant
guard or branch causes the primary tag assertion to fail (split not
opened, `topRef` replaced when it should be preserved, dead-ref proceeds
into `ref.entry` access and throws, `selectedItemKey` not reset, etc.).
No Testing Theater patterns present across the eight checked patterns.

### Long-Standing Process Improvement

PREPARE phase logged for **all 12** Phase 04 steps via DES CLI at the time
of action, not retrospectively. Prior phases (notably Phase 02) had
required `BACKFILL:`-prefixed PREPARE entries reconstructed after the fact
because the DES CLI was not called when the prepare work happened. Phase
03 was the first phase to close the gap; Phase 04 sustains it across a
larger-step phase. The pattern is now established as the working norm for
this feature.

### Open Debt

Carried forward from earlier phases — none net new from Phase 04 after
remediation:

- **Phase 01 LOWs** (×4): `buildRegistry` JSDoc lacks initialisation
  convention; `entryFromPlugin` source inline rationale; `make500ItemConfig`
  fixture missing `rules` and `plugins`; `normalisePath` does not flag
  `~user/` and Windows drive-letter paths as v1 gaps.
- **Phase 02 LOW** (×1): `NavEntry` (history module) vs `HistoryEntry`
  (ADR-006 spec) terminology drift — partially addressed via the Phase 04
  remediation `action` → `source` provenance-key rename, which aligns the
  reducer's NavEntry payloads with what the NavAnnouncer will expect; the
  type-name bridge from `NavEntry` to `HistoryEntry` is still open for the
  reducer integration step.
- **Deferred `it.skip` scenarios** (×3) in `registry.test.ts` (unknown-name
  returns empty list, version increments on rebuild, cross-scope collision
  via `makeAggregatedConfig`) — not in walking-skeleton scope, still in
  scope for a future polish wave, no regressions.
- **Phase 04 LOW** (×1): `resolveFilterOnNav` extraction to
  `domain/nav/filter.ts` per ADR-007's implementation note — currently
  inline in `reducer.ts`; deferred to a future refactor wave.
- **Phase 04 LOW** (×1): step 04-05 `RED_ACCEPTANCE` execution-log entry
  records status `PASS` without the `VALIDATION_ONLY` qualifier used
  consistently for other validation-only steps (04-04, 04-08, 04-09). The
  DES log is append-only so the precision gap is permanent in the record;
  no production impact.
- **Milestone-2 reducer property tests** (×2): `splitState !== null` ⇒
  `selectedItemKey === topRef.itemKey` invariant; reducer-level history-cap
  invariant under arbitrary action sequences — both deferred from this
  phase by design (milestone-2 scope per the roadmap).

### Files Touched

#### Production
- `src/plugins/norbert-config/domain/nav/reducer.ts` (NEW)

#### Tests
- `tests/acceptance/config-cross-references/reducer.test.ts` (NEW — 17 describe blocks; 12 outcome + 5 mutation-coverage; 21 `it` cases including a parametrised `it.each` over 5 RefType→sub-tab mappings)
- `tests/acceptance/config-cross-references/_helpers/fixtures.ts` (MODIFIED — adds `initialNavState` and `refTo` helpers for reducer tests)

#### Mutation tooling
- `stryker.config-cross-references-reducer.conf.json` (NEW — scoped to reducer only)
- `vitest.mutation.config-cross-references-reducer.ts` (NEW — includes only `reducer.test.ts`)

#### DELIVER artefacts
- `docs/feature/config-cross-references/deliver/roadmap.json` (extended with Phase 04)
- `docs/feature/config-cross-references/deliver/roadmap-review-phase-04.yaml` (NEW)
- `docs/feature/config-cross-references/deliver/review-pass-1-phase-04.yaml` (NEW)
- `docs/feature/config-cross-references/deliver/review-pass-2-phase-04.yaml` (NEW — initially rejected; closed in remediation `d9eb7a6`)
- `docs/feature/config-cross-references/deliver/execution-log.json` (extended; 28 roadmap steps + synthetic IDs for refactor-04 / mutation-04 / remediation-04)
- `docs/feature/config-cross-references/deliver/mutation/reducer-mutation-summary.md` (NEW)
- `docs/feature/config-cross-references/deliver/mutation/reducer-stryker-report.json` (NEW)
- `docs/feature/config-cross-references/deliver/mutation/reducer-mutation-report.html` (NEW)

### Next Wave Pointer

Continue from `walking-skeleton.md` step 9 onward:

1. `detection.test.ts` — the remark plugin that detects references inside
   markdown content; produces `Reference` values for the reducer's action
   payloads via `resolve()`
2. `announcements.test.ts` — `NavAnnouncer` ARIA live region (DESIGN §6.8);
   reads `filterResetCue` and `endOfHistory` transients from the reducer
3. React `ConfigNavProvider` + first user-visible scenario (US-110, KPI sink)
   — **step 11 is where the Configuration tab gets actual clickable
   references in the UI for the first time**

The `reduce()` driving port and the `ConfigNavAction` discriminated union
are the contract surface for the Provider's `useReducer` integration;
consumers should construct action values rather than reaching for internal
helpers. The five walking-skeleton action variants are stable; future
variants (`historyBack`, `historyForward`, `openDisambiguation`,
`clearFilterResetCue`, `acknowledgeEndOfHistory`) will land additively
against the existing `default: never` exhaustiveness branch.

---

## Phase 05 — Detection Pipeline (2026-04-23)

**Wave segment**: DELIVER (detection slice — the pure remark plugin that turns markdown content into annotated MDAST that `react-markdown`'s `components` map renders as `ReferenceToken`s)
**Paradigm**: functional
**Crafter**: nw-functional-software-crafter

### Scope Shipped

The pure-domain detection module at
`src/plugins/norbert-config/domain/references/detection/`. Six files:
`types.ts` (DetectionStrategy, DetectionContext, MdastNode, ReferenceTokenData),
`applyAnnotation.ts` (extracted in refactor-05 — shared `annotate` helper),
`inlineCodeStrategy.ts`, `markdownLinkStrategy.ts`, `pipeline.ts` (DETECTION_PIPELINE
const + composePipeline), and `remarkPlugin.ts` (the unified-compatible
`detectionRemarkPlugin(registry, ctx)` factory). Detects 4 reference variants
(live, ambiguous, dead, unsupported) across 2 source kinds (markdown links,
inline code) and annotates MDAST nodes with `data.hName='reference-token'`
plus typed `data.hProperties` for `react-markdown`'s `components` map. Seven
TDD steps, one per behaviour, followed by a refactor pass, a mutation pass,
and a consolidated remediation closing two of the four open review findings:

| Step | Behaviour |
|------|-----------|
| 05-01 | Stub detection module surface + inline-code live token (annotates `inlineCode` matching a known agent name) |
| 05-02 | Fenced code blocks not annotated (validation-only — `unist-util-visit` does not visit `code` nodes by default) |
| 05-03 | Bare prose not annotated by default per ADR-010 (validation-only — pipeline contains no bare-prose strategy) |
| 05-04 | Markdown link to a known skill renders live token (`detectMarkdownLink` prepended to DETECTION_PIPELINE per ADR-010 canonical order) |
| 05-05 | Reference to a missing item renders dead token (RED→GREEN — removed an early-return on `dead` from `markdownLinkStrategy`) |
| 05-06 | Multi-scope match renders ambiguous token + emits `data-ref-candidate-count` (additive hProperty) |
| 05-07 | Unsupported item type renders unsupported token + emits `data-ref-target-path` (additive hProperty) |

### Wave Timeline

| Wave | Commit | Notes |
|------|--------|-------|
| DELIVER 05-01 | `25084bf` | Stub module + inline-code live + `detection-strategies-isolated` dep-cruiser rule + `unist-util-visit` direct-dep promotion |
| DELIVER 05-02 | `e55d868` | Fenced code not annotated — validation-only un-skip |
| DELIVER 05-03 | `c646413` | Bare prose not annotated — validation-only un-skip |
| DELIVER 05-04 | `9aefd87` | `markdownLinkStrategy` + pipeline prepend per ADR-010 canonical order |
| DELIVER 05-05 | `caf3db7` | Dead variant — genuine RED→GREEN (removed early-return on `dead` from link strategy) |
| DELIVER 05-06 | `41722f9` | Ambiguous variant + `data-ref-candidate-count` additive hProperty |
| DELIVER 05-07 | `d8e49ba` | Unsupported variant + `data-ref-target-path` additive hProperty |
| DELIVER refactor-05 | `52c5c42` | L1 + L2 + L4 sweep — extracted `applyAnnotation.ts` shared helper; both strategies delegate; +129/-150 across 5 files; public surface byte-equivalent |
| DELIVER mutation-05 | `14fa65a` | Stryker run on detection only (separate scoped config); 96.15% kill rate (75/78) after three iterations |
| DELIVER remediation-05 | `b01432d` | Consolidated remediation closing 2 of 4 open LOWs from review pass-1/pass-2 |

### What This Enables

The detection module is the last pure-domain prerequisite before the React
rendering layer. Three pure-domain prerequisites (registry, resolver, history),
the navigation state machine (reducer), and now the MDAST-annotation pipeline
are composed into the full producer side of the cross-reference flow:

- **`ConfigDetailPanel`** (architecture §6.9, walking-skeleton step 11) — can
  now wire `detectionRemarkPlugin(registry, ctx)` into `react-markdown`'s
  `remarkPlugins` prop and render the four reference token variants via the
  `components={{ 'reference-token': ReferenceToken }}` custom-component map.
  **Step 11 is where the Configuration tab finally gets actual clickable
  references in the UI for the first time.** The detection plugin's contract
  is byte-equivalent to what step 11 expects per architecture §6.2.
- **`NavAnnouncer`** (walking-skeleton step 10) — the pure
  `announcementFor(prev, next)` helper that reads `filterResetCue` and
  `endOfHistory` transients from the reducer and produces text for the
  ARIA live region. Detection is now no longer a blocker for that step.
- **Forward-compat for `bareProseStrategy`** (R3, US-111) — the extracted
  `applyAnnotation.ts` helper lets a future bare-prose strategy reuse the
  same annotation surface without duplicating the `data.hName` /
  `data.hProperties` construction.

### Quality Summary

| Dimension | Result |
|-----------|--------|
| Live acceptance scenarios | 12 (7 outcome scenarios + 5 mutation-coverage describe blocks for direct-strategy guard tests) |
| Mutation kill rate | **96.15%** (75/78 mutants killed; gate ≥ 80%) |
| NoCoverage mutants | 1 — `applyAnnotation.ts:34:47` `?? ""` StringLiteral fallback; unreachable under the resolver's ambiguous-arity invariant (candidates.length ≥ 2) |
| Surviving mutants | 2 — both equivalent: (1) `inlineCodeStrategy.ts:43` `typeof value === "string" -> true` is unreachable because `lookupByName` is `Map.get` keyed by string and any non-string lookup misses returning `dead` which short-circuits; (2) `applyAnnotation.ts:34:12` `candidates[0]?.itemKey -> candidates[0].itemKey` defensive optional-chain that the resolver's arity invariant renders identical |
| DES execution log entries | 35 roadmap steps complete (7 Phase 05 TDD + refactor-05 + mutation-05 + remediation-05, with synthetic IDs for the three non-TDD steps); PREPARE logged for all 7 Phase 05 steps via DES CLI |
| Reviews (DELIVER) | 2 — pass-1 TDD/Theater approved (2 LOW); pass-2 API/maintainability approved (2 LOW); 2 of 4 closed in remediation `b01432d`, 2 deferred to this finalize back-propagation |
| Reviews (roadmap) | 2 — initial review rejected with 1 BLOCKER (dep-cruiser rule absent) + 1 MEDIUM (package.json missing) + 2 LOW; revision-1 approved with all 4 closed |
| DES integrity | 35/35 steps complete (verify_deliver_integrity passes) |
| Architectural rules | dependency-cruiser now enforces all 4 architecture §4 rules including `detection-strategies-isolated` (the long-deferred rule from Phase 03 remediation); detection module clean |
| FP paradigm | Pure functions only; readonly types throughout; mutation-in-place on `node.data` is the standard unified/remark convention and documented in source |
| Public API drift vs §6.2 | Two additive hProperties (`data-ref-candidate-count`, `data-ref-target-path`) — back-propagated to architecture §6.2 in this finalize step |

### Notable Engineering Decisions

- **`detection-strategies-isolated` dep-cruiser rule landed** — closes the
  long-standing gap from Phase 03 remediation where rule 4 from architecture
  §4 was explicitly deferred until the detection module shipped. The rule
  forbids any cross-strategy import inside `detection/`; the allowlist
  permits only the detection types module, the registry types, the resolver,
  and `unist-util-visit`. The resolver addition is a documented deviation
  from the architecture §4 wording (which originally listed only types +
  visit + registry); the strategies need `resolve()` to classify outcomes,
  so the resolver is correctly part of the allowlist. Now machine-enforces
  strategy isolation.
- **`unist-util-visit` promoted from transitive to direct dependency** —
  was already resolved via `remark-gfm`; this phase adds the explicit
  `package.json` declaration so a future `remark-gfm` upgrade cannot drop
  the transitive resolution and silently break the strategy implementations.
  The lockfile update is a downstream consequence, not the change itself.
- **Asymmetric dead-handling between the two strategies** — the
  `markdownLinkStrategy` annotates dead refs as tokens (so the React
  rendering layer can show a strikethrough + tooltip per US-107). The
  `inlineCodeStrategy` leaves dead inline-code as plain code: an inline-code
  mention with no registry hit is just code (a shell command, a library
  call, a literal value), not a "broken reference". The design decision
  emerged from the test discipline during 05-05 and is now locked by an
  explicit acceptance test added in remediation-05 (asserts that an unknown
  inline-code name produces zero annotations). The asymmetry is documented
  in the architecture §6.2 back-propagation as part of this finalize.
- **`applyAnnotation.ts` extracted in refactor-05** before mutation testing
  — the shared `annotate` helper closes a duplication concern that pass-2
  review would otherwise have raised, and produces forward-compat for the
  future `bareProseStrategy` (R3, US-111). The refactor was 5 files
  changed, +129/-150, and the public surface remained byte-equivalent —
  every test passed unchanged.
- **Additive hProperties** (`data-ref-candidate-count`,
  `data-ref-target-path`) — both shipped during 05-06 and 05-07
  respectively. The React rendering layer needs them for the
  disambiguation popover (read candidate count without re-querying the
  registry) and the unsupported-token tooltip (read the original path
  without re-parsing the link). Flagged for back-propagation in three
  locations each (source comment, roadmap implementation_notes, test file
  comment) and now back-propagated to architecture §6.2 in this finalize.
- **Genuine RED→GREEN at 05-05** — only one of the seven TDD steps moved
  the production code through a real RED→GREEN cycle (the rest were
  validation-only or new-strategy-introductions). 05-05 specifically
  removed an early-return on `dead` from `markdownLinkStrategy` so dead
  links would annotate. Pass-1 review verified this is genuine via a
  deletion test (re-adding the early-return causes the dead test's
  `hName === "reference-token"` assertion to fail).

### Long-Standing Process Improvement

PREPARE phase logged for **all 7** Phase 05 steps via DES CLI at the time
of action, not retrospectively. Phases 03 and 04 established the discipline;
Phase 05 sustains it. No `BACKFILL:`-prefixed entries needed. The pattern
is now the entrenched working norm for this feature.

### Outside-In TDD Notes

All 12 Phase 05 scenarios (7 walking-skeleton + 5 mutation-coverage
direct-strategy guard tests) are exercised exclusively through the
`detectionRemarkPlugin(registry, ctx)` driving port and (for the guard
tests) the strategy `apply()` methods. The internal `applyAnnotation.ts`
helper extracted in refactor-05 is not exported beyond the detection
package boundary and not referenced directly by any test. Pass-1 review
verified deletion tests for every step including the validation-only
steps (05-02, 05-03) and the genuine RED→GREEN step (05-05). No Testing
Theater patterns present across the eight checked patterns.

### Open Debt

Carried forward from earlier phases — none net new from Phase 05 after
remediation:

- **Phase 01 LOWs** (×4): `buildRegistry` JSDoc lacks initialisation
  convention; `entryFromPlugin` source inline rationale; `make500ItemConfig`
  fixture missing `rules` and `plugins`; `normalisePath` does not flag
  `~user/` and Windows drive-letter paths as v1 gaps.
- **Phase 02 LOW** (×1): `NavEntry` (history module) vs `HistoryEntry`
  (ADR-006 spec) terminology drift — partially addressed via the Phase 04
  remediation `action` → `source` provenance-key rename; the type-name
  bridge from `NavEntry` to `HistoryEntry` is still open for the reducer
  integration step.
- **Deferred `it.skip` scenarios** (×3) in `registry.test.ts`
  (unknown-name returns empty list, version increments on rebuild,
  cross-scope collision via `makeAggregatedConfig`) — not in walking-
  skeleton scope, still in scope for a future polish wave, no regressions.
- **Phase 04 LOW** (×1): `resolveFilterOnNav` extraction to
  `domain/nav/filter.ts` per ADR-007's implementation note — currently
  inline in `reducer.ts`; deferred to a future refactor wave.
- **Phase 04 LOW** (×1): step 04-05 `RED_ACCEPTANCE` execution-log entry
  records status `PASS` without the `VALIDATION_ONLY` qualifier — DES log
  is append-only so the precision gap is permanent in the record.
- **Phase 05 LOW** (×1, process improvement): 05-05 `RED_ACCEPTANCE`
  d-field reads `"PASS"` without an explicit `PASS_IMMEDIATELY` /
  `VALIDATION_ONLY` / `GENUINE_RED` qualifier. Future phases should adopt
  `d: "PASS: genuine RED — <description>"` vs.
  `d: "PASS_IMMEDIATELY: outcome (b) — <reason>"` for self-contained DES
  log inspection.
- **Milestone-2 reducer property tests** (×2): `splitState !== null` ⇒
  `selectedItemKey === topRef.itemKey` invariant; reducer-level
  history-cap invariant under arbitrary action sequences — both deferred
  by design (milestone-2 scope per the roadmap).

### Files Touched

#### Production
- `src/plugins/norbert-config/domain/references/detection/types.ts` (NEW)
- `src/plugins/norbert-config/domain/references/detection/applyAnnotation.ts` (NEW — extracted in refactor-05)
- `src/plugins/norbert-config/domain/references/detection/inlineCodeStrategy.ts` (NEW)
- `src/plugins/norbert-config/domain/references/detection/markdownLinkStrategy.ts` (NEW)
- `src/plugins/norbert-config/domain/references/detection/pipeline.ts` (NEW)
- `src/plugins/norbert-config/domain/references/detection/remarkPlugin.ts` (NEW)

#### Tests
- `tests/acceptance/config-cross-references/detection.test.ts` (NEW — 12 `it` cases across 12 describe blocks; 7 walking-skeleton + 5 mutation-coverage)
- `tests/acceptance/config-cross-references/_helpers/markdownFixtures.ts` (NEW — `parseMarkdown` helper using remark + remark-gfm)
- `tests/acceptance/config-cross-references/_helpers/fixtures.ts` (MODIFIED — adds detection-aware fixture builders)

#### Mutation tooling
- `stryker.config-cross-references-detection.conf.json` (NEW — scoped to `detection/**/*.ts`)
- `vitest.mutation.config-cross-references-detection.ts` (NEW — includes only `detection.test.ts`)

#### Architectural enforcement
- `.dependency-cruiser.cjs` (MODIFIED — adds the 4th architecture §4 rule `detection-strategies-isolated`)

#### Dependency declaration
- `package.json` (MODIFIED — promotes `unist-util-visit` from transitive to direct dependency)
- `package-lock.json` (MODIFIED — downstream consequence of the dependency promotion)

#### DELIVER artefacts
- `docs/feature/config-cross-references/deliver/roadmap.json` (extended with Phase 05)
- `docs/feature/config-cross-references/deliver/roadmap-review-phase-05.yaml` (NEW — initial review, rejected)
- `docs/feature/config-cross-references/deliver/roadmap-review-phase-05-revision-1.yaml` (NEW — revision-1, approved)
- `docs/feature/config-cross-references/deliver/review-pass-1-phase-05.yaml` (NEW)
- `docs/feature/config-cross-references/deliver/review-pass-2-phase-05.yaml` (NEW)
- `docs/feature/config-cross-references/deliver/execution-log.json` (extended; 35 roadmap steps + synthetic IDs for refactor-05 / mutation-05 / remediation-05)
- `docs/feature/config-cross-references/deliver/mutation/detection-mutation-summary.md` (NEW)
- `docs/feature/config-cross-references/deliver/mutation/detection-stryker-report.json` (NEW)
- `docs/feature/config-cross-references/deliver/mutation/detection-mutation-report.html` (NEW)

#### Architecture back-propagation (this finalize)
- `docs/feature/config-cross-references/design/architecture.md` (§6.1 case-sensitivity sentence + §6.2 hProperties enumeration + asymmetric dead note + Changed Assumptions block + §13 changelog entry)

### Next Wave Pointer

Continue from `walking-skeleton.md` step 10 onward:

1. `announcements.test.ts` — pure `NavAnnouncer` text helper
   `announcementFor(prev, next)` (DESIGN §6.8); reads `filterResetCue` and
   `endOfHistory` transients from the reducer
2. **Step 11 — React `ConfigNavProvider` + first user-visible scenario**
   (US-110, KPI sink) — Provider wraps the reducer with React Context +
   `useReducer`, threads the registry through `useMemo`, wires
   `detectionRemarkPlugin(registry, ctx)` into `ConfigDetailPanel`'s
   `react-markdown` invocation, and registers the Alt+Left/Right window
   listener. **Step 11 is the payoff: the Configuration tab finally gets
   actual clickable references in the UI for the first time.**

The `detectionRemarkPlugin(registry, ctx)` factory is the contract surface
for `ConfigDetailPanel`'s `react-markdown` integration; the React layer
should pass it as `remarkPlugins={[detectionRemarkPlugin(registry, ctx)]}`
without additional wrapping. The four reference token variants
(`'live' | 'ambiguous' | 'dead' | 'unsupported'`) are stable; future
strategies (bare-prose for R3 / US-111) will land additively against the
existing `DETECTION_PIPELINE` const without changing the rendered token
contract.
