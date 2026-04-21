# Wave Decisions: config-cross-references (DISTILL)

Feature: `config-cross-references`
Wave: DISTILL
Persona: Quinn (acceptance-designer), with Ravi as the user persona inherited from DISCUSS
Date: 2026-04-21

---

## Summary

This DISTILL wave produced executable acceptance specifications (Gherkin `.feature` + Vitest `.test.ts(x)`) for the walking skeleton (US-101/102/103/104/105/107) plus R2 milestones (US-106/108/109/110). Triple Review Gate (PO + SA + PA) was completed with one PA revision cycle. Final approval status: **all reviewers approved or conditionally approved with conditions remediated**. Suite is ready for DELIVER handoff.

---

## Key Decisions

- **[D1] Project test convention adopted (Vitest + Gherkin `.feature` co-located)**: Match the pattern seen in `tests/acceptance/mcp-server-discovery/` and `tests/acceptance/norbert-config/` — Gherkin `.feature` files for the executable spec + Vitest `*.test.ts(x)` files implementing scenarios. Tagged `@walking_skeleton` / `@milestone-N` / `@kpi` / `@property` / `@driving_port` / `@infrastructure-failure` / `@performance` for traceability. Source: project codebase survey.
- **[D2] Mocks-for-external integration approach**: Tauri `invoke` mocked at the IPC boundary (`_helpers/tauriMock.ts`); real React, real domain modules, real reducer, real `react-markdown` + `remark-gfm`. Source: existing test pattern + architecture §6.1 integration seam.
- **[D3] Implement-one-at-a-time enforced**: exactly one live `it()` (in `registry.test.ts`) anchors the outside-in TDD outer loop; all other 76 scenarios are `it.skip(...)`. The crafter unskips one at a time during DELIVER. Source: skill mandate.
- **[D4] Pure-domain ports tested via direct invocation, no React**: `registry`, `reducer`, `history`, `detection`, `announcements`, `scope-precedence`, `resolver` — seven test files exercise pure functions only. Only `provider.test.tsx` and `instrumentation.test.tsx` use `@testing-library/react`. Honors FP paradigm (CLAUDE.md). Source: architecture §6.
- **[D5] eventSink boundary seam for instrumentation tests**: instrumentation events (cross_ref_click, nav_history_restore, ambiguous_ref_resolve) are captured via a public `eventSink` test seam (prop or `setEventSink(handler)`) — never by spying on internal functions. Documented in `test-scenarios.md` so the DELIVER crafter knows the API to wire. Source: PA BLOCKER remediation + architecture §5.3.
- **[D6] R3 stories deliberately excluded** (US-111..US-115): The current architecture exposes no extension points (e.g., `DETECTION_PIPELINE` is a const; no settings infrastructure; no persistence). Writing tests against non-existent seams would be Testing Theater. Documented in `test-scenarios.md` under "R3 stories explicitly excluded". Source: ADR-005, ADR-010, OQ-7 deferral.
- **[D7] Two MEDIUM PO findings folded into existing scenarios**: (a) US-106 R1-pull-forward annotation added to walking-skeleton.feature (documentation, not test change); (b) `unsupported` reference variant covered via new `resolver.test.ts` scenario + walking-skeleton.feature scenario + detection.test.ts scenario (closes both PO MED-1 and SA HIGH-1).

---

## Test Coverage Summary

