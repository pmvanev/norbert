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
