# Walking Skeleton: config-cross-references

Wave: DISTILL (revision cycle 1)
Feature: `config-cross-references`
Author: Quinn (acceptance-designer)
Date: 2026-04-21

> **Revision cycle 1**: The live anchor scenario is unchanged. New scenarios
> added in rev 1 (resolver.test.ts, instrumentation.test.tsx, NFR-2 500-item
> build, unsupported variant, Tab focus trap, end-of-history timer effect,
> matched_snapshot field check) are all `it.skip` and slot into the existing
> implement-one-at-a-time sequence after the corresponding pure-port work
> lands. The sequence below has been updated to indicate where each new
> scenario fits.

## Definition

The walking skeleton answers the user-centric question:

> Can Ravi peek at one cross-reference, commit to navigating there, and come
> back to where he started -- without losing his place?

It is the smallest end-to-end slice that delivers observable user value. Per
DESIGN architecture.md section 11, the R1 walking skeleton spans US-101 / 102
/ 103 / 104 / 107 plus the Close-button + Esc collapse from US-105 (pulled
forward because the split mechanism is incoherent without a close
affordance).

## Scenarios

The walking skeleton scenarios live in
`tests/acceptance/config-cross-references/walking-skeleton.feature`. Highlights
that demonstrate stakeholder-visible value end-to-end:

1. **Markdown link to a known skill renders as a live cross-reference token**
   (US-101, KPI #1) -- proves detection + registry are wired through to
   `<ConfigDetailPanel>` and produces an interactive token.
2. **Single-click on a live reference opens a vertical split with the target
   previewed** (US-102, KPI #1) -- proves the peek interaction produces the
   expected DOM with both panes and pushes one history entry.
3. **Ctrl+click across sub-tabs switches sub-tab, list selection, and detail
   in one atomic update** (US-103, KPI #1) -- proves the multi-field atomic
   commit, including the cross-pane sync.
4. **Alt+Left restores the previous navigation snapshot** (US-104, KPI #4) --
   proves the history stack and snapshot restoration. The "matched_snapshot"
   assertion ties this directly to the KPI #4 guardrail.
5. **Close button collapses the split back to a single pane** (US-105 R1
   pull-forward) -- proves the round-trip: the user can collapse the peek and
   reclaim their reading space.

Together these five scenarios, walked through in order, demonstrate the entire
journey: spot a reference, peek, commit, retrace. A stakeholder watching this
sequence sees the feature deliver on its promise.

## First scenario (the live one)

**Test**: `tests/acceptance/config-cross-references/registry.test.ts`,
`describe("Loading state with no aggregated configuration renders no tokens and no crash")`,
`it("buildRegistry returns an empty registry when given an empty aggregated config")`.

**Why this one is live and unskipped**:

- It's the architecturally-foundational behaviour: the reference registry is
  the data structure every other component depends on. Nothing else can be
  exercised until `buildRegistry` produces a registry from an `AggregatedConfig`.
- It validates the integration-seam prop contract from architecture.md
  section 6.1: when `aggregatedConfig` is empty (or null), the registry is
  empty and detection no-ops -- no crash. This is the "the loading state must
  not break" baseline that every higher-level scenario implicitly relies on.
- The assertion is *behavioural*, not *structural*. It does NOT say
  `expect(buildRegistry).toBeDefined()`. It asserts:
  - `registry.byName.size === 0`
  - `registry.byFilePath.size === 0`
  - `registry.version > 0` (so memoisation can later detect rebuilds)

**First failure mode** (against missing implementation):

The first run will fail at module import: `Cannot find module
'../../../src/plugins/norbert-config/domain/references/registry'`. The
DELIVER wave's first task is to create that file with the minimum surface
(types + a `buildRegistry` stub). Once the stub returns a degenerate value --
e.g. `{ byName: new Map(), byFilePath: new Map(), version: 0 }` -- the
assertion `expect(registry.version).toBeGreaterThan(0)` fails with a clear
business-logic message naming the version-increment behaviour to implement.

**Implement-one-at-a-time sequence (recommended for DELIVER, rev 1)**:

1. (live) `registry.test.ts`: empty config produces empty registry with
   non-zero version.
2. Un-skip `registry.test.ts`: `lookupByName` returns a single entry for
   `nw-bdd-requirements` -- now `buildRegistry` must actually index agents,
   commands, skills, hooks, mcpServers, rules, plugins from `AggregatedConfig`.
3. Un-skip `registry.test.ts`: `lookupByPath` resolves an absolute path.
4. Un-skip `registry.test.ts`: ambiguous name returns multiple entries.
5. Un-skip `registry.test.ts` **[rev 1]**: 500-item build scenario (NFR-2);
   needs `make500ItemConfig()` helper added to `_helpers/fixtures.ts`.
6. Un-skip `resolver.test.ts` **[rev 1]**: live -> ambiguous -> dead ->
   unsupported, in that order. The unsupported variant requires a path-kind
   reference fixture.
7. Un-skip `history.test.ts` scenarios in order (push, back, forward, clear,
   LRU, property test).
8. Un-skip `reducer.test.ts` scenarios in order (single-click, Ctrl+click,
   close, dead no-op, manual nav no-push, property tests including the
   reframed 2-pane invariant).
9. Un-skip `detection.test.ts` scenarios -- wires the remark plugin
   (live, fenced exclusion, bare-prose exclusion, dead, ambiguous,
   **and unsupported [rev 1]**).
10. Un-skip `announcements.test.ts` scenarios -- wires the pure
    `announcementFor` (back AND forward end-of-history, **rev 1**).
11. Un-skip `provider.test.tsx` walking-skeleton component scenarios -- the
    first end-to-end visible behaviour through the React adapter. Includes
    new rev-1 scenarios: bottom-pane preview fields, Ctrl+click
    preventDefault, end-of-history timer effect (uses fake timers),
    matched_snapshot DOM+event pairing.
12. Un-skip `instrumentation.test.tsx` **[rev 1]**: in this order --
    (a) cross_ref_click schema + latency_ms,
    (b) nav_history_restore matched_snapshot=true,
    (c) ambiguous_ref_resolve method=popover,
    (d) emission-point invariant (reducer call vs Provider effect),
    (e) matched_snapshot=false + console.error divergence path.
    Each requires the `eventSink` test seam wired through `<ConfigNavProvider>`.
13. Un-skip the milestone-1 disambiguation scenarios (popover, Tab focus
    trap [rev 1], Shift+Tab wrap [rev 1], ArrowUp [rev 1], confirm paths).
14. Un-skip milestone-2 robustness scenarios (US-106 invariants, US-109
    soft-fails, US-110 keyboard chain).

## Verification (Phase 3 gate)

Running `npx vitest run tests/acceptance/config-cross-references/registry.test.ts`
today produces:

```
Cannot find module '../../../src/plugins/norbert-config/domain/references/registry'
```

This is the expected starting state. The DELIVER wave's first commit
introduces the module, after which the assertion failure becomes the
business-logic-driven feedback loop.
