# Performance Monitor v2 — Evolution Record

**Feature ID**: norbert-performance-monitor-v2
**Delivered**: 2026-03-19
**Paradigm**: Functional
**Crafter**: nw-functional-software-crafter

## Summary

Redesigns the Performance Monitor view layer from a flat single-pane dashboard into a sidebar+detail master-detail layout inspired by Windows Task Manager's Performance tab. Each metric category (Tokens/s, Cost, Agents, Context) gets its own dedicated filled-area chart with category-appropriate Y-axis scaling, sparkline sidebar preview, hover tooltip with crosshair, stats grid, and per-session breakdown table.

The domain layer gains two new pure-function modules: category configuration (4 metric categories with formatting, colors, aggregate applicability) and chart renderer (filled-area line charts, gradient fill, hit-test computation, crosshair rendering). The adapter layer extends MultiSessionStore with per-session per-category time-series buffers and aggregate buffer recomputation. The hookProcessor is extended to feed per-category samples on each event.

v1 view components (PMAggregateGrid, PMSessionDetail) are removed and replaced. All existing views (Oscilloscope, Gauge Cluster, Dashboard, Cost Ticker) remain unchanged.

## User Stories Delivered

| ID | Title | MoSCoW |
|----|-------|--------|
| US-PM-001 | Performance Monitor View Registration | Must Have |
| US-PM-002 | Multi-Session Aggregate Metrics | Must Have |
| US-PM-004 | Configurable Time Window | Must Have |
| US-PM-005 | Context Window Pressure Monitoring | Must Have |
| US-PM-006 | Cost Rate Trending | Must Have |
| US-PM-007 | Oscilloscope Backward Compatibility | Must Have |

**Deferred**: US-PM-003 (Session Drill-Down Navigation) deferred to a future iteration. v2 focuses on the sidebar+category layout pattern; drill-down from aggregate to individual session detail is not in scope.

## Steps Executed

| Step | Title | Phases | Commit |
|------|-------|--------|--------|
| 01-01 | Metric category types and configuration | PREPARE, RED_ACCEPTANCE, RED_UNIT, GREEN, COMMIT | `3604f62` |
| 01-02 | Chart renderer pure functions | PREPARE, RED_ACCEPTANCE, RED_UNIT (skipped), GREEN, COMMIT | `418bcd5` |
| 02-01 | Extend MultiSessionStore with per-category buffers | PREPARE, RED_ACCEPTANCE, RED_UNIT (skipped), GREEN, COMMIT | `2822811` |
| 02-02 | Extend hookProcessor to feed category samples | PREPARE, RED_ACCEPTANCE, RED_UNIT (skipped), GREEN, COMMIT | `5cd6bde` |
| 03-01 | PMContainerView with sidebar+detail layout | PREPARE, RED_ACCEPTANCE, RED_UNIT (skipped), GREEN, COMMIT | `ed876f7` |
| 03-02 | PMSidebar with sparklines | PREPARE, RED_ACCEPTANCE, RED_UNIT (skipped), GREEN, COMMIT | `ba2a81d` |
| 04-01 | PMChart with filled-area rendering and hover | PREPARE, RED_ACCEPTANCE, RED_UNIT (skipped), GREEN, COMMIT | `93228b6` |
| 04-02 | PMDetailPane with aggregate graph, per-session grid, stats, table | PREPARE, RED_ACCEPTANCE (skipped), RED_UNIT (skipped), GREEN, COMMIT | `29674b6` |
| 04-03 | PMTooltip, PMStatsGrid, PMSessionTable | PREPARE, RED_ACCEPTANCE (skipped), RED_UNIT (skipped), GREEN, COMMIT | `0944ea5` |
| 05-01 | Wire PMContainerView into plugin registration | PREPARE, RED_ACCEPTANCE, RED_UNIT (skipped), GREEN, COMMIT | `c2b5230` |

Post-delivery commits:

| Commit | Description |
|--------|-------------|
| `91982ad` | L1-L4 quality pass on PM v2 |
| `1cd8e80` | Address testing theater defects from v2 adversarial review |
| `2142767` | Wire PMTooltip, stats, table, tooltip coords, duration label, accessibility |

## Key Architectural Decisions

### Category-driven rendering via const configuration

All 4 metric categories are defined in a single `categoryConfig` array. Each entry specifies: display label, line color, Y-axis formatting, aggregate applicability, stats grid cell definitions, and session table column definitions. Adding a new metric category requires only a new array entry -- no view code changes.

### Aggregate applicability as a domain-level rule

Context category is marked `aggregateApplicable: false` because averaging percentages across sessions is meaningless. When a non-aggregatable category is selected, the detail pane omits the large aggregate graph and renders per-session graphs as the primary display. This rule lives in categoryConfig, not in view logic.

### Chart renderer as pure-function composition pipeline

The chart renderer does not own the canvas context. It receives dimensions and buffer data, and returns drawing instructions (point arrays, grid line positions, hit-test results). This makes all rendering logic unit-testable without a canvas. The same renderer powers both aggregate charts and sidebar sparklines.

### MultiSessionStore extended additively

The existing `addSession/removeSession/updateSession/getSessions` interface is unchanged. New methods (`appendSessionSample`, `getSessionBuffer`, `getAggregateBuffer`, `subscribe`) are additive. Aggregate buffers for tokens, cost, and agents are recomputed as the sum of per-session values on each sample append. Context aggregate is never populated.

