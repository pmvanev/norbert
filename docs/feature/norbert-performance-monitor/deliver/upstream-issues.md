# Upstream Issues — Deliver Wave

Deletions, surface extractions, or cleanups that could not be completed within a
step's boundary and must be handled by a later milestone or a separate issue.

---

## Step 10-01 — v1 deletions postponed

Step 10-01 deleted **6 of 7** v1 PM view components. The remaining postponements
are listed below with the grep evidence that forced them.

### Views

**`views/PMChart.tsx` — POSTPONED**

External importer outside the step's deletion set:
- `tests/acceptance/pm-chart-reliability/tooltip-crosshair-accuracy.test.ts`
  imports the `HoverData` interface (line 33, plus usages at 342 / 355 / 373).

Rationale: the `pm-chart-reliability` acceptance suite is **not** in 10-02's
scope (10-02 only cleans v1 tests under `tests/acceptance/norbert-performance-monitor-v2/`).
Removing `PMChart.tsx` would silently break an unrelated feature's acceptance
suite. Keeping the file until the `HoverData` type is relocated to a surviving
domain module (or the pm-chart-reliability tests are themselves retired) is the
safe move per the step's decision tree ("postpone that specific deletion and
flag in upstream-issues.md").

**Follow-up:** either (a) relocate `HoverData` to
`src/plugins/norbert-usage/domain/chartViewHelpers.ts` and update the one test
import, then delete `PMChart.tsx`; or (b) decide whether the
`pm-chart-reliability` feature is still a live concern under the v2 regime and,
if not, retire its acceptance tests alongside `PMChart.tsx` in a follow-up step.

### Domain modules

All four v1-ish domain modules listed in step 10-01 had live importers outside
the deletion set. **None** were deleted in this step.

**`domain/categoryConfig.ts` — POSTPONED**

Live production importers outside the deletion set:
- `src/plugins/norbert-usage/adapters/multiSessionStore.ts`
  (imports `MetricCategoryId`, `METRIC_CATEGORIES`). These drive the v1 category
  pathway that `multiSessionStore.ts` still exposes on its port
  (`appendSessionSample`, `getSessionBuffer`, `getAggregateBuffer`,
  `getAggregateWindowBuffer`, `getSessionWindowBuffer`). The port consumer
  `hookProcessor.ts` calls `appendSessionSample` live on every session event,
  and the plugin entry point `index.ts` wires that call through
  `createHookProcessor`.
- `src/plugins/norbert-usage/domain/chartViewHelpers.ts` (imports `MetricCategory`).

Non-deletion-set test importers:
- `tests/acceptance/pm-chart-reliability/tooltip-crosshair-accuracy.test.ts`
- `tests/acceptance/pm-data-pipeline/stats-derivation-per-category.test.ts`
- `tests/acceptance/pm-data-pipeline/latency-extraction.test.ts`
- `tests/unit/plugins/norbert-usage/domain/chartViewHelpers.test.ts`

Rationale: the v1 category pathway is still live. `multiSessionStore.ts`'s own
header comment (lines 17-20) describes this explicitly: "v1 and v2 surfaces
coexist on the same factory return value" and "Milestone 10 of the PM v2
rollout deletes the v1 category pathway". That v1-pathway decommission is
larger than step 10-01 (it removes port methods, updates the `hookProcessor.ts`
producer and the `index.ts` wiring, and decides the fate of the pm-data-pipeline
/ pm-chart-reliability acceptance suites). Step 10-01 is scoped to file
deletion, not port-surface reshaping.

**`domain/heartbeat.ts` — POSTPONED**

Non-deletion-set test importers:
- `tests/acceptance/pm-data-pipeline/cost-rate-accuracy.test.ts`
- `tests/acceptance/pm-data-pipeline/heartbeat-preserves-rates.test.ts`

No live production importer outside the deletion set (the sole production
importer was `PerformanceMonitorView.tsx`, which this step deleted). `heartbeat.ts`
is effectively a test-only dependency now; the blocker is the
`pm-data-pipeline` acceptance suite, which is not in 10-02's scope. A follow-up
step must either retire those acceptance tests or relocate the helper.

**`domain/multiWindowSampler.ts` — POSTPONED**

