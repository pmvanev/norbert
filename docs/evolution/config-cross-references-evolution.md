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