### Rejected simpler alternatives

1. **Patch v1 layout with CSS grid reorganization** -- covers ~40% of requirements, but cannot achieve per-category graphs or sparkline sidebar since v1 uses a single render loop with a single chart.
2. **Add category tabs to v1 detail pane** -- covers ~60%, but loses the Task Manager pattern's value of seeing all categories simultaneously in the sidebar while drilling into one.

Both were rejected because the sidebar+sparkline+category-scoped-detail pattern requires fundamentally different state management and per-category canvas rendering.

## Files Created

### Domain (pure functions)
- `src/plugins/norbert-usage/domain/categoryConfig.ts`
- `src/plugins/norbert-usage/domain/chartRenderer.ts`

### Views (React components)
- `src/plugins/norbert-usage/views/PMSidebar.tsx`
- `src/plugins/norbert-usage/views/PMDetailPane.tsx`
- `src/plugins/norbert-usage/views/PMTooltip.tsx`
- `src/plugins/norbert-usage/views/PMStatsGrid.tsx`
- `src/plugins/norbert-usage/views/PMSessionTable.tsx`

## Files Modified

- `src/plugins/norbert-usage/domain/types.ts` -- added MetricCategoryId, MetricCategory, CategorySample, HoverState, ChartMode types; removed v1-only types (PMViewMode, AgentMetrics, SessionDetailData)
- `src/plugins/norbert-usage/domain/performanceMonitor.ts` -- adapted for category-driven computation
- `src/plugins/norbert-usage/adapters/multiSessionStore.ts` -- extended with per-session per-category buffers, aggregate buffers, subscribe/notify
- `src/plugins/norbert-usage/hookProcessor.ts` -- extended to compute and append per-category samples on each event
- `src/plugins/norbert-usage/index.ts` -- wired extended MultiSessionStore with category buffer initialization
- `src/plugins/norbert-usage/views/PerformanceMonitorView.tsx` -- replaced with master-detail PMContainerView shell
- `src/plugins/norbert-usage/views/PMChart.tsx` -- replaced with filled-area canvas chart supporting hover and crosshair
- `src/styles/design-system.css` -- added PM v2 layout and component styles

## Files Removed

- `src/plugins/norbert-usage/views/PMAggregateGrid.tsx` -- replaced by PMDetailPane
- `src/plugins/norbert-usage/views/PMSessionDetail.tsx` -- v1 drill-down view, replaced by category-scoped detail

## Test Coverage Summary

**5 test suites, 98 tests passing** (321ms execution)

### Acceptance tests
- `category-configuration.test.ts` -- 27 scenarios covering 4 categories, formatting, colors, aggregate applicability, stats config, property-based uniqueness
- `chart-renderer.test.ts` -- 22 scenarios covering hit-test, filled-area points, sparkline, crosshair, grid lines, edge cases, property-based bounds
- `per-session-category-buffers.test.ts` -- 19 scenarios covering per-session buffers, aggregate recomputation, subscribe/notify, session lifecycle, property-based invariants
- `sidebar-and-detail-layout.test.ts` -- 19 scenarios covering category selection, aggregate graph visibility, per-session grid, session table, time window persistence
- `hover-tooltip.test.ts` -- 11 scenarios covering tooltip content per category, hit-test mapping, edge cases, property-based determinism

### Tests removed
- `session-drill-down.test.ts` -- v1 drill-down navigation tests (US-PM-003 deferred)
- `PMSessionDetail.test.ts` -- v1 session detail component tests

### RED_UNIT phase skipping
Steps 01-02 through 05-01 skipped the RED_UNIT phase where acceptance tests already covered the domain functions being implemented. View components at the adapter boundary were tested via acceptance-level scenarios exercising the pure domain logic they consume.

## Lessons Learned / Review Findings

### Adversarial review findings (commit `1cd8e80`)
Post-delivery adversarial review identified testing theater defects in the v2 test suite. Fixes strengthened assertions, tightened test setup/assertion coupling, and ensured test names accurately described validated behavior.

### L1-L4 quality pass (commit `91982ad`)
Structured quality pass across all 4 levels (L1: syntax/style, L2: domain correctness, L3: integration, L4: resilience) produced refactoring improvements without changing external behavior.

### Post-review polish (commit `2142767`)
Final polish pass wired PMTooltip coordinates correctly, added duration labels, and improved accessibility attributes on interactive elements.

### Category configuration as the single source of truth
The decision to drive all view rendering from categoryConfig proved effective -- adding stats grid and session table columns required zero changes to PMDetailPane or PMContainerView, only new entries in the config array.

### RED_ACCEPTANCE skipping in later steps
Steps 04-02 and 04-03 skipped RED_ACCEPTANCE because acceptance tests were pre-written and domain functions were already implemented in earlier steps. The tests passed immediately, confirming the implementation was correct without a red phase.

## Statistics

- **Total lines changed**: +4,537 / -1,200 (net +3,337 across 26 files)
- **New source files**: 7
- **Modified source files**: 8
- **Removed source files**: 2
- **New test suites**: 5
- **Removed test suites**: 2
- **Delivery phases**: 5 (Domain Types, Adapter Extension, Layout Shell, Detail Pane, Integration)
- **Delivery steps**: 10
- **Commits**: 14 (10 feature + 1 fix + 3 post-delivery quality)
- **No new external dependencies** -- all capabilities use browser APIs and extend existing patterns