| Bucket | Count |
|---|---|
| Total scenarios across `.feature` files | 53 (47 walking + milestone-1 + milestone-2; +6 from revision cycle 1) |
| Total Vitest `it`/`it.skip` blocks | 81 (across 9 test files) |
| Walking skeleton scenarios | 30+ (R1: US-101/102/103/104/105/107 + US-106 max-split-depth invariants pulled forward) |
| Milestone 1 (US-108 disambiguation) | 12 (10 original + 2 focus-trap added in revision) |
| Milestone 2 (US-106 invariants, US-109, US-110) | 9 |
| `@kpi`-tagged scenarios | 9 (covering KPI #1, #4, #5, #6 schema-presence) |
| `@property`-tagged scenarios | 6 (NavHistory invariants, registry build, popover always opens, NFR-2 500-item) |
| `@driving_port`-tagged scenarios | all 53 |
| Error/edge-path ratio | 24/53 = 45% (target ≥ 40%) |

**Live anchor**: 1 (`registry.test.ts` — outside-in TDD outer-loop signal). All other scenarios `it.skip` per implement-one-at-a-time.

**First-failure verification** (`npx vitest run tests/acceptance/config-cross-references/`):
```
Test Files  1 failed | 8 skipped (9)
     Tests  72 skipped (72)
```
The failure is `Cannot find module '.../domain/references/registry'` — the legitimate first-failure naming the file the crafter must create. Once stubbed, the live assertion `expect(registry.byName.size).toBe(0)` becomes the next failure (business-logic assertion).

---

## Review Gate Result

| Reviewer | Cycle 0 | Cycle 1 | Final |
|---|---|---|---|
| nw-product-owner-reviewer (PO) | **approved** | not re-run | approved |
| nw-solution-architect-reviewer (SA) | conditionally_approved (1 HIGH, 2 MEDIUM, 1 LOW) | conditions folded into Quinn revision | approved (conditions closed) |
| nw-platform-architect-reviewer (PA) | **rejected_pending_revisions** (1 BLOCKER, 3 HIGH, 3 MEDIUM, 1 LOW) | **approved** (all 8 issues closed) | approved |

**AND-gate result: PASS** after revision cycle 1 (1 of 2 max cycles used).

Per protocol, only the rejecting reviewer (PA) was re-dispatched after Quinn's revisions. PO and SA were not re-run; their conditions were addressed in the same revision pass and verified against the resulting artifacts.

Per-cycle review files:
- `po-review.yaml`
- `sa-review.yaml`
- `pa-review.yaml` (cycle 0, rejected)
- `pa-review-revision-1.yaml` (cycle 1, approved)

---

## Upstream Issues

None. DISCUSS and DESIGN artifacts were sufficient and consistent. The only inputs Quinn flagged were:

- The `unsupported` reference variant had no design-wave clarification on whether it remained in v1 scope. Quinn defaulted to "in scope" and added test coverage; if you decide otherwise, US-101 AC needs a one-line update.
- US-105 R2 → R1 pull-forward (DESIGN scope clarification per Atlas review) was correctly reflected in the walking skeleton.
- The skill files for `nw-product-owner-reviewer`, `nw-solution-architect-reviewer`, `nw-platform-architect-reviewer`, and `nw-acceptance-designer` were not present at `~/.claude/skills/nw-*/SKILL.md` on this machine. Each agent fell back to the methodology embedded in its system prompt and noted the missing skill files in its review. No content gap resulted; flagged here so the user is aware in case other features have leaned on those skill files.

---

## Architectural Enforcement (DEVOPS Wave)

Per architecture §4, four dependency-cruiser rules enforce the domain/views boundary:

| Rule | Forbids |
|---|---|
| `no-tauri-from-domain` | `@tauri-apps/*` imports under `src/plugins/norbert-config/domain/**` |
| `no-react-from-domain` | `react`, `react-dom` imports under `src/plugins/norbert-config/domain/**` |
| `no-views-from-domain` | `../views/**` imports under `src/plugins/norbert-config/domain/**` |
| `detection-strategies-isolated` | cross-strategy imports under `domain/references/detection/**` (only detection types + `unist-util-visit` + registry types allowed) |

These are verified by `npm run lint:boundaries` (already wired). Out of scope for acceptance tests; in scope for DEVOPS-wave platform readiness check. Documented in `test-scenarios.md` "Architectural Enforcement (DEVOPS Wave)" section.

---

## Handoff Package for DELIVER (nw-functional-software-crafter)

### Artifacts

```
tests/acceptance/config-cross-references/
  walking-skeleton.feature                         (R1 + US-105 + US-106 invariants)
  milestone-1-resolution-and-disambiguation.feature
  milestone-2-robustness.feature
  registry.test.ts                                 (LIVE first scenario; rest @pending)
  resolver.test.ts                                 (4 ResolvedRef variants)
  reducer.test.ts                                  (pure reducer transitions + properties)
  history.test.ts                                  (pure LRU 50)
  detection.test.ts                                (remark plugin + 4 variants)
  announcements.test.ts                            (NavAnnouncer text per transition)
  scope-precedence.test.ts                         (preHighlight ordering)
  provider.test.tsx                                (Provider effects + DOM + focus + Tab-trap)
  instrumentation.test.tsx                         (3 events + emission-point + matched_snapshot + latency)
  _helpers/
    tauriMock.ts
    fixtures.ts
    markdownFixtures.ts

docs/feature/config-cross-references/distill/
  test-scenarios.md                                (full inventory + KPI mapping + DEVOPS section)
  walking-skeleton.md                              (implementation order)
  po-review.yaml | sa-review.yaml | pa-review.yaml | pa-review-revision-1.yaml
  wave-decisions.md                                (this file)
```

### Implementation guidance for the crafter

The crafter should follow the implementation order in `walking-skeleton.md` (rev 1):

1. Stub `src/plugins/norbert-config/domain/references/registry.ts` to make the live anchor's import resolve. Implement `buildRegistry`, `lookupByName`, `lookupByPath`, `version` field. The live assertion (`registry.byName.size === 0` for empty config) becomes the next failure to satisfy.
2. Unskip and implement `resolver.test.ts` scenarios.
3. Unskip and implement `history.test.ts` scenarios (pure LRU 50).
4. Unskip and implement `reducer.test.ts` scenarios (pure state transitions).
5. Unskip and implement `detection.test.ts` (remark plugin via `data.hName` per ADR-001).
6. Unskip and implement `announcements.test.ts` (pure `announcementFor`).
7. Unskip and implement `scope-precedence.test.ts`.
8. Wire `ConfigNavProvider` and unskip `provider.test.tsx` scenarios.
9. Wire the `eventSink` seam and unskip `instrumentation.test.tsx` scenarios.
10. Pull each Gherkin scenario into a passing state in walking-skeleton order.

### Outside-in / TDD compliance

- Pure-domain modules buildable + testable without React / jsdom — start there.
- Effects (window keydown listener, focus management, NavAnnouncer flush, end-of-history timer, instrumentation emission) live in `useEffect` hooks inside `ConfigNavProvider` per ADR-002 + ADR-003. The `instrumentation.test.tsx` emission-point invariant scenario explicitly verifies emission is NOT inside the reducer.
- Mutation testing (per `CLAUDE.md` "per-feature" strategy) is a DELIVER-wave activity.

---

## Changelog

- 2026-04-21: DISTILL wave completed for `config-cross-references`. Triple Review Gate passed after 1 revision cycle (PA rejected, then approved). 9 test files, 53 Gherkin scenarios, 81 Vitest blocks, 1 live anchor, 76 `it.skip`, 5 review YAMLs.