Live production importer outside the deletion set:
- `src/plugins/norbert-usage/adapters/multiSessionStore.ts`
  (imports `createMultiWindowBuffer`, `appendMultiWindowSample`,
  `MultiWindowBuffer`). Used to build per-session and aggregate multi-window
  buffers on the v1 category pathway.

Non-deletion-set test importer:
- `tests/acceptance/norbert-performance-monitor/backward-compatibility.test.ts`

Rationale: same as `categoryConfig.ts` — live v1 category pathway in
`multiSessionStore.ts` drives this dependency. `v2-adr-delta.md` §ADR-047
flagged this: "Deprecate `domain/multiWindowSampler.ts` (retain the file only
if another view imports it; otherwise delete)." The store still imports it, so
retention is correct for now.

**`domain/crossSessionAggregator.ts` — POSTPONED**

Test-only importers outside the deletion set:
- `tests/unit/plugins/norbert-usage/domain/crossSessionAggregator.test.ts`
- `tests/acceptance/norbert-performance-monitor/cross-session-aggregation.test.ts`
- `tests/acceptance/norbert-performance-monitor-v2/sidebar-and-detail-layout.test.ts`
  (the last one IS in 10-02's scope)

Rationale: no production importer at all (not imported by any `src/` file). The
blockers are the two test files outside 10-02's scope. JSDoc-marker approach
per step AC #4 ("else leave with `/** non-PM usage only */` JSDoc") does not
apply cleanly because there is no non-PM usage — the module is PM-specific but
its test coverage now lives in non-v1 test folders. A follow-up step should
either (a) retire the `norbert-performance-monitor/cross-session-aggregation.test.ts`
suite and the unit test once 10-02 clears the v2 sidebar import, then delete
the module; or (b) decide if cross-session aggregation is a keeper for a
future feature and relocate accordingly.

### `multiSessionStore.ts` / `hookProcessor.ts` dead-import cleanup

Step 10-01's implementation notes instruct: "After deletions, strip any dead
imports from `multiSessionStore.ts` and `hookProcessor.ts` that referenced v1
category/heartbeat code (they still do — milestone 10 is the cleanup)."

**No dead imports found.** The v1 imports in `multiSessionStore.ts` (lines
22-36: `MetricCategoryId`, `METRIC_CATEGORIES`, `createMultiWindowBuffer`,
`appendMultiWindowSample`, `MultiWindowBuffer`, v1 `RateSample`, `TimeWindowId`,
`TimeSeriesBuffer`) and in `hookProcessor.ts` (line 13: `CategorySampleInput`;
line 41, 252-253: `appendSessionSample`) remain **live** because the v1
category pathway is still actively producing data on every session event
through `createHookProcessor` in `index.ts` lines 187-189. Removing those
imports requires removing the corresponding port methods and their producers,
which is the v1-pathway decommission described above — larger than 10-01.

### Summary of 10-01 outcome

| File | Disposition |
|---|---|
| `PerformanceMonitorView.tsx` | DELETED |
| `PMSidebar.tsx` | DELETED |
| `PMChart.tsx` | POSTPONED (HoverData used by pm-chart-reliability test) |
| `PMDetailPane.tsx` | DELETED |
| `PMStatsGrid.tsx` | DELETED |
| `PMSessionTable.tsx` | DELETED |
| `PMTooltip.tsx` | DELETED |
| `domain/categoryConfig.ts` | POSTPONED (live v1 category pathway) |
| `domain/heartbeat.ts` | POSTPONED (pm-data-pipeline test importers) |
| `domain/multiWindowSampler.ts` | POSTPONED (live v1 category pathway) |
| `domain/crossSessionAggregator.ts` | POSTPONED (non-10-02 test importers) |
| `multiSessionStore.ts` import cleanup | NOT NEEDED (imports are live, not dead) |
| `hookProcessor.ts` import cleanup | NOT NEEDED (imports are live, not dead) |

Build green: `tsc --noEmit` exits 0, `npm run lint:boundaries` exits 0 (183
modules post-deletion, down from 190), full vitest suite: 1805 passed, 103
skipped, 1 pre-existing flaky property test (`ewma.test.ts`) unrelated to
these deletions.
